import { GoogleGenAI, ThinkingLevel, Type, type Content } from '@google/genai';
import type {
  AccountAiContext,
  AiFocusSection,
  AiMemoryAddition,
  MarketResearchRecord,
  PendingAiConfirmation,
  PlannerSnapshot,
} from '../types/stall.js';
import { applyAiToolAction } from '../utils/aiActions.js';
import {
  buildVoiceCoachSystemInstruction,
  formatAccountContextBlock,
  STALL_TOOL_DECLARATIONS,
} from './stallTools.js';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add GEMINI_API_KEY in Vercel Project Settings → Environment Variables (or your local Secrets/.env) and redeploy.'
    );
    (err as Error & { status?: number }).status = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, delays = [700, 1500]): Promise<T> {
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw new Error('Retry exhausted');
}

function normalizeGeminiError(err: unknown): Error & { status?: number } {
  const rawMsg = err instanceof Error ? err.message : String(err || 'AI request failed');
  let cleanMsg = rawMsg;
  let status = (err as { status?: number })?.status;

  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
      cleanMsg = parsed.error.message;
      if (typeof parsed.error.code === 'number') status = parsed.error.code;
    }
  } catch {
    // Already plain text
  }

  if (cleanMsg.includes('RESOURCE_EXHAUSTED') || status === 429) {
    cleanMsg =
      'Gemini API rate/quota limit reached right now. Please retry in a few seconds or verify your billing/quota in Google AI Studio.';
    status = 429;
  } else if (status === 503 || cleanMsg.includes('high demand')) {
    cleanMsg = 'Gemini AI is experiencing a temporary traffic spike. Please retry in a moment.';
    status = 503;
  }

  const out = new Error(cleanMsg) as Error & { status?: number };
  out.status = status || 500;
  return out;
}

