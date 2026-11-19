import type {
  BangleCategory,
  MarketResearchRecord,
  OpportunityRating,
  ProductOpportunityAssessment,
} from '../types/stall';
import { resolveItemPriceBounds } from './optimizer';

function extractPricesFromText(text: string): number[] {
  return [...text.matchAll(/(?:₹|Rs\.?\s*)(\d[\d,]*)/gi)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 200000);
}

function matchGroundedEvidence(
  itemName: string,
  categoryName: string,
  records: MarketResearchRecord[]
): {
  demandEvidence: string | null;
  competitionSignal: string | null;
  sourcedPrices: number[];
} {
  const groundedRecords = records.filter((r) => r.grounded && r.verifiedFacts.length > 0);
  if (groundedRecords.length === 0) {
    return { demandEvidence: null, competitionSignal: null, sourcedPrices: [] };
  }

  const tokens = `${itemName} ${categoryName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const matchingFacts = groundedRecords.flatMap((rec) => {
    const queryLower = `${rec.query} ${rec.topic}`.toLowerCase();
    return rec.verifiedFacts
      .filter((fact) => {
        const hay = `${fact.claim} ${fact.sourceTitle} ${queryLower}`.toLowerCase();
        return tokens.some((tok) => hay.includes(tok));
      })
      .map((fact) => ({ fact, retrievedDate: rec.retrievedDate }));
  });

  if (matchingFacts.length === 0) {
    return { demandEvidence: null, competitionSignal: null, sourcedPrices: [] };
  }

  const sourcedPrices = matchingFacts.flatMap((m) => extractPricesFromText(m.fact.claim));
  const topFact = matchingFacts[0];
  const demandEvidence = `${topFact.fact.sourceTitle} (${topFact.retrievedDate}): ${topFact.fact.claim.slice(0, 140)}${topFact.fact.claim.length > 140 ? '…' : ''}`;

  let competitionSignal: string | null = null;
  if (sourcedPrices.length > 0) {
    const minP = Math.min(...sourcedPrices);
    const maxP = Math.max(...sourcedPrices);
    competitionSignal =
      minP === maxP
        ? `Sourced market reference around ₹${minP.toLocaleString('en-IN')}`
        : `Sourced market range: ₹${minP.toLocaleString('en-IN')} – ₹${maxP.toLocaleString('en-IN')}`;
  } else {
    competitionSignal = `${matchingFacts.length} grounded source mention${matchingFacts.length === 1 ? '' : 's'} (no explicit ₹ price cited)`;
  }

  return { demandEvidence, competitionSignal, sourcedPrices };
}

export function evaluateProductOpportunity(params: {
  item: Pick<
    BangleCategory,
    'id' | 'name' | 'cost' | 'price' | 'priceMin' | 'priceMax' | 'beauty'
  >;
  categoryName: string;
  categoryBudget: number;
  researchRecords: MarketResearchRecord[];
}): ProductOpportunityAssessment {
  const { item, categoryName, categoryBudget, researchRecords } = params;
  const cost = Math.max(0, Number(item.cost) || 0);
  const priceBounds = resolveItemPriceBounds(item);
  const price = priceBounds.target;
  const appeal = Number.isFinite(Number(item.beauty)) ? Number(item.beauty) : 0;

  const missingDataHints: string[] = [];
  if (cost <= 0) missingDataHints.push('Enter a purchase cost (₹) to calculate profit and risk.');
  if (price <= 0) missingDataHints.push('Enter a selling price (₹) to calculate margin.');
  if (appeal <= 0) missingDataHints.push('Set a customer appeal score (1–10) to guide stock depth.');
  if (categoryBudget <= 0) missingDataHints.push('Set a category stock budget to estimate suggested quantity.');

  const { demandEvidence, competitionSignal, sourcedPrices } = matchGroundedEvidence(
    item.name,
    categoryName,
    researchRecords
  );

  if (!demandEvidence) {
    missingDataHints.push(
      `Run a live Market Research search for "${item.name}" or "${categoryName}" to add verified demand & price benchmarks.`
    );
  }

  if (cost <= 0 || price <= 0) {
    return {
      id: item.id,
      name: item.name,
      categoryName,
      cost,
      price,
      profitPerPiece: 0,
      marginPct: 0,
      appeal,
      stockingRisk: 'Unknown',
      demandEvidence,
      competitionSignal,
      suggestedQtyMin: null,
      suggestedQtyMax: null,
      rating: 'insufficient_data',
      ratingLabel: 'Not enough information',
      missingDataHints,
      summaryReason: 'Purchase cost and selling price are required before evaluating this product.',
    };
  }

  const profitPerPiece = price - cost;
  const marginPct = price > 0 ? Math.round((profitPerPiece / price) * 1000) / 10 : 0;

  // Stocking risk based on unit cost share of budget and margin cushion
  const costShareOfBudget = categoryBudget > 0 ? cost / categoryBudget : 0.2;
  let stockingRisk: 'Low' | 'Medium' | 'High' = 'Medium';
  if (profitPerPiece <= 0 || costShareOfBudget > 0.16 || marginPct < 25) {
    stockingRisk = 'High';
  } else if (costShareOfBudget <= 0.08 && marginPct >= 42) {
    stockingRisk = 'Low';
  }

  // Price pressure check strictly when grounded market prices exist
  let pricePressureNote = competitionSignal;
  if (sourcedPrices.length > 0) {
    const maxRef = Math.max(...sourcedPrices);
    const minRef = Math.min(...sourcedPrices);
    if (price > maxRef * 1.15) {
      pricePressureNote = `Above sourced range (₹${minRef.toLocaleString('en-IN')}–₹${maxRef.toLocaleString('en-IN')}) — verify local premium positioning`;
    } else if (price < minRef * 0.85) {
      pricePressureNote = `Below sourced range (₹${minRef.toLocaleString('en-IN')}–₹${maxRef.toLocaleString('en-IN')}) — room to lift price if quality matches`;
    } else {
      pricePressureNote = `Within sourced range (₹${minRef.toLocaleString('en-IN')}–₹${maxRef.toLocaleString('en-IN')})`;
    }
  }

  // Suggested quantity range based on budget share, appeal, and risk
  let suggestedQtyMin: number | null = null;
  let suggestedQtyMax: number | null = null;
  if (categoryBudget > 0 && cost > 0 && profitPerPiece > 0) {
    const targetBudgetShare =
      appeal >= 8.5 && stockingRisk !== 'High'
        ? 0.24
        : appeal >= 7
        ? 0.16
        : 0.1;
    const midQty = Math.max(1, Math.round((categoryBudget * targetBudgetShare) / cost));
    const maxAffordable = Math.max(1, Math.floor((categoryBudget * 0.35) / cost));
    suggestedQtyMin = Math.max(1, Math.min(maxAffordable, Math.floor(midQty * 0.7)));
    suggestedQtyMax = Math.max(suggestedQtyMin, Math.min(maxAffordable, Math.ceil(midQty * 1.3)));
  }

  let rating: OpportunityRating = 'promising';
  let ratingLabel = 'Promising';
  let summaryReason = '';

  if (profitPerPiece <= 0) {
    rating = 'cautious';
    ratingLabel = 'Unprofitable';
    summaryReason = `Selling price (₹${price}) does not exceed purchase cost (₹${cost}).`;
  } else if (marginPct >= 45 && appeal >= 8 && stockingRisk !== 'High') {
    rating = 'strong';
    ratingLabel = 'Strong fit';
    summaryReason = `₹${Math.round(profitPerPiece)} profit/pc (${marginPct}% margin) with ${appeal.toFixed(1)}★ appeal and ${stockingRisk.toLowerCase()} stocking risk.`;
  } else if (marginPct >= 30 && appeal >= 6) {
    rating = 'promising';
    ratingLabel = 'Solid fit';
    summaryReason = `₹${Math.round(profitPerPiece)} profit/pc (${marginPct}% margin) at ${stockingRisk.toLowerCase()} risk.${demandEvidence ? ' Supported by saved research.' : ' Run research to validate local demand.'}`;
  } else {
    rating = 'cautious';
    ratingLabel = 'Test small qty';
    summaryReason =
      stockingRisk === 'High'
        ? `Higher unit cost (₹${cost}) or tighter ${marginPct}% margin increases unsold inventory exposure.`
        : `Moderate appeal (${appeal.toFixed(1)}★) and ${marginPct}% margin — start with smaller test stock.`;
  }

  return {
    id: item.id,
    name: item.name,
    categoryName,
    cost,
    price,
    profitPerPiece: Math.round(profitPerPiece),
    marginPct,
    appeal,
    stockingRisk,
    demandEvidence,
    competitionSignal: pricePressureNote,
    suggestedQtyMin,
    suggestedQtyMax,
    rating,
    ratingLabel,
    missingDataHints,
    summaryReason,
  };
}
