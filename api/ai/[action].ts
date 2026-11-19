import type { IncomingMessage } from 'http';
import {
  handleCfoAudit,
  handleCommandTurn,
  handleGenerateConceptImage,
  handleMarketResearch,
  handleParseCommand,
  handleParseRawStock,
  handleSearchStrategies,
  handleStrategyPitch,
  handleVoiceTurn,
} from '../../src/server/aiHandlers.js';

interface VercelReq extends IncomingMessage {
  method?: string;
  url?: string;
  query?: { action?: string | string[] };
  body?: unknown;
}

interface VercelRes {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelRes;
  json: (payload: unknown) => void;
  end: (chunk?: string) => void;
}

function extractAction(req: VercelReq): string {
  const qAction = req.query?.action;
  if (typeof qAction === 'string' && qAction.trim()) {
    return qAction.trim();
  }
  if (Array.isArray(qAction) && qAction[0]?.trim()) {
    return qAction[0].trim();
  }
  const urlPath = (req.url || '').split('?')[0];
  const match = urlPath.match(/\/api\/ai\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

async function parseRequestBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return req.body.trim() ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8').trim();
      return str ? (JSON.parse(str) as Record<string, unknown>) : {};
    }
    if (typeof req.body === 'object') {
      return req.body as Record<string, unknown>;
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).end();
    return;
  }

  const action = extractAction(req);

  if (req.method === 'GET' && action === 'health') {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    res.status(200).json({
      ok: true,
      hasGeminiKey,
      aiConfigured: hasGeminiKey,
      runtime: 'vercel-serverless',
      supportsLiveWs: false,
      supportsServerlessVoice: true,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await parseRequestBody(req);
  } catch {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }

  try {
    switch (action) {
      case 'parse-command':
        res.status(200).json(await handleParseCommand(body as Parameters<typeof handleParseCommand>[0]));
        return;
      case 'parse-raw-stock':
        res.status(200).json(await handleParseRawStock(body as Parameters<typeof handleParseRawStock>[0]));
        return;
      case 'cfo-audit':
        res.status(200).json(await handleCfoAudit(body as Parameters<typeof handleCfoAudit>[0]));
        return;
      case 'strategy':
        res.status(200).json(await handleStrategyPitch(body as Parameters<typeof handleStrategyPitch>[0]));
        return;
      case 'search-strategies':
        res.status(200).json(await handleSearchStrategies(body as Parameters<typeof handleSearchStrategies>[0]));
        return;
      case 'market-research':
        res.status(200).json(await handleMarketResearch(body as Parameters<typeof handleMarketResearch>[0]));
        return;
      case 'generate-image':
        res.status(200).json(await handleGenerateConceptImage(body as Parameters<typeof handleGenerateConceptImage>[0]));
        return;
      case 'voice-turn':
        res.status(200).json(await handleVoiceTurn(body as Parameters<typeof handleVoiceTurn>[0]));
        return;
      case 'command-turn':
        res.status(200).json(await handleCommandTurn(body as Parameters<typeof handleCommandTurn>[0]));
        return;
      default:
        res.status(404).json({ error: `Unknown AI action: ${String(action)}` });
    }
  } catch (err) {
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Server AI request failed';
    res.status(status).json({ error: message });
  }
}