function isTransientOverload(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const status = (err as { status?: number })?.status;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

export async function handleParseCommand(body: {
  input: string;
  categories: Array<{ name: string; cost: number; price: number; beauty: number }>;
  settings: {
    eventName?: string;
    expectedFootfall?: number;
    budgetCap: number;
    minProfitFloor: number;
    stallFee: number;
    maxPerCategory: number;
  };
  accountContext?: AccountAiContext;
}) {
  const ai = getAiClient();
  const sysPrompt = `You are the low-latency command parser for StallIQ, an exhibition stall planner.
${formatAccountContextBlock(body.accountContext)}
Current products: ${JSON.stringify(body.categories)}.
Current settings: ${JSON.stringify(body.settings)}.
Convert the user's note, supplier quote, or rule request into structured updates. Only populate memoryNotes for durable long-term preferences. Return ONLY fields that should change, plus a 1-sentence summaryMessage.`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: body.input,
        config: {
          systemInstruction: sysPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              eventName: { type: Type.STRING },
              expectedFootfall: { type: Type.NUMBER },
              budgetCap: { type: Type.NUMBER },
              minProfitFloor: { type: Type.NUMBER },
              stallFee: { type: Type.NUMBER },
              maxPerCategory: { type: Type.NUMBER },
              allAtLeastOne: { type: Type.BOOLEAN },
              evenDistribution: { type: Type.BOOLEAN },
              beautyFirst: { type: Type.BOOLEAN },
              maxProfitFocus: { type: Type.BOOLEAN },
              safe90Mode: { type: Type.BOOLEAN },
              replaceCategories: { type: Type.BOOLEAN },
              categoryUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    cost: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    beauty: { type: Type.NUMBER },
                    isNewBangleCategory: { type: Type.BOOLEAN },
                  },
                },
              },
              stallStockAdditions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    cost: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    qty: { type: Type.NUMBER },
                    sellThrough: { type: Type.NUMBER },
                  },
                },
              },
              memoryNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fact: { type: Type.STRING },
                    category: { type: Type.STRING },
                  },
                },
              },
              summaryMessage: { type: Type.STRING },
            },
          },
        },
      })
    );

    return JSON.parse((response.text ?? '{}').trim());
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function handleParseRawStock(body: {
  rawNotes: string;
  defaultSellThrough: number;
  categoryHint?: string;
}) {
  const ai = getAiClient();
  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: body.rawNotes,
        config: {
          systemInstruction: `Extract messy supplier bills, WhatsApp lists, or notes into clean stall product rows (${body.categoryHint || 'mixed categories'}). Only estimate missing selling price at 2.5x purchase cost if omitted (note when estimated), and default sellThrough to ${body.defaultSellThrough || 85}.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    cost: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    qty: { type: Type.NUMBER },
                    sellThrough: { type: Type.NUMBER },
                  },
                  required: ['name', 'category', 'cost', 'price', 'qty', 'sellThrough'],
                },
              },
              note: { type: Type.STRING },
            },
          },
        },
      })
    );

    return JSON.parse((response.text ?? '{"items":[]}').trim());
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function handleCfoAudit(body: {
  eventName?: string;
  stallFee: number;
  expectedFootfall: number;
  accountContext?: AccountAiContext;
  totals: {
    totalCost: number;
    totalOutlay: number;
    revRealistic: number;
    netAfterStallReal: number;
    unitsToBreakEven: number;
    footfallConversionNeeded: number;
    blendedMarginPct: number;
    rentBurdenPct: number;
  };
  items: Array<{
    name: string;
    category: string;
    cost: number;
    price: number;
    qty: number;
    sellThrough: number;
    lineProfitReal: number;
    roiPct: number;
  }>;
}) {
  const ai = getAiClient();
  const eventLabel = body.eventName || 'Exhibition / Pop-Up';
  const categoriesUsed =
    Array.from(new Set(body.items.map((i) => i.category).filter(Boolean))).join(', ') ||
    'Mixed retail stock';
  const contents = `Review this stall plan (${categoriesUsed}) for ${eventLabel}:\nTotals: ${JSON.stringify(
    body.totals
  )}\nStall Rent: ₹${body.stallFee}\nExpected Visitors: ${body.expectedFootfall}\nStock Items: ${JSON.stringify(
    body.items
  )}`;
  const sysInstr = `You are a practical exhibition stall advisor reviewing "${eventLabel}" (${body.expectedFootfall.toLocaleString(
    'en-IN'
  )} expected visitors) selling ${categoriesUsed}.
${formatAccountContextBlock(body.accountContext)}
Use plain everyday small-business language (never say CFO, EBITDA, or contribution margin). Give 4 short, numbers-backed bullets using ONLY the supplied figures: (1) Strongest profit maker to highlight, (2) Unsold stock risk to watch, (3) One simple bundle idea from the listed products, and (4) Realistic sales pace needed to cover costs. Keep under 140 words and never invent external statistics.`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: sysInstr,
        },
      })
    );
    return { audit: response.text ?? '' };
  } catch (err) {
    if (isTransientOverload(err)) {
      try {
        const fallback = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: { systemInstruction: sysInstr },
        });
        return { audit: fallback.text ?? '' };
      } catch (fbErr) {
        throw normalizeGeminiError(fbErr);
      }
    }
    throw normalizeGeminiError(err);
  }
}

export async function handleStrategyPitch(body: {
  eventName?: string;
  expectedFootfall?: number;
  question: string;
  activeMixSummary: string;
  stallFee: number;
  categories?: string[];
  accountContext?: AccountAiContext;
}) {
  const ai = getAiClient();
  const eventLabel = body.eventName || 'Exhibition / Pop-Up';
  const catList = body.categories?.filter(Boolean).join(', ') || 'mixed retail categories';
  const visitorsLine =
    typeof body.expectedFootfall === 'number' && body.expectedFootfall > 0
      ? ` (${body.expectedFootfall.toLocaleString('en-IN')} expected visitors)`
      : '';
  const contents = `Event: ${eventLabel}${visitorsLine}\nCategories: ${catList}\nActive Stock Mix: ${body.activeMixSummary}\nStall Rent: ₹${body.stallFee}\nQuestion: ${body.question}`;
  const sysInstr = `You are a practical exhibition merchandiser and sales coach advising for "${eventLabel}" selling ${catList}.
${formatAccountContextBlock(body.accountContext)}
Provide a concise, ready-to-use 3-step selling approach and bundle price anchor tailored strictly to the listed categories, prices, and venue. Never invent market research or default to products the user does not carry. Keep under 120 words.`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: { systemInstruction: sysInstr },
      })
    );
    return { strategy: response.text ?? '' };
  } catch (err) {
    if (isTransientOverload(err)) {
      try {
        const fallback = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: { systemInstruction: sysInstr },
        });
        return { strategy: fallback.text ?? '' };
      } catch (fbErr) {
        throw normalizeGeminiError(fbErr);
      }
    }
    throw normalizeGeminiError(err);
  }
}

export async function handleSearchStrategies(body: {
  query: string;
  categories?: string[];
  eventName?: string;
}) {
  const ai = getAiClient();
  const categoryContext = body.categories?.filter(Boolean).join(', ');
  const venueContext = body.eventName?.trim();
  const contextLine = [
    categoryContext ? `Product categories: ${categoryContext}.` : '',
    venueContext ? `Event/Venue: ${venueContext}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${contextLine ? `${contextLine}\n` : ''}Search for practical stall display, pricing, and customer conversion ideas for: ${body.query}.
Summarize 3 concise, actionable takeaways grounded ONLY in actual search results. Never fabricate YouTube URLs, video titles, view counts, or unverified market statistics.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      })
    );

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => c.web)
      .filter((w): w is { uri: string; title: string } => Boolean(w?.uri && w?.title))
      .slice(0, 6);

    return {
      summary: response.text ?? '',
      sources,
      grounded: sources.length > 0,
    };
  } catch {
    return {
      summary: '',
      sources: [],
      grounded: false,
    };
  }
}

function buildHonestResearchFallback(params: {
  query: string;
  topic: string;
  eventName: string;
  eventLocation: string;
  categories: string[];
  budget: number;
  reason: string;
}): MarketResearchRecord {
  const retrievedDate = new Date().toISOString().slice(0, 10);
  const catText = params.categories.length > 0 ? params.categories.join(', ') : 'your products';
  const locText = params.eventLocation || params.eventName || 'your local exhibition venue';

  return {
    id: `res_${Date.now()}`,
    query: params.query,
    topic: params.topic || 'General Market Check',
    createdAtMs: Date.now(),
    retrievedDate,
    grounded: false,
    summary: `Live web search is currently unavailable for "${params.query}". No market prices, trends, or competitor claims were invented. Use the structured pre-purchase validation checklist below to verify demand locally before ordering stock.`,
    verifiedFacts: [],
    interpretation: [
      `Because live web sources could not be retrieved right now, treat any pricing or demand assumptions for ${catText} at ${locText} as unverified until you check local sellers.`,
      `Keep at least 20–30% of your ₹${params.budget.toLocaleString('en-IN')} stock budget in lower-cost, fast-moving entry items until you confirm local price ceilings.`,
    ],
    hypothesesToValidate: [
      `Check whether visitors at ${locText} expect impulse prices (under ₹250) or statement pieces (₹450+) for ${catText}.`,
      `Verify how many competing stalls at ${locText} carry similar styles and whether combo bundles are uncommon.`,
      `Confirm supplier return/exchange flexibility on slower-moving variants before placing full quantities.`,
    ],
    checklist: [
      `Search Instagram/local event hashtags for past editions of "${params.eventName || locText}" to inspect stall photos and crowd age group.`,
      `Check 3–5 Indian marketplace listings (Meesho, Amazon India, Nykaa Fashion, local boutiques) for current retail price ranges of ${catText}.`,
      `Ask the event organizer about past visitor demographics, stall mix limits, and peak shopping hours.`,
      `Order small test quantities of your highest-cost items and put deeper stock into proven everyday winners.`,
      `Verify display & packaging requirements (mirrors, lighting, bags, UPI QR stand) with the venue.`,
    ],
    sources: [],
    fallbackReason: params.reason,
  };
}

function extractLabeledBullets(text: string, headerPattern: RegExp): string[] {
  const match = text.match(headerPattern);
  if (!match || typeof match.index !== 'number') return [];
  const after = text.slice(match.index + match[0].length);
  const nextSectionIdx = after.search(/\n\s*#{1,3}\s+[A-Z]|\n\s*\*\*[A-Z][A-Za-z\s/&]+\*\*/);
  const block = nextSectionIdx >= 0 ? after.slice(0, nextSectionIdx) : after;
  return block
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, '').replace(/\*\*/g, '').trim())
    .filter((line) => line.length >= 8)
    .slice(0, 6);
}

export async function handleMarketResearch(body: {
  query: string;
  topic?: string;
  eventName?: string;
  eventLocation?: string;
  categories?: string[];
  budget?: number;
  budgetCap?: number;
  totalBudget?: number;
  priceRangeHint?: string;
  accountContext?: AccountAiContext;
}): Promise<MarketResearchRecord> {
  const query = (body.query || '').trim();
  const topic = (body.topic || 'Market Research').trim();
  const eventName = (body.eventName || 'Exhibition Stall').trim();
  const eventLocation = (body.eventLocation || '').trim();
  const categories = (body.categories || []).filter(Boolean);
  const budget = Math.max(
    0,
    Number(body.budget ?? body.budgetCap ?? body.totalBudget) || 0
  );
  const retrievedDate = new Date().toISOString().slice(0, 10);

  if (!query) {
    return buildHonestResearchFallback({
      query: 'General stall research',
      topic,
      eventName,
      eventLocation,
      categories,
      budget,
      reason: 'Enter a specific product, price, or event question to run live research.',
    });
  }

  let ai: GoogleGenAI;
  try {
    ai = getAiClient();
  } catch (err) {
    return buildHonestResearchFallback({
      query,
      topic,
      eventName,
      eventLocation,
      categories,
      budget,
      reason: err instanceof Error ? err.message : 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  const prompt = `Research question: "${query}"
Stall Context:
- Event: ${eventName}${eventLocation ? ` in ${eventLocation}` : ''}
- Product Categories: ${categories.join(', ') || 'General retail products'}
- Planned Stock Budget: ₹${budget.toLocaleString('en-IN')}
${body.priceRangeHint ? `- Current Planned Prices: ${body.priceRangeHint}` : ''}
- Today's Date: ${retrievedDate}

Use live Google Search to gather real, current market facts (popular styles, typical selling price bands in India/local market, competitor patterns, seasonal/event suitability, and stock risks).
CRITICAL INTEGRITY RULES:
- NEVER invent statistics, percentages, competitor names, prices, or URLs.
- Only include facts in "VERIFIED FINDINGS" that directly come from your Google Search results.
- Strictly format your answer using these exact 4 headings:

## VERIFIED FINDINGS
- (3 to 5 concise bullets stating ONLY concrete facts observed in search results, mentioning approximate date/year if shown in the source)

## AI INTERPRETATION
- (3 concise bullets translating those findings for this stall's budget of ₹${budget.toLocaleString('en-IN')} and categories)

## HYPOTHESES TO VALIDATE
- (3 specific assumptions the stall owner still needs to verify locally before buying stock)

## PRE-PURCHASE CHECKLIST
- (4 practical, concrete steps to take before placing the supplier order)`;

  try {
    let response;
    try {
      response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        })
      );
    } catch (primaryErr) {
      if (isTransientOverload(primaryErr)) {
        response = await withRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
            },
          })
        );
      } else {
        throw primaryErr;
      }
    }

    const rawText = (response.text ?? '').trim();
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const seenUrls = new Set<string>();
    const sources: Array<{ title: string; uri: string }> = [];

    for (const chunk of chunks) {
      const web = chunk.web;
      if (web?.uri && web?.title && !seenUrls.has(web.uri)) {
        seenUrls.add(web.uri);
        sources.push({ title: web.title.trim(), uri: web.uri.trim() });
      }
    }

    if (sources.length === 0) {
      return buildHonestResearchFallback({
        query,
        topic,
        eventName,
        eventLocation,
        categories,
        budget,
        reason:
          'Live web search returned no verifiable source links for this query. Showing an honest validation checklist instead of unverified claims.',
      });
    }

    const verifiedBullets = extractLabeledBullets(rawText, /##\s*VERIFIED FINDINGS/i);
    const interpretation = extractLabeledBullets(rawText, /##\s*AI INTERPRETATION/i);
    const hypothesesToValidate = extractLabeledBullets(rawText, /##\s*HYPOTHESES TO VALIDATE/i);
    const checklist = extractLabeledBullets(rawText, /##\s*PRE-PURCHASE CHECKLIST/i);

    const verifiedFacts = verifiedBullets.map((claim, idx) => {
      const src = sources[idx % sources.length];
      return {
        claim,
        sourceTitle: src.title,
        sourceUrl: src.uri,
        dateNote: `Checked ${retrievedDate}`,
      };
    });

    const summaryLine =
      verifiedFacts.length > 0
        ? `Found ${sources.length} live web source${sources.length === 1 ? '' : 's'} on ${retrievedDate} for "${query}". Review verified findings separately from AI interpretation and hypotheses below.`
        : rawText.replace(/\*\*/g, '').slice(0, 360);

    return {
      id: `res_${Date.now()}`,
      query,
      topic,
      createdAtMs: Date.now(),
      retrievedDate,
      grounded: true,
      summary: summaryLine,
      verifiedFacts,
      interpretation:
        interpretation.length > 0
          ? interpretation
          : [
              `Use the verified sources above to benchmark pricing for ${categories.join(', ') || 'your stock'} before finalizing quantities.`,
            ],
      hypothesesToValidate:
        hypothesesToValidate.length > 0
          ? hypothesesToValidate
          : [
              `Confirm whether visitors at ${eventLocation || eventName} respond better to impulse pricing or bundled sets.`,
            ],
      checklist:
        checklist.length > 0
          ? checklist
          : [
              'Compare your planned selling prices against at least 3 verified sources above.',
              'Keep test quantities smaller on higher-cost items until local demand is proven.',
            ],
      sources: sources.slice(0, 8),
    };
  } catch (err) {
    const normalized = normalizeGeminiError(err);
    return buildHonestResearchFallback({
      query,
      topic,
      eventName,
      eventLocation,
      categories,
      budget,
      reason: normalized.message,
    });
  }
}

export async function handleGenerateConceptImage(body: {
  prompt?: string;
  categories?: string[];
  eventName?: string;
}) {
  const ai = getAiClient();
  const catHint = body.categories?.filter(Boolean).join(', ') || 'curated retail products';
  const venueHint = body.eventName?.trim() || 'pop-up market booth';
  const prompt =
    body.prompt?.trim() ||
    `A clean, inviting pop-up exhibition stall tabletop display for ${venueHint} featuring neatly arranged ${catHint} across front focal holders, center quick-pick trays, and tiered back risers with clear small price cards and warm gallery lighting, photorealistic retail merchandising`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: '4:3',
          },
        },
      })
    );

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        return { imageUrl: `data:${mime};base64,${part.inlineData.data}` };
      }
    }

    throw new Error('Image model did not return an image part.');
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

async function runToolControlledTurn(params: {
  prompt: string;
  plannerState?: PlannerSnapshot;
  accountContext?: AccountAiContext;
  contextSummary?: string;
  mode: 'command' | 'voice';
  bypassConfirmation?: boolean;
}) {
  const ai = getAiClient();
  const modeRule =
    params.mode === 'command'
      ? '\nMODE: Typed Stall Coach. Execute valid requested updates cleanly. If a tool returns requiresConfirmation: true, explain the proposed change clearly and tell the user to click Confirm. Otherwise return a crisp 1-2 sentence confirmation citing exact updated figures and open section. If genuinely ambiguous, ask ONE brief clarifying question without calling mutating tools.'
      : '\nMODE: Spoken Voice Coach. Keep spoken answers crisp (2-3 sentences) without markdown asterisks.';

  const sysInstr = params.plannerState
    ? `${buildVoiceCoachSystemInstruction(params.plannerState, params.accountContext)}${modeRule}`
    : `You are StallIQ Coach, a practical exhibition stall advisor. Context: ${
        params.contextSummary || 'Exhibition stall planner'
      }.\n${formatAccountContextBlock(params.accountContext)}${modeRule}`;

  let currentState: PlannerSnapshot | undefined = params.plannerState;
  let stateChanged = false;
  let pendingConfirmation: PendingAiConfirmation | null = null;
  const appliedChanges: string[] = [];
  const memoryAdditions: AiMemoryAddition[] = [];
  let focusSection: AiFocusSection | undefined;
  let orderCopyText: string | null = null;
  let lastActionError: string | null = null;

  const conversation: Content[] = [{ role: 'user', parts: [{ text: params.prompt }] }];
  let replyText = '';

  const generateWithFallback = async (contents: Content[], useHydrogen: boolean) => {
    const config = {
      systemInstruction: sysInstr,
      ...(currentState ? { tools: [{ functionDeclarations: STALL_TOOL_DECLARATIONS }] } : {}),
      ...(useHydrogen ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
    };
    return ai.models.generateContent({
      model: useHydrogen ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite',
      contents,
      config,
    });
  };

  let useHydrogen = true;
  for (let round = 0; round < 3; round++) {
    let res;
    try {
      res = await withRetry(() => generateWithFallback(conversation, useHydrogen));
    } catch (err) {
      if (useHydrogen && isTransientOverload(err)) {
        useHydrogen = false;
        res = await generateWithFallback(conversation, false);
      } else {
        throw err;
      }
    }

    const calls = res.functionCalls;
    if (calls && calls.length > 0 && currentState) {
      const modelContent = res.candidates?.[0]?.content;
      if (modelContent) {
        conversation.push(modelContent);
      }

      const fnParts = calls.map((call) => {
        const exec = applyAiToolAction(
          currentState as PlannerSnapshot,
          call.name || 'get_live_plan_summary',
          (call.args || {}) as Record<string, unknown>,
          params.accountContext
        );
        if (!exec.ok) {
          lastActionError = exec.error || 'Requested action could not be applied.';
        } else if (call.name === 'save_ai_memory') {
          memoryAdditions.push(...exec.memoryAdditions);
          appliedChanges.push(...exec.changes);
        } else if (call.name === 'get_supplier_order') {
          if (exec.orderCopyText) {
            orderCopyText = exec.orderCopyText;
          }
          appliedChanges.push(...exec.changes);
        } else if (call.name !== 'get_live_plan_summary') {
          if (exec.requiresConfirmation && !params.bypassConfirmation) {
            pendingConfirmation = {
              id: `confirm_${Date.now()}`,
              summary: exec.changes.slice(0, 4).join(' · ') || 'Proposed workspace change',
              changes: exec.changes,
              proposedState: exec.nextState,
              focusSection: exec.focusSection || null,
              reason:
                exec.confirmationReason ||
                'This makes a major or destructive change to your stall plan.',
            };
          } else {
            currentState = exec.nextState;
            stateChanged = true;
            appliedChanges.push(...exec.changes);
            if (exec.focusSection) {
              focusSection = exec.focusSection;
            }
            if (exec.orderCopyText) {
              orderCopyText = exec.orderCopyText;
            }
          }
        }
        return {
          functionResponse: {
            id: call.id,
            name: call.name || 'get_live_plan_summary',
            response: exec.toolResponse,
          },
        };
      });

      conversation.push({ role: 'user', parts: fnParts });
      continue;
    }

    replyText = (res.text ?? '').trim();
    break;
  }

  return {
    replyText,
    updatedState: stateChanged && currentState ? currentState : null,
    pendingConfirmation,
    appliedChanges,
    memoryAdditions,
    focusSection: focusSection || null,
    orderCopyText,
    actionError: !stateChanged && !pendingConfirmation && lastActionError ? lastActionError : null,
  };
}

export async function handleCommandTurn(body: {
  input: string;
  plannerState: PlannerSnapshot;
  accountContext?: AccountAiContext;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}) {
  const userText = body.input?.trim();
  if (!userText) {
    return {
      assistantText: 'Ask me to adjust a budget, add a product, switch a combination goal, or open a section.',
      updatedState: null,
      pendingConfirmation: null as PendingAiConfirmation | null,
      appliedChanges: [] as string[],
      memoryAdditions: [] as AiMemoryAddition[],
      focusSection: null as AiFocusSection | null,
      needsClarification: true,
      actionError: null as string | null,
    };
  }

  const recentHistory = (body.history ?? [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  const prompt = recentHistory
    ? `Recent exchange:\n${recentHistory}\n\nNew request: ${userText}`
    : userText;

  try {
    const result = await runToolControlledTurn({
      prompt,
      plannerState: body.plannerState,
      accountContext: body.accountContext,
      mode: 'command',
    });

    return {
      assistantText: result.replyText,
      updatedState: result.updatedState,
      pendingConfirmation: result.pendingConfirmation,
      appliedChanges: result.appliedChanges,
      memoryAdditions: result.memoryAdditions,
      focusSection: result.focusSection,
      orderCopyText: result.orderCopyText,
      needsClarification:
        !result.updatedState &&
        !result.pendingConfirmation &&
        result.appliedChanges.length === 0 &&
        !result.actionError &&
        result.replyText.includes('?'),
      actionError: result.actionError,
    };
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function handleVoiceTurn(body: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  contextSummary?: string;
  plannerState?: PlannerSnapshot;
  accountContext?: AccountAiContext;
  history?: Array<{ role: 'user' | 'coach'; text: string }>;
  wantAudioReply?: boolean;
}) {
  const ai = getAiClient();
  let userTranscript = body.text?.trim() || '';

  if (!userTranscript && body.audioBase64) {
    const mimeType = (body.mimeType || 'audio/webm').split(';')[0];
    try {
      const transcribeRes = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              { inlineData: { mimeType, data: body.audioBase64 as string } },
              {
                text: 'Transcribe this spoken request from an exhibition stall owner in English or Hinglish. Preserve all product names, categories, prices, costs, appeal scores, and budgets accurately.',
              },
            ],
          },
        })
      );
      userTranscript = (transcribeRes.text ?? '').trim();
    } catch (err) {
      throw normalizeGeminiError(err);
    }
  }

  if (!userTranscript) {
    return {
      userTranscript: '',
      coachText:
        "I didn't catch clear speech in that recording. Try speaking closer to your mic or type your message below.",
      audioWavBase64: null as string | null,
      updatedState: null as PlannerSnapshot | null,
      pendingConfirmation: null as PendingAiConfirmation | null,
      appliedChanges: [] as string[],
      memoryAdditions: [] as AiMemoryAddition[],
      focusSection: null as AiFocusSection | null,
      actionError: null as string | null,
    };
  }

  const recentHistory = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Merchant' : 'Coach'}: ${m.text}`)
    .join('\n');

  const prompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nMerchant's new message: ${userTranscript}`
    : `Merchant's message: ${userTranscript}`;

  let result;
  try {
    result = await runToolControlledTurn({
      prompt,
      plannerState: body.plannerState,
      accountContext: body.accountContext,
      contextSummary: body.contextSummary,
      mode: 'voice',
    });
  } catch (err) {
    throw normalizeGeminiError(err);
  }

  let audioWavBase64: string | null = null;
  const coachText = result.replyText;

  if (coachText && body.wantAudioReply !== false) {
    try {
      const ttsRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: coachText,
                speechMetadata: {
                  style: 'Warm, clear, practical small-business mentor',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });
      audioWavBase64 =
        ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
    } catch {
      audioWavBase64 = null;
    }
  }

  return {
    userTranscript,
    coachText,
    audioWavBase64,
    updatedState: result.updatedState,
    pendingConfirmation: result.pendingConfirmation,
    appliedChanges: result.appliedChanges,
    memoryAdditions: result.memoryAdditions,
    focusSection: result.focusSection,
    orderCopyText: result.orderCopyText,
    actionError: result.actionError,
  };
}
