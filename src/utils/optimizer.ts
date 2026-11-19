import type {
  BangleCategory,
  BangleCombo,
  CategoryGroupResolved,
  DiversifiedOverviewTotals,
  LocalParseResult,
  OptimizationObjective,
  OptimizerConfig,
  OptimizerRules,
  PlanHealthSummary,
  PriorityWeights,
  SearchMetadata,
  StallStockItem,
  StallTotals,
  StockCategoryGroup,
} from '../types/stall';

export const DEFAULT_PRIORITY_WEIGHTS_BY_OBJECTIVE: Record<
  OptimizationObjective,
  PriorityWeights
> = {
  best_overall: { profit: 72, variety: 55, appeal: 65, budgetUsage: 45, lowRisk: 50 },
  highest_profit: { profit: 100, variety: 25, appeal: 35, budgetUsage: 50, lowRisk: 20 },
  balanced_variety: { profit: 55, variety: 100, appeal: 45, budgetUsage: 50, lowRisk: 50 },
  lowest_risk: { profit: 40, variety: 50, appeal: 35, budgetUsage: 30, lowRisk: 100 },
  best_appeal: { profit: 45, variety: 40, appeal: 100, budgetUsage: 45, lowRisk: 35 },
  best_budget_use: { profit: 55, variety: 45, appeal: 45, budgetUsage: 100, lowRisk: 40 },
  conservative_sales: { profit: 55, variety: 40, appeal: 35, budgetUsage: 35, lowRisk: 95 },
  high_footfall: { profit: 50, variety: 65, appeal: 60, budgetUsage: 70, lowRisk: 55 },
  small_budget: { profit: 50, variety: 75, appeal: 40, budgetUsage: 45, lowRisk: 80 },
};

export function getDefaultPriorityWeights(
  objective: OptimizationObjective = 'best_overall'
): PriorityWeights {
  return { ...(DEFAULT_PRIORITY_WEIGHTS_BY_OBJECTIVE[objective] || DEFAULT_PRIORITY_WEIGHTS_BY_OBJECTIVE.best_overall) };
}

export interface SellThroughScenario {
  pct: number;
  label: string;
  revenue: number;
  grossProfit: number;
  finalProfit: number;
  unsoldInventoryValue: number;
  coversBreakEven: boolean;
}

export function buildSellThroughScenarios(
  stallTotals: Pick<StallTotals, 'rev100' | 'totalCost' | 'totalEventCosts'>,
  percentages: number[] = [100, 90, 75, 50]
): SellThroughScenario[] {
  const rev100 = Math.max(0, stallTotals.rev100);
  const stockCost = Math.max(0, stallTotals.totalCost);
  const expenses = Math.max(0, stallTotals.totalEventCosts);
  const totalOutlay = stockCost + expenses;

  return percentages.map((pct) => {
    const rate = Math.max(0, Math.min(100, pct)) / 100;
    const revenue = Math.round(rev100 * rate);
    const grossProfit = revenue - stockCost;
    const finalProfit = grossProfit - expenses;
    const unsoldInventoryValue = Math.round(stockCost * (1 - rate));
    return {
      pct,
      label: pct === 100 ? 'All stock sells' : `${pct}% sells`,
      revenue,
      grossProfit,
      finalProfit,
      unsoldInventoryValue,
      coversBreakEven: revenue >= totalOutlay && totalOutlay > 0,
    };
  });
}

export interface ObjectiveMeta {
  id: OptimizationObjective;
  label: string;
  shortLabel: string;
  description: string;
}

export const OPTIMIZATION_OBJECTIVES: ObjectiveMeta[] = [
  {
    id: 'best_overall',
    label: 'Best overall combination',
    shortLabel: 'Best overall',
    description: 'Balances expected profit, customer appeal, variety, and budget use.',
  },
  {
    id: 'highest_profit',
    label: 'Highest estimated profit',
    shortLabel: 'Highest profit',
    description: 'Prioritizes maximum expected profit and strong markup within budget.',
  },
  {
    id: 'balanced_variety',
    label: 'Best balance of profit & variety',
    shortLabel: 'Profit & variety',
    description: 'Spreads stock evenly across your products without sacrificing solid profit.',
  },
  {
    id: 'lowest_risk',
    label: 'Lowest-risk combination',
    shortLabel: 'Lowest risk',
    description: 'Minimizes potential unsold stock cost and lowers the break-even sales target.',
  },
  {
    id: 'best_appeal',
    label: 'Best customer appeal',
    shortLabel: 'Best appeal',
    description: 'Weights quantities toward your highest-appeal eye-catching products.',
  },
  {
    id: 'best_budget_use',
    label: 'Best use of available budget',
    shortLabel: 'Best budget use',
    description: 'Uses nearly all of your available stock budget productively without overspending.',
  },
  {
    id: 'conservative_sales',
    label: 'Best for conservative sales',
    shortLabel: 'Conservative sales',
    description: 'Maximizes profit even if only 65–75% of your stock sells on event day.',
  },
  {
    id: 'high_footfall',
    label: 'Best for a high-footfall event',
    shortLabel: 'High footfall',
    description: 'Prioritizes higher piece counts and accessible fast-moving prices for busy crowds.',
  },
  {
    id: 'small_budget',
    label: 'Best for a small or tight budget',
    shortLabel: 'Small budget',
    description: 'Favors lower purchase-cost items so a tight budget still gets healthy variety.',
  },
];

const BADGE_STYLE_BY_TYPE: Record<string, string> = {
  'Top Appeal': 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40',
  'Top Profit': 'bg-[#E7F3EF] text-[#0F5E54] border-[#0F5E54]/30',
  'Lowest Risk': 'bg-[#EEF2FF] text-[#3730A3] border-[#6366F1]/30',
  'Conservative Safe': 'bg-[#EEF2FF] text-[#3730A3] border-[#6366F1]/30',
  'Balanced Variety': 'bg-[#F1F5F2] text-[#13201E] border-[#D0DDD5]',
  'Best Budget Fit': 'bg-[#E7F3EF] text-[#0F5E54] border-[#0F5E54]/30',
  'Crowd Ready': 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40',
  'Lean Budget': 'bg-[#F1F5F2] text-[#13201E] border-[#D0DDD5]',
  'Best Overall': 'bg-[#E7F3EF] text-[#0F5E54] border-[#0F5E54]/30',
  default: 'bg-[#F1F5F2] text-[#13201E] border-[#D0DDD5]',
};

const TAG_POOL = [
  'Balanced Variety',
  'Strong All-Round',
  'High Margin Mix',
  'Curated Blend',
  'Steady Turnover',
  'Appeal Focus',
  'Broad Assortment',
  'Focused Lot',
];

export function resolveItemPriceBounds(cat: Pick<BangleCategory, 'price' | 'priceMin' | 'priceMax'>): {
  min: number;
  max: number;
  target: number;
  hasRange: boolean;
} {
  const pMin =
    typeof cat.priceMin === 'number' && Number.isFinite(cat.priceMin) && cat.priceMin >= 0
      ? cat.priceMin
      : null;
  const pMax =
    typeof cat.priceMax === 'number' && Number.isFinite(cat.priceMax) && cat.priceMax >= 0
      ? cat.priceMax
      : null;

  if (pMin !== null && pMax !== null && pMax >= pMin && pMax > 0) {
    const target = Math.round((pMin + pMax) / 2);
    return {
      min: pMin,
      max: pMax,
      target,
      hasRange: pMax > pMin,
    };
  }
  const fixed = Math.max(0, Number(cat.price) || 0);
  return { min: fixed, max: fixed, target: fixed, hasRange: false };
}

function resolveEffectiveObjective(
  config: OptimizerConfig,
  rules: OptimizerRules
): OptimizationObjective {
  if (config.objective && config.objective !== 'best_overall') {
    return config.objective;
  }
  if (rules.beautyFirst) return 'best_appeal';
  if (rules.maxProfitFocus) return 'highest_profit';
  if (rules.safe90Mode) return 'conservative_sales';
  return config.objective || 'best_overall';
}

function computeKeywords(
  counts: number[],
  categories: BangleCategory[],
  avgBeauty: number,
  evenness: number,
  prof90: number,
  minProfitFloor: number,
  budgetUtilizationPct: number
): string[] {
  const keywords: string[] = [];
  let maxQty = -1;
  let maxIdx = 0;
  let totalPieces = 0;
  counts.forEach((q, i) => {
    totalPieces += q;
    if (q > maxQty) {
      maxQty = q;
      maxIdx = i;
    }
  });
  const leadCat = categories[maxIdx];
  if (leadCat && maxQty > 0) {
    keywords.push(`${leadCat.shortName || leadCat.name}-led (${maxQty})`);
  }
  if (avgBeauty >= 8.2) keywords.push('High Appeal');
  if (evenness >= 8.2) keywords.push('Even Variety');
  if (budgetUtilizationPct >= 97) keywords.push('Full Budget Fit');
  if (prof90 >= minProfitFloor && minProfitFloor > 0) keywords.push('Conservative Safe');
  if (counts.length > 0 && counts.every((q) => q >= 1)) keywords.push('All Items Stocked');
  return keywords.slice(0, 3);
}

interface RawCandidate {
  counts: number[];
  cost: number;
  rev100: number;
  prof100: number;
  rev90: number;
  prof90: number;
  prof70: number;
  revMin100: number;
  revMax100: number;
  profMin100: number;
  profMax100: number;
  unsoldRiskCost: number;
  breakEvenSellThroughPct: number;
  budgetUtilizationPct: number;
  distinctItemsCount: number;
  avgUnitCost: number;
  avgSellPrice: number;
  pieces: number;
  avgBeauty: number;
  evenness: number;
  marginPct: number;
  score: number;
}

function scoreCandidateForObjective(
  c: Omit<RawCandidate, 'score'>,
  objective: OptimizationObjective,
  budgetCap: number,
  totalCatalogItems: number,
  minUnitCost: number,
  maxUnitCost: number,
  priorityWeights?: PriorityWeights
): number {
  const safeCap = Math.max(1, budgetCap);
  const profitRatio = c.prof100 / safeCap;
  const conservativeRatio = c.prof90 / safeCap;
  const deepConservativeRatio = c.prof70 / safeCap;
  const appealNorm = c.avgBeauty / 10;
  const varietyNorm = c.evenness / 10;
  const coverageNorm = c.distinctItemsCount / Math.max(1, totalCatalogItems);
  const utilNorm = Math.min(1, c.cost / safeCap);
  const breakEvenSafety = Math.max(0, (100 - c.breakEvenSellThroughPct) / 100);
  const lowRiskCostRatio = Math.max(0, 1 - c.unsoldRiskCost / safeCap);
  const unitCostSpread = Math.max(1, maxUnitCost - minUnitCost);
  const affordabilityNorm = Math.max(0, 1 - (c.avgUnitCost - minUnitCost) / unitCostSpread);
  const pieceVolumeNorm = Math.min(2, c.pieces / Math.max(6, totalCatalogItems * 3));

  if (priorityWeights) {
    const wProfit = Math.max(0, Number(priorityWeights.profit) || 0);
    const wVariety = Math.max(0, Number(priorityWeights.variety) || 0);
    const wAppeal = Math.max(0, Number(priorityWeights.appeal) || 0);
    const wBudget = Math.max(0, Number(priorityWeights.budgetUsage) || 0);
    const wRisk = Math.max(0, Number(priorityWeights.lowRisk) || 0);
    const totalW = Math.max(1, wProfit + wVariety + wAppeal + wBudget + wRisk);

    const profitScore = profitRatio * 0.7 + (c.marginPct / 100) * 0.3;
    const varietyScore = varietyNorm * 0.65 + coverageNorm * 0.35;
    const riskScore =
      breakEvenSafety * 0.45 + lowRiskCostRatio * 0.3 + deepConservativeRatio * 0.25;

    return (
      ((wProfit * profitScore +
        wVariety * varietyScore +
        wAppeal * appealNorm +
        wBudget * utilNorm +
        wRisk * riskScore) /
        totalW) *
      100
    );
  }

  switch (objective) {
    case 'highest_profit':
      return profitRatio * 82 + (c.marginPct / 100) * 12 + appealNorm * 6;
    case 'balanced_variety':
      return varietyNorm * 40 + coverageNorm * 24 + profitRatio * 24 + appealNorm * 12;
    case 'lowest_risk':
      return (
        breakEvenSafety * 38 +
        lowRiskCostRatio * 24 +
        deepConservativeRatio * 24 +
        varietyNorm * 14
      );
    case 'best_appeal':
      return appealNorm * 78 + profitRatio * 14 + varietyNorm * 8;
    case 'best_budget_use':
      return utilNorm * 58 + profitRatio * 24 + appealNorm * 10 + varietyNorm * 8;
    case 'conservative_sales':
      return (
        deepConservativeRatio * 46 +
        conservativeRatio * 28 +
        breakEvenSafety * 18 +
        appealNorm * 8
      );
    case 'high_footfall':
      return (
        pieceVolumeNorm * 38 +
        affordabilityNorm * 24 +
        appealNorm * 20 +
        profitRatio * 18
      );
    case 'small_budget':
      return (
        affordabilityNorm * 34 +
        coverageNorm * 24 +
        breakEvenSafety * 22 +
        profitRatio * 20
      );
    case 'best_overall':
    default:
      return (
        profitRatio * 36 +
        appealNorm * 28 +
        varietyNorm * 20 +
        breakEvenSafety * 10 +
        utilNorm * 6
      );
  }
}

function isParetoOrDiverse(
  cand: RawCandidate,
  selected: RawCandidate[],
  n: number,
  objective: OptimizationObjective
): boolean {
  const minL1 = n <= 2 ? 1 : 2;
  for (const ex of selected) {
    let l1 = 0;
    for (let i = 0; i < n; i++) {
      l1 += Math.abs(ex.counts[i] - cand.counts[i]);
    }
    if (l1 < minL1) return false;
    // Also prevent near-identical trade-offs across key financial & merchandising dimensions
    const sameProfit = Math.abs(ex.prof100 - cand.prof100) < 35;
    const sameAppeal = Math.abs(ex.avgBeauty - cand.avgBeauty) < 0.08;
    const sameEven = Math.abs(ex.evenness - cand.evenness) < 0.15;
    const samePieces = ex.pieces === cand.pieces;
    if (l1 <= 2 && sameProfit && sameAppeal && sameEven && samePieces && objective !== 'best_budget_use') {
      return false;
    }
  }
  return true;
}

export function generateStockCombinationsWithMeta(
  categories: BangleCategory[],
  config: OptimizerConfig,
  rules: OptimizerRules,
  maxResults = 30
): { combos: BangleCombo[]; meta: SearchMetadata } {
  const objective = resolveEffectiveObjective(config, rules);
  const maxStates = 120000;
  const n = categories.length;
  if (n === 0 || config.budgetCap <= 0) {
    return {
      combos: [],
      meta: {
        searchMode: 'exact',
        statesEvaluated: 0,
        candidateCount: 0,
        truncated: false,
        maxStates,
        objective,
      },
    };
  }

  const safePct = Math.min(99, Math.max(50, Math.round(config.conservativeSellThroughPct ?? 90)));
  const safeRate = safePct / 100;
  const resolvedPrices = categories.map((c) => resolveItemPriceBounds(c));
  const sumAllCosts = categories.reduce((acc, c) => acc + Math.max(1, c.cost), 0);
  const minUnitCost = Math.min(...categories.map((c) => Math.max(1, c.cost)));
  const maxUnitCost = Math.max(...categories.map((c) => Math.max(1, c.cost)));
  const hasHighBeauty = categories.some((c) => c.beauty > 6.5);

  const minNeededEvenMax = Math.ceil((config.budgetCap * 1.18) / Math.max(1, sumAllCosts));
  const effectiveEvenMax = Math.max(config.maxPerCategory, minNeededEvenMax);

  const bounds = categories.map((cat) => {
    const hasExplicitMin = typeof cat.minQty === 'number' && Number.isFinite(cat.minQty) && cat.minQty >= 0;
    const hasExplicitMax = typeof cat.maxQty === 'number' && Number.isFinite(cat.maxQty) && cat.maxQty >= 0;

    let min = hasExplicitMin ? Math.floor(cat.minQty as number) : rules.allAtLeastOne ? 1 : 0;
    if (!hasExplicitMin && cat.id === 'colours' && config.minColoursRule > min) {
      min = config.minColoursRule;
    }

    const maxAfford =
      cat.cost > 0
        ? Math.floor(config.budgetCap / cat.cost)
        : hasExplicitMax
          ? Math.floor(cat.maxQty as number)
          : 50;

    let max = hasExplicitMax
      ? Math.min(maxAfford, Math.floor(cat.maxQty as number))
      : rules.evenDistribution
        ? Math.min(maxAfford, effectiveEvenMax)
        : maxAfford;

    if (!hasExplicitMax && rules.evenDistribution && cat.beauty <= 6.0 && hasHighBeauty && objective !== 'high_footfall' && objective !== 'small_budget') {
      const cappedLow = Math.max(2, Math.round(effectiveEvenMax * 0.35));
      max = Math.min(max, cappedLow);
    }

    max = Math.max(0, Math.min(max, maxAfford));
    min = Math.min(min, max);
    return { min, max, hasExplicitMax };
  });

  // Only relax implicit low-appeal cap if needed to reach budget; never override explicit maxQty
  const maxSpendCheck = bounds.reduce((acc, b, idx) => acc + b.max * categories[idx].cost, 0);
  if (maxSpendCheck < config.budgetCap * 0.92) {
    bounds.forEach((b, idx) => {
      if (b.hasExplicitMax) return;
      const cat = categories[idx];
      const maxAfford = cat.cost > 0 ? Math.floor(config.budgetCap / cat.cost) : 50;
      b.max = Math.min(maxAfford, Math.max(b.max, effectiveEvenMax));
    });
  }

  const minSum = bounds.reduce((acc, b, idx) => acc + b.min * categories[idx].cost, 0);
  if (minSum > config.budgetCap) {
    return {
      combos: [],
      meta: {
        searchMode: 'exact',
        statesEvaluated: 0,
        candidateCount: 0,
        truncated: false,
        maxStates,
        objective,
      },
    };
  }

  const results: RawCandidate[] = [];
  // Lowest-risk & small-budget objectives are allowed to spend less than 88% of budget when safer
  const defaultMinSpend =
    objective === 'lowest_risk' || objective === 'small_budget'
      ? config.budgetCap * 0.65
      : config.budgetCap * 0.88;

  let statesEvaluated = 0;
  let searchMode: 'exact' | 'bounded' = 'exact';
  let truncated = false;

  const allItemsPriced = resolvedPrices.every((p) => p.target > 0);

  const evaluate = (counts: number[], minSpendThreshold = defaultMinSpend) => {
    let cost = 0;
    let pricedCost = 0;
    let rev100 = 0;
    let revMin100 = 0;
    let revMax100 = 0;
    let pieces = 0;
    let beautySum = 0;
    let distinctItemsCount = 0;

    for (let i = 0; i < n; i++) {
      const q = counts[i];
      if (!q) continue;
      distinctItemsCount++;
      const lineCost = q * categories[i].cost;
      cost += lineCost;
      if (resolvedPrices[i].target > 0) {
        pricedCost += lineCost;
        rev100 += q * resolvedPrices[i].target;
        revMin100 += q * resolvedPrices[i].min;
        revMax100 += q * resolvedPrices[i].max;
      }
      pieces += q;
      beautySum += q * categories[i].beauty;
    }

    if (pieces === 0 || cost > config.budgetCap || cost < minSpendThreshold) return;
    const costBasisForProfit = allItemsPriced ? cost : pricedCost;
    const prof100 = costBasisForProfit > 0 || rev100 > 0 ? rev100 - costBasisForProfit : 0;
    const rev90 = Math.round(rev100 * safeRate);
    const prof90 = costBasisForProfit > 0 || rev90 > 0 ? rev90 - costBasisForProfit : 0;
    const prof70 =
      costBasisForProfit > 0 || rev100 > 0
        ? Math.round(rev100 * Math.min(safeRate, 0.72)) - costBasisForProfit
        : 0;

    if (allItemsPriced && prof100 < config.minProfitFloor) return;
    const avgBeauty = Number((beautySum / pieces).toFixed(2));
    if (rules.beautyFirst && avgBeauty < 7.75) return;
    if (allItemsPriced && rules.safe90Mode && prof90 < config.minProfitFloor * 0.8) return;

    const mean = pieces / n;
    const variance = counts.reduce((a, q) => a + Math.pow(q - mean, 2), 0) / n;
    const stdScale = Math.max(1, Math.sqrt(Math.max(1, mean)) * 0.85);
    const evenness = Number(Math.max(1, 10 - (Math.sqrt(variance) / stdScale) * 2.4).toFixed(2));
    const marginPct = rev100 > 0 ? Number(((prof100 / rev100) * 100).toFixed(1)) : 0;
    const unsoldRiskCost = Math.round(cost * (1 - safeRate));
    const breakEvenSellThroughPct =
      rev100 > 0 ? Math.min(100, Math.ceil((costBasisForProfit / rev100) * 100)) : 100;
    const budgetUtilizationPct = Number(((cost / Math.max(1, config.budgetCap)) * 100).toFixed(1));
    const avgUnitCost = cost / pieces;
    const avgSellPrice = rev100 / pieces;

    const base: Omit<RawCandidate, 'score'> = {
      counts: [...counts],
      cost,
      rev100,
      prof100,
      rev90,
      prof90,
      prof70,
      revMin100,
      revMax100,
      profMin100: costBasisForProfit > 0 || revMin100 > 0 ? revMin100 - costBasisForProfit : 0,
      profMax100: costBasisForProfit > 0 || revMax100 > 0 ? revMax100 - costBasisForProfit : 0,
      unsoldRiskCost,
      breakEvenSellThroughPct,
      budgetUtilizationPct,
      distinctItemsCount,
      avgUnitCost,
      avgSellPrice,
      pieces,
      avgBeauty,
      evenness,
      marginPct,
    };

    const score = scoreCandidateForObjective(
      base,
      objective,
      config.budgetCap,
      n,
      minUnitCost,
      maxUnitCost,
      config.priorityWeights
    );

    results.push({ ...base, score });
  };

  // Exact DFS for manageable spaces (documented cap: 120,000 states)
  const searchProduct = bounds.reduce((acc, b) => acc * (b.max - b.min + 1), 1);
  if (n <= 7 && searchProduct <= maxStates) {
    const runDfs = (minSpend: number) => {
      const dfs = (idx: number, counts: number[], cost: number) => {
        if (statesEvaluated >= maxStates) {
          truncated = true;
          searchMode = 'bounded';
          return;
        }
        statesEvaluated++;
        if (idx === n) {
          evaluate(counts, minSpend);
          return;
        }
        const { min, max } = bounds[idx];
        const cCost = categories[idx].cost;
        for (let q = min; q <= max; q++) {
          if (cost + q * cCost > config.budgetCap) break;
          counts[idx] = q;
          dfs(idx + 1, counts, cost + q * cCost);
        }
      };
      dfs(0, new Array(n).fill(0), 0);
    };

    runDfs(defaultMinSpend);
    if (results.length < 5) {
      runDfs(0);
    }
  } else {
    searchMode = 'bounded';
    truncated = true;
  }

  // Deterministic multi-objective greedy + perturbation search for larger spaces or sparse exact results
  if (searchMode === 'bounded' || results.length < Math.max(30, maxResults * 2)) {
    const buildGreedy = (weights: number[], minSpend: number, targetCap = config.budgetCap) => {
      const counts = bounds.map((b) => b.min);
      let cost = counts.reduce((acc, q, idx) => acc + q * categories[idx].cost, 0);

      for (let step = 0; step < 360; step++) {
        let bestIdx = -1;
        let bestGain = -Infinity;
        for (let i = 0; i < n; i++) {
          if (counts[i] >= bounds[i].max) continue;
          const cCost = categories[i].cost;
          if (cost + cCost > targetCap) continue;
          const balanceBonus = 1 / (1 + counts[i] * 0.3);
          const gain = weights[i] * balanceBonus;
          if (gain > bestGain) {
            bestGain = gain;
            bestIdx = i;
          }
        }
        if (bestIdx === -1) break;
        counts[bestIdx] += 1;
        cost += categories[bestIdx].cost;
        statesEvaluated++;
        if (cost >= minSpend) {
          evaluate(counts, minSpend);
        }
      }
      evaluate(counts, minSpend);
      return counts;
    };

    const seedBases: number[][] = [];
    const baseProfiles: number[][] = [
      // Overall balanced
      categories.map((c, i) => ((resolvedPrices[i].target - c.cost) / Math.max(1, c.cost)) * 50 + c.beauty * 6),
      // Highest ROI / profit per rupee
      categories.map((c, i) => ((resolvedPrices[i].target - c.cost) / Math.max(1, c.cost)) * 120),
      // Highest absolute profit per unit
      categories.map((c, i) => Math.max(1, resolvedPrices[i].target - c.cost)),
      // Highest customer appeal
      categories.map((c, i) => Math.pow(c.beauty, 2) * 4 + (resolvedPrices[i].target - c.cost) * 0.04),
      // Margin % + appeal (conservative safety)
      categories.map((c, i) => ((resolvedPrices[i].target - c.cost) / Math.max(1, resolvedPrices[i].target)) * 100 + c.beauty * 4),
      // High-footfall volume & affordability
      categories.map((c, i) => (1000 / Math.max(20, c.cost)) + (1000 / Math.max(50, resolvedPrices[i].target)) + c.beauty * 2),
      // Small-budget low unit cost
      categories.map((c, i) => (1200 / Math.max(15, c.cost)) * (1 + Math.max(0, resolvedPrices[i].target - c.cost) / Math.max(1, resolvedPrices[i].target))),
      // Even variety
      categories.map(() => 100),
    ];

    for (let lead = 0; lead < n; lead++) {
      baseProfiles.push(
        categories.map((c, idx) =>
          idx === lead
            ? c.beauty * 18 + (resolvedPrices[idx].target - c.cost) * 0.25 + 60
            : c.beauty * 4 + 10
        )
      );
    }

    baseProfiles.forEach((profile) => {
      seedBases.push(buildGreedy(profile, defaultMinSpend, config.budgetCap));
      if (objective === 'lowest_risk' || objective === 'small_budget') {
        seedBases.push(buildGreedy(profile, defaultMinSpend, Math.round(config.budgetCap * 0.85)));
      }
    });

    let seed = 1337;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const runPerturbations = (minSpend: number) => {
      for (let iter = 0; iter < 240; iter++) {
        const base = [...seedBases[iter % seedBases.length]];
        const moves = 2 + (iter % 3);
        for (let m = 0; m < moves; m++) {
          const decIdx = Math.floor(nextRand() * n);
          if (base[decIdx] > bounds[decIdx].min) {
            base[decIdx] -= 1;
          }
        }
        let currCost = base.reduce((acc, q, idx) => acc + q * categories[idx].cost, 0);
        for (let fill = 0; fill < 45; fill++) {
          const candidatesIdx: number[] = [];
          for (let i = 0; i < n; i++) {
            if (base[i] < bounds[i].max && currCost + categories[i].cost <= config.budgetCap) {
              candidatesIdx.push(i);
            }
          }
          if (candidatesIdx.length === 0) break;
          const pick = candidatesIdx[Math.floor(nextRand() * candidatesIdx.length)];
          base[pick] += 1;
          currCost += categories[pick].cost;
        }
        statesEvaluated++;
        evaluate(base, minSpend);
      }
    };

    runPerturbations(defaultMinSpend);
    if (results.length < 5) {
      baseProfiles.forEach((profile) => buildGreedy(profile, 0));
      runPerturbations(0);
    }
  }

  // Exact deduplication by quantity vector
  const unique = new Map<string, RawCandidate>();
  results.forEach((r) => {
    const k = r.counts.join('-');
    if (!unique.has(k)) unique.set(k, r);
  });

  const sorted = Array.from(unique.values()).sort((a, b) => {
    if (objective === 'highest_profit') {
      return b.prof100 - a.prof100 || b.marginPct - a.marginPct || b.avgBeauty - a.avgBeauty;
    }
    if (objective === 'best_appeal') {
      return b.avgBeauty - a.avgBeauty || b.prof100 - a.prof100;
    }
    if (objective === 'balanced_variety') {
      return b.score - a.score || b.evenness - a.evenness || b.prof100 - a.prof100;
    }
    if (objective === 'lowest_risk') {
      return (
        b.score - a.score ||
        a.breakEvenSellThroughPct - b.breakEvenSellThroughPct ||
        a.unsoldRiskCost - b.unsoldRiskCost
      );
    }
    if (objective === 'best_budget_use') {
      return b.cost - a.cost || b.prof100 - a.prof100;
    }
    if (objective === 'conservative_sales') {
      return b.prof90 - a.prof90 || b.prof70 - a.prof70 || b.avgBeauty - a.avgBeauty;
    }
    if (objective === 'high_footfall') {
      return b.score - a.score || b.pieces - a.pieces || b.avgBeauty - a.avgBeauty;
    }
    if (objective === 'small_budget') {
      return b.score - a.score || a.avgUnitCost - b.avgUnitCost || b.distinctItemsCount - a.distinctItemsCount;
    }
    return b.score - a.score || b.prof100 - a.prof100;
  });

  // Pareto-style diversity filtering so users see genuinely distinct trade-offs
  const diverse: RawCandidate[] = [];
  for (const cand of sorted) {
    if (diverse.length >= maxResults) break;
    if (isParetoOrDiverse(cand, diverse, n, objective) || sorted.length <= maxResults) {
      diverse.push(cand);
    }
  }

  // Fill remaining slots if strict diversity left fewer than requested and distinct candidates exist
  if (diverse.length < Math.min(maxResults, sorted.length)) {
    const pickedKeys = new Set(diverse.map((d) => d.counts.join('-')));
    for (const cand of sorted) {
      if (diverse.length >= maxResults) break;
      const k = cand.counts.join('-');
      if (!pickedKeys.has(k)) {
        diverse.push(cand);
        pickedKeys.add(k);
      }
    }
  }

  if (diverse.length === 0) {
    return {
      combos: [],
      meta: {
        searchMode,
        statesEvaluated,
        candidateCount: 0,
        truncated,
        maxStates,
        objective,
      },
    };
  }

  const maxProf = Math.max(...diverse.map((d) => d.prof100));
  const maxBeauty = Math.max(...diverse.map((d) => d.avgBeauty));
  const maxEven = Math.max(...diverse.map((d) => d.evenness));
  const maxProf90 = Math.max(...diverse.map((d) => d.prof90));
  const minBreakEven = Math.min(...diverse.map((d) => d.breakEvenSellThroughPct));
  const maxPieces = Math.max(...diverse.map((d) => d.pieces));
  const maxCost = Math.max(...diverse.map((d) => d.cost));

  const combos: BangleCombo[] = diverse.map((item, i) => {
    let badge = TAG_POOL[i % TAG_POOL.length];
    let reason = `Expected profit +₹${item.prof100.toLocaleString('en-IN')} at 100% sales (+₹${item.prof90.toLocaleString('en-IN')} at ${safePct}%) with ${item.avgBeauty}/10 appeal.`;

    if (i === 0) {
      if (objective === 'highest_profit') {
        badge = 'Top Profit';
        reason = `Highest expected profit (+₹${item.prof100.toLocaleString('en-IN')}, ${item.marginPct}% markup margin) within ₹${config.budgetCap.toLocaleString('en-IN')}.`;
      } else if (objective === 'best_appeal') {
        badge = 'Top Appeal';
        reason = `Highest customer appeal (${item.avgBeauty}/10 across ${item.pieces} pcs); ${safePct}% sales yields +₹${item.prof90.toLocaleString('en-IN')}.`;
      } else if (objective === 'lowest_risk') {
        badge = 'Lowest Risk';
        reason = `Breaks even at ${item.breakEvenSellThroughPct}% sold with ₹${item.unsoldRiskCost.toLocaleString('en-IN')} estimated unsold stock cost at ${safePct}% sales.`;
      } else if (objective === 'balanced_variety') {
        badge = 'Balanced Variety';
        reason = `Even product spread (${item.evenness}/10 across ${item.distinctItemsCount}/${n} items) while delivering +₹${item.prof100.toLocaleString('en-IN')} profit.`;
      } else if (objective === 'best_budget_use') {
        badge = 'Best Budget Fit';
        reason = `Uses ${item.budgetUtilizationPct}% (₹${item.cost.toLocaleString('en-IN')}) of your ₹${config.budgetCap.toLocaleString('en-IN')} budget for +₹${item.prof100.toLocaleString('en-IN')} profit.`;
      } else if (objective === 'conservative_sales') {
        badge = 'Conservative Safe';
        reason = `Strongest conservative buffer (+₹${item.prof90.toLocaleString('en-IN')} at ${safePct}% sales; break-even ${item.breakEvenSellThroughPct}%).`;
      } else if (objective === 'high_footfall') {
        badge = 'Crowd Ready';
        reason = `High volume (${item.pieces} pcs) at accessible average price ₹${Math.round(item.avgSellPrice).toLocaleString('en-IN')} for busy crowds.`;
      } else if (objective === 'small_budget') {
        badge = 'Lean Budget';
        reason = `Covers ${item.distinctItemsCount}/${n} items at ₹${Math.round(item.avgUnitCost)} avg cost/pc with ${item.breakEvenSellThroughPct}% break-even.`;
      } else {
        badge = 'Best Overall';
        reason = `Strongest all-round balance: +₹${item.prof100.toLocaleString('en-IN')} profit, ${item.avgBeauty}/10 appeal, and ${item.evenness}/10 variety.`;
      }
    } else if (item.prof100 === maxProf) {
      badge = 'Top Profit';
      reason = `Maximum gross profit (+₹${item.prof100.toLocaleString('en-IN')}) within your ₹${config.budgetCap.toLocaleString('en-IN')} budget.`;
    } else if (item.avgBeauty === maxBeauty) {
      badge = 'Top Appeal';
      reason = `Top customer appeal (${item.avgBeauty}/10) across ${item.pieces} pieces.`;
    } else if (item.breakEvenSellThroughPct === minBreakEven) {
      badge = 'Lowest Risk';
      reason = `Lowest break-even threshold (${item.breakEvenSellThroughPct}% sold) with ₹${item.unsoldRiskCost.toLocaleString('en-IN')} unsold-stock risk.`;
    } else if (item.prof90 === maxProf90 && item.prof90 >= config.minProfitFloor) {
      badge = 'Conservative Safe';
      reason = `Strongest ${safePct}% sell-through profit (+₹${item.prof90.toLocaleString('en-IN')}).`;
    } else if (item.evenness === maxEven) {
      badge = 'Balanced Variety';
      reason = `Most even spread (${item.evenness}/10) across ${item.pieces} pieces to avoid overstocking one item.`;
    } else if (item.pieces === maxPieces) {
      badge = 'Crowd Ready';
      reason = `Most total pieces (${item.pieces} pcs) to keep display tables full during peak hours.`;
    } else if (item.cost === maxCost) {
      badge = 'Best Budget Fit';
      reason = `Uses ${item.budgetUtilizationPct}% of budget (₹${item.cost.toLocaleString('en-IN')}) cleanly.`;
    }

    return {
      ...item,
      id: `c_${i + 1}`,
      rank: i + 1,
      label: `#${String(i + 1).padStart(2, '0')}`,
      badge,
      badgeColor: BADGE_STYLE_BY_TYPE[badge] || BADGE_STYLE_BY_TYPE.default,
      sellThroughPct: safePct,
      objective,
      reason,
      keywords: computeKeywords(
        item.counts,
        categories,
        item.avgBeauty,
        item.evenness,
        item.prof90,
        config.minProfitFloor,
        item.budgetUtilizationPct
      ),
    };
  });

  return {
    combos,
    meta: {
      searchMode,
      statesEvaluated,
      candidateCount: unique.size,
      truncated,
      maxStates,
      objective,
    },
  };
}

export function generateBangleCombinations(
  categories: BangleCategory[],
  config: OptimizerConfig,
  rules: OptimizerRules,
  maxResults = 30
): BangleCombo[] {
  return generateStockCombinationsWithMeta(categories, config, rules, maxResults).combos;
}

export function applyCustomQuantities(
  base: BangleCombo,
  customQuantities: number[],
  categories: BangleCategory[],
  minProfitFloor: number,
  conservativeSellThroughPct = 90,
  budgetCap?: number
): BangleCombo {
  const safePct = Math.min(99, Math.max(50, Math.round(conservativeSellThroughPct || 90)));
  const safeRate = safePct / 100;
  let cost = 0;
  let pricedCost = 0;
  let hasUnpricedItems = false;
  let rev100 = 0;
  let revMin100 = 0;
  let revMax100 = 0;
  let pieces = 0;
  let beautySum = 0;
  let distinctItemsCount = 0;

  customQuantities.forEach((q, i) => {
    if (!categories[i] || q <= 0) return;
    distinctItemsCount++;
    const rp = resolveItemPriceBounds(categories[i]);
    const lineCost = q * categories[i].cost;
    cost += lineCost;
    if (rp.target > 0) {
      pricedCost += lineCost;
      rev100 += q * rp.target;
      revMin100 += q * rp.min;
      revMax100 += q * rp.max;
    } else {
      hasUnpricedItems = true;
    }
    pieces += q;
    beautySum += q * categories[i].beauty;
  });

  const costBasis = hasUnpricedItems ? pricedCost : cost;
  const rev90 = Math.round(rev100 * safeRate);
  const prof100 = costBasis > 0 || rev100 > 0 ? rev100 - costBasis : 0;
  const prof90 = costBasis > 0 || rev90 > 0 ? rev90 - costBasis : 0;
  const avgBeauty = pieces > 0 ? Number((beautySum / pieces).toFixed(2)) : 0;
  const mean = categories.length > 0 ? pieces / categories.length : 0;
  const variance =
    categories.length > 0
      ? customQuantities.reduce((a, q) => a + Math.pow(q - mean, 2), 0) / categories.length
      : 0;
  const stdScale = Math.max(1, Math.sqrt(Math.max(1, mean)) * 0.85);
  const evenness = Number(Math.max(1, 10 - (Math.sqrt(variance) / stdScale) * 2.4).toFixed(2));
  const marginPct = rev100 > 0 ? Number(((prof100 / rev100) * 100).toFixed(1)) : 0;
  const unsoldRiskCost = Math.round(cost * (1 - safeRate));
  const breakEvenSellThroughPct = rev100 > 0 ? Math.min(100, Math.ceil((costBasis / rev100) * 100)) : 100;
  const budgetUtilizationPct =
    typeof budgetCap === 'number' && budgetCap > 0
      ? Number(((cost / budgetCap) * 100).toFixed(1))
      : 100;

  let reason =
    rev100 > 0
      ? `Custom quantities: ${pieces} pcs costing ₹${cost.toLocaleString('en-IN')} (${safePct}% profit +₹${prof90.toLocaleString('en-IN')}).`
      : `Custom quantities: ${pieces} pcs costing ₹${cost.toLocaleString('en-IN')} (add selling prices to estimate profit).`;
  if (typeof budgetCap === 'number' && cost > budgetCap) {
    reason = `Custom quantities exceed your ₹${budgetCap.toLocaleString('en-IN')} budget by ₹${(cost - budgetCap).toLocaleString('en-IN')}.`;
  } else if (!hasUnpricedItems && prof100 < minProfitFloor) {
    reason = `Custom quantities are within budget but ₹${(minProfitFloor - prof100).toLocaleString('en-IN')} below your target profit.`;
  }

  return {
    ...base,
    badge: 'Custom Quantities',
    badgeColor: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40',
    counts: customQuantities,
    cost,
    rev100,
    prof100,
    rev90,
    prof90,
    revMin100,
    revMax100,
    profMin100: costBasis > 0 || revMin100 > 0 ? revMin100 - costBasis : 0,
    profMax100: costBasis > 0 || revMax100 > 0 ? revMax100 - costBasis : 0,
    sellThroughPct: safePct,
    unsoldRiskCost,
    breakEvenSellThroughPct,
    budgetUtilizationPct,
    distinctItemsCount,
    reason,
    pieces,
    avgBeauty,
    evenness,
    marginPct,
    keywords: computeKeywords(
      customQuantities,
      categories,
      avgBeauty,
      evenness,
      prof90,
      minProfitFloor,
      budgetUtilizationPct
    ),
    isCustom: true,
  };
}

export function evaluatePlanHealth(
  overviewTotals: DiversifiedOverviewTotals,
  stallTotals?: StallTotals
): PlanHealthSummary {
  const reasons: string[] = [];
  const totalCost = stallTotals ? stallTotals.totalCost : overviewTotals.totalInvestment;
  const totalEventCosts = stallTotals ? stallTotals.totalEventCosts : overviewTotals.totalEventCosts;
  const finalProfitConservative = stallTotals
    ? stallTotals.netAfterStallReal
    : overviewTotals.netProfitConservativeAfterCosts;
  const finalProfitFull = stallTotals
    ? stallTotals.netAfterStall100
    : overviewTotals.netProfit100AfterCosts;
  const breakEvenPct = stallTotals
    ? stallTotals.breakEvenSellThroughPct
    : overviewTotals.breakEvenSellThroughPct;
  const totalPieces = stallTotals ? stallTotals.totalUnits : overviewTotals.totalPieces;

  if (totalPieces === 0 || totalCost === 0) {
    return {
      status: 'risky',
      label: 'Risky',
      headline: 'No active stock selected yet',
      reasons: ['Add products and pick a stock mix in Stock Planner to calculate sales and profit.'],
    };
  }

  const overBudgetBy = overviewTotals.totalInvestment - overviewTotals.totalAllocatedBudget;
  if (overBudgetBy > 0) {
    reasons.push(
      `Selected stock exceeds your total stock budget by ₹${overBudgetBy.toLocaleString('en-IN')}.`
    );
  }

  if (finalProfitFull < 0) {
    reasons.push(
      `Even at 100% sales, your profit does not cover ₹${totalEventCosts.toLocaleString('en-IN')} in event expenses.`
    );
  } else if (finalProfitConservative < 0) {
    reasons.push(
      `At ${overviewTotals.weightedConservativeSellThroughPct}% sales, profit is short of event expenses by ₹${Math.abs(finalProfitConservative).toLocaleString('en-IN')}.`
    );
  }

  if (breakEvenPct > 85) {
    reasons.push(
      `You need to sell ${Math.min(100, Math.round(breakEvenPct))}% of stock just to recover stock and event costs.`
    );
  } else if (breakEvenPct > 70) {
    reasons.push(
      `Break-even requires ${Math.round(breakEvenPct)}% sell-through—leave room for slower hours or bundles.`
    );
  }

  if (finalProfitFull < 0 || overBudgetBy > overviewTotals.totalAllocatedBudget * 0.1 || breakEvenPct > 90) {
    return {
      status: 'risky',
      label: 'Risky',
      headline: 'Costs or break-even target are too tight',
      reasons,
    };
  }

  if (reasons.length > 0 || finalProfitConservative < 1000) {
    if (reasons.length === 0) {
      reasons.push('Profit cushion after event expenses is thin under conservative sales.');
    }
    return {
      status: 'attention',
      label: 'Needs attention',
      headline: 'Profitable at full sales, but tighten your buffer',
      reasons,
    };
  }

  return {
    status: 'healthy',
    label: 'Healthy',
    headline: 'Budget, break-even, and profit buffer look solid',
    reasons: [
      `Break-even at ${Math.round(breakEvenPct)}% of stock (${overviewTotals.unitsToBreakEven} pcs), leaving ₹${finalProfitConservative.toLocaleString('en-IN')} estimated final profit at ${overviewTotals.weightedConservativeSellThroughPct}% sales.`,
    ],
  };
}

export function calculateStallTotals(
  stallStock: StallStockItem[],
  stallFee: number,
  expectedFootfall = 0
): StallTotals {
  let totalCost = 0;
  let otherEventCosts = 0;
  let rev100 = 0;
  let revRealistic = 0;
  let unsoldInventoryCost = 0;
  let totalUnits = 0;
  let topRoiItemName = '—';
  let topRoiPct = -Infinity;

  const itemRows: StallTotals['itemRows'] = [];
  const eventCostRows: StallTotals['eventCostRows'] = [];

  stallStock.forEach((item) => {
    const isExpense = item.itemType === 'event_cost';
    const lineCost = Math.max(0, item.cost) * Math.max(0, item.qty);

    if (isExpense) {
      otherEventCosts += lineCost;
      eventCostRows.push({
        ...item,
        itemType: 'event_cost',
        lineCost,
        lineRev100: 0,
        lineProfit100: -lineCost,
        lineRevReal: 0,
        lineProfitReal: -lineCost,
        roiPct: 0,
        marginPct: 0,
        unitsCount: 0,
      });
      return;
    }

    const lineRev100 = Math.max(0, item.price) * Math.max(0, item.qty);
    const lineProfit100 = lineRev100 - lineCost;
    const clampedSt = Math.min(100, Math.max(0, item.sellThrough));
    const lineRevReal = Math.round(lineRev100 * (clampedSt / 100));
    const lineProfitReal = lineRevReal - lineCost;
    const roiPct = lineCost > 0 ? Number(((lineProfit100 / lineCost) * 100).toFixed(1)) : 0;
    const marginPct = lineRev100 > 0 ? Number(((lineProfit100 / lineRev100) * 100).toFixed(1)) : 0;
    const unitsCount = item.isSyncedBundle ? (item.unitPieces || 17) * item.qty : item.qty;

    totalCost += lineCost;
    rev100 += lineRev100;
    revRealistic += lineRevReal;
    unsoldInventoryCost += Math.round(lineCost * Math.max(0, 1 - clampedSt / 100));
    totalUnits += unitsCount;

    if (roiPct > topRoiPct && lineCost > 0) {
      topRoiPct = roiPct;
      topRoiItemName = item.name;
    }

    itemRows.push({
      ...item,
      itemType: 'stock',
      lineCost,
      lineRev100,
      lineProfit100,
      lineRevReal,
      lineProfitReal,
      roiPct,
      marginPct,
      unitsCount,
    });
  });

  const safeStallFee = Math.max(0, Number(stallFee) || 0);
  const totalEventCosts = safeStallFee + otherEventCosts;
  const grossProfit100 = rev100 - totalCost;
  const grossProfitReal = revRealistic - totalCost;
  const netAfterStall100 = grossProfit100 - totalEventCosts;
  const netAfterStallReal = grossProfitReal - totalEventCosts;
  const totalOutlay = totalCost + totalEventCosts;
  const breakEvenCoveragePct = Math.min(
    100,
    Math.max(0, Math.round((revRealistic / Math.max(1, totalOutlay)) * 100))
  );
  const breakEvenSellThroughPct =
    rev100 > 0 ? Math.min(999, Number(((totalOutlay / rev100) * 100).toFixed(1))) : 100;
  const avgItemPrice = totalUnits > 0 ? Math.round(rev100 / totalUnits) : 220;
  const unitsToBreakEven =
    totalUnits > 0 && rev100 > 0
      ? Math.min(totalUnits, Math.ceil(totalOutlay / Math.max(1, rev100 / totalUnits)))
      : 0;
  const footfallConversionNeeded =
    expectedFootfall > 0
      ? Number(((unitsToBreakEven / expectedFootfall) * 100).toFixed(2))
      : 0;
  const blendedMarginPct =
    revRealistic > 0 ? Number(((grossProfitReal / revRealistic) * 100).toFixed(1)) : 0;
  const capitalMultiple =
    totalOutlay > 0 ? Number((revRealistic / totalOutlay).toFixed(2)) : 0;
  const rentBurdenPct =
    grossProfitReal > 0
      ? Math.min(100, Number(((totalEventCosts / grossProfitReal) * 100).toFixed(1)))
      : totalEventCosts > 0
        ? 100
        : 0;
  const weightedSellThroughPct =
    rev100 > 0 ? Math.round((revRealistic / rev100) * 100) : 90;

  return {
    itemRows,
    eventCostRows,
    totalCost,
    otherEventCosts,
    totalEventCosts,
    totalOutlay,
    rev100,
    revRealistic,
    grossProfit100,
    grossProfitReal,
    netAfterStall100,
    netAfterStallReal,
    unsoldInventoryCost,
    weightedSellThroughPct,
    totalUnits,
    breakEvenCoveragePct,
    breakEvenSellThroughPct,
    unitsToBreakEven,
    footfallConversionNeeded,
    blendedMarginPct,
    capitalMultiple,
    rentBurdenPct,
    avgItemPrice,
    topRoiItemName,
    topRoiPct: topRoiPct === -Infinity ? 0 : topRoiPct,
  };
}

export function parseLocalRawCommand(
  rawText: string,
  categories: BangleCategory[],
  globalSellThrough: number
): LocalParseResult {
  const lower = rawText.toLowerCase();
  const changes: string[] = [];
  const result: LocalParseResult = {
    ruleUpdates: {},
    categoryUpdates: [],
    stockAdditions: [],
    changes,
  };

  const budgetMatch = lower.match(/budget\s*(?:of|is|to|=)?\s*₹?\s*(\d{3,7})/);
  if (budgetMatch) {
    const val = Number(budgetMatch[1]);
    result.budgetCap = val;
    changes.push(`Budget → ₹${val}`);
  }

  const profitMatch = lower.match(/(?:profit|floor)\s*(?:above|atleast|at least|min|to|=)?\s*₹?\s*(\d{3,7})/);
  if (profitMatch) {
    const val = Number(profitMatch[1]);
    result.minProfitFloor = val;
    changes.push(`Min Profit → ₹${val}`);
  }

  const stallMatch = lower.match(/(?:stall|event)\s*(?:fee|cost|rent)?\s*(?:is|to|=)?\s*₹?\s*(\d{2,7})/);
  if (stallMatch) {
    const val = Number(stallMatch[1]);
    result.stallFee = val;
    changes.push(`Stall Fee → ₹${val}`);
  }

  const crowdMatch = lower.match(/(?:crowd|footfall|visitors)\s*(?:of|is|at|around|=)?\s*(\d{2,7})/);
  if (crowdMatch) {
    const val = Number(crowdMatch[1]);
    result.expectedFootfall = val;
    changes.push(`Visitors → ${val.toLocaleString('en-IN')}`);
  }

  const maxMatch = lower.match(
    /(?:max|cap)\s*(\d{1,3})\s*(?:cuff|cuffs|each|per item)?|(?:max|cap)\s*(?:cuff|cuffs|each|per item)\s*(?:at|to|=)?\s*(\d{1,3})/
  );
  if (maxMatch) {
    const val = Number(maxMatch[1] || maxMatch[2]);
    if (val >= 2) {
      result.maxPerCategory = val;
      result.ruleUpdates.evenDistribution = true;
      changes.push(`Max per item → ${val}`);
    }
  }

  const minColMatch = lower.match(/min\s*(\d{1,2})\s*colours?/);
  if (minColMatch) {
    const val = Number(minColMatch[1]);
    result.minColoursRule = val;
    changes.push(`Min Colours → ${val}`);
  }

  if (lower.includes('all 6') || lower.includes('all categories') || lower.includes('atleast 1') || lower.includes('at least 1')) {
    result.ruleUpdates.allAtLeastOne = true;
    changes.push('All items included');
  }
  if (lower.includes('even') || lower.includes('spread') || lower.includes('balance')) {
    result.ruleUpdates.evenDistribution = true;
    result.objective = 'balanced_variety';
    changes.push('Balanced variety focus');
  }
  if (lower.includes('high beauty') || lower.includes('beauty first') || lower.includes('best appeal')) {
    result.ruleUpdates.beautyFirst = true;
    result.ruleUpdates.maxProfitFocus = false;
    result.objective = 'best_appeal';
    changes.push('Best customer appeal focus');
  }
  if (lower.includes('max profit') || lower.includes('highest profit')) {
    result.ruleUpdates.maxProfitFocus = true;
    result.ruleUpdates.beautyFirst = false;
    result.objective = 'highest_profit';
    changes.push('Highest profit focus');
  }
  if (lower.includes('lowest risk') || lower.includes('low risk')) {
    result.objective = 'lowest_risk';
    changes.push('Lowest risk focus');
  }
  if (lower.includes('high footfall') || lower.includes('busy crowd')) {
    result.objective = 'high_footfall';
    changes.push('High footfall focus');
  }
  if (lower.includes('small budget') || lower.includes('tight budget')) {
    result.objective = 'small_budget';
    changes.push('Small budget focus');
  }
  if (lower.includes('90%') || lower.includes('conservative')) {
    result.ruleUpdates.safe90Mode = true;
    result.objective = 'conservative_sales';
    changes.push('Conservative sales focus');
  }

  if (
    /\b(open|go to|show|switch to|view)\b.*\b(overview|summary|home|dashboard|expenses|profit)\b/.test(lower) ||
    lower === 'overview'
  ) {
    result.navigateToTab = 'overview';
    changes.push('Section → Overview');
  } else if (
    /\b(open|go to|show|switch to|view)\b.*\b(research|market|trends|competitor)\b/.test(lower) ||
    lower === 'research' ||
    lower === 'market research'
  ) {
    result.navigateToTab = 'research';
    changes.push('Section → Market Research');
  } else if (
    /\b(open|go to|show|switch to|view)\b.*\b(setup|stall setup|playbook|strategy|strategies|layout)\b/.test(lower) ||
    lower === 'playbook' ||
    lower === 'stall setup'
  ) {
    result.navigateToTab = 'strategies';
    changes.push('Section → Stall Setup');
  } else if (
    /\b(open|go to|show|switch to|view)\b.*\b(stock|planner|categories|category|optimizer|mixes)\b/.test(lower) ||
    lower === 'stock planner'
  ) {
    result.navigateToTab = 'optimizer';
    changes.push('Section → Stock Planner');
  }

  const mixRankMatch = lower.match(/(?:mix|option|combo|combination)\s*#?\s*(\d{1,2})/);
  if (mixRankMatch) {
    const rank = Number(mixRankMatch[1]);
    if (rank >= 1 && rank <= 20) {
      result.selectComboRank = rank;
      changes.push(`Selected Combination #${rank}`);
    }
  }

  const eventCostMatch = rawText.match(
    /(?:add|include)\s+(?:event\s+cost|expense)\s+([a-zA-Z0-9\s&/]+?)\s+₹?\s*(\d{2,6})/i
  );
  if (eventCostMatch) {
    const expName = eventCostMatch[1].trim();
    const expCost = Number(eventCostMatch[2]);
    if (expName && expCost >= 0) {
      result.eventCostAdditions = [{ name: expName, cost: expCost }];
      changes.push(`Event Expense: ${expName} (₹${expCost})`);
    }
  }

  categories.forEach((cat) => {
    const cKey = (cat.shortName || cat.name).toLowerCase();
    if (!lower.includes(cKey)) return;
    const costRegex = new RegExp(`${cKey}[^,.;]*?cost\\s*₹?\\s*(\\d{2,4})`, 'i');
    const sellRegex = new RegExp(`${cKey}[^,.;]*?(?:sell|price)\\s*₹?\\s*(\\d{2,4})`, 'i');
    const beautyRegex = new RegExp(`${cKey}[^,.;]*?(?:beauty|appeal|star|score)\\s*(\\d+(?:\\.\\d+)?)`, 'i');
    const cM = rawText.match(costRegex);
    const sM = rawText.match(sellRegex);
    const bM = rawText.match(beautyRegex);

    if (cM || sM || bM) {
      const update: { id: string; cost?: number; price?: number; beauty?: number } = { id: cat.id };
      if (cM) {
        update.cost = Number(cM[1]);
        changes.push(`${cat.shortName || cat.name} Cost → ₹${cM[1]}`);
      }
      if (sM) {
        update.price = Number(sM[1]);
        changes.push(`${cat.shortName || cat.name} Sell → ₹${sM[1]}`);
      }
      if (bM) {
        update.beauty = Math.min(10, Math.max(1, Number(bM[1])));
        changes.push(`${cat.shortName || cat.name} Appeal → ${update.beauty}/10`);
      }
      result.categoryUpdates.push(update);
    }
  });

  const addMatch = rawText.match(
    /add\s+([a-zA-Z\s]+?)\s+cost\s*₹?\s*(\d+)\s*(?:sell|price)\s*₹?\s*(\d+)(?:.*?qty\s*(\d+))?/i
  );
  if (addMatch) {
    const itemName = addMatch[1].trim();
    const itemCost = Number(addMatch[2]);
    const itemPrice = Number(addMatch[3]);
    const itemQty = addMatch[4] ? Number(addMatch[4]) : 25;
    const formattedName = itemName
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    result.stockAdditions.push({
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: formattedName,
      category: 'Custom',
      cost: itemCost,
      price: itemPrice,
      qty: itemQty,
      sellThrough: globalSellThrough,
      isSyncedBundle: false,
      itemType: 'stock',
    });
    changes.push(`Added ${itemQty}x ${formattedName} (₹${itemCost}→₹${itemPrice})`);
  }

  return result;
}

export function resolveCategoryGroups(groups: StockCategoryGroup[]): CategoryGroupResolved[] {
  return groups.map((group) => {
    const safePct = group.conservativeSellThroughPct ?? 90;
    const hasPricedProducts = group.categories.some((c) => c.price > 0 && c.cost > 0);
    const { combos, meta } =
      group.categories.length > 0 && group.budgetCap > 0 && hasPricedProducts
        ? generateStockCombinationsWithMeta(
            group.categories,
            {
              budgetCap: group.budgetCap,
              minProfitFloor: group.minProfitFloor,
              maxPerCategory: group.maxPerCategory,
              minColoursRule: group.minColoursRule,
              conservativeSellThroughPct: safePct,
              objective: group.objective || 'best_overall',
              priorityWeights: group.priorityWeights,
            },
            group.rules,
            30
          )
        : {
            combos: [] as BangleCombo[],
            meta: {
              searchMode: 'exact' as const,
              statesEvaluated: 0,
              candidateCount: 0,
              truncated: false,
              maxStates: 0,
              objective: group.objective || 'best_overall',
            },
          };

    const base =
      combos.find((c) => c.id === group.selectedComboId) || combos[0] || null;
    const fallbackBase: BangleCombo = {
      id: 'planned',
      rank: 0,
      label: 'Planned',
      badge: 'Planned Quantities',
      keywords: [],
      badgeColor: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40',
      counts: new Array(group.categories.length).fill(0),
      cost: 0,
      rev100: 0,
      prof100: 0,
      rev90: 0,
      prof90: 0,
      sellThroughPct: safePct,
      unsoldRiskCost: 0,
      breakEvenSellThroughPct: 100,
      reason: '',
      pieces: 0,
      avgBeauty: 0,
      evenness: 0,
      marginPct: 0,
      score: 0,
      isCustom: true,
    };

    const plannedCounts = group.categories.map((c) => Math.max(0, Math.round(c.plannedQty || 0)));
    const hasPlannedCounts = plannedCounts.some((q) => q > 0);

    let activeCombo: BangleCombo | null = null;
    if (group.customQuantities && group.customQuantities.length === group.categories.length) {
      activeCombo = applyCustomQuantities(
        base || fallbackBase,
        group.customQuantities,
        group.categories,
        group.minProfitFloor,
        safePct,
        group.budgetCap > 0 ? group.budgetCap : undefined
      );
    } else if (base && (group.selectedComboId !== null || !hasPlannedCounts)) {
      activeCombo = base;
    } else if (hasPlannedCounts) {
      activeCombo = {
        ...applyCustomQuantities(
          fallbackBase,
          plannedCounts,
          group.categories,
          group.minProfitFloor,
          safePct,
          group.budgetCap > 0 ? group.budgetCap : undefined
        ),
        badge: 'Planned Stock',
        label: 'Planned',
      };
    }

    return {
      group,
      combos,
      activeCombo,
      searchMeta: meta,
    };
  });
}

export function computeDiversifiedOverviewTotals(
  resolvedGroups: CategoryGroupResolved[],
  totalEventCosts = 0,
  expectedFootfall = 0
): DiversifiedOverviewTotals {
  let totalAllocatedBudget = 0;
  let totalInvestment = 0;
  let totalRevenue100 = 0;
  let totalRevenue90 = 0;
  let totalProfit100 = 0;
  let totalProfit90 = 0;
  let unsoldInventoryCostConservative = 0;
  let totalPieces = 0;
  let weightedBeautySum = 0;

  resolvedGroups.forEach(({ group, activeCombo }) => {
    totalAllocatedBudget += group.budgetCap;
    if (!activeCombo) return;
    totalInvestment += activeCombo.cost;
    totalRevenue100 += activeCombo.rev100;
    totalRevenue90 += activeCombo.rev90;
    totalProfit100 += activeCombo.prof100;
    totalProfit90 += activeCombo.prof90;
    unsoldInventoryCostConservative += activeCombo.unsoldRiskCost;
    totalPieces += activeCombo.pieces;
    weightedBeautySum += activeCombo.avgBeauty * activeCombo.pieces;
  });

  const weightedBeauty =
    totalPieces > 0 ? Number((weightedBeautySum / totalPieces).toFixed(2)) : 0;
  const blendedMarginPct =
    totalRevenue100 > 0
      ? Number(((totalProfit100 / totalRevenue100) * 100).toFixed(1))
      : 0;
  const weightedConservativeSellThroughPct =
    totalRevenue100 > 0 ? Math.round((totalRevenue90 / totalRevenue100) * 100) : 90;

  const safeEventCosts = Math.max(0, Number(totalEventCosts) || 0);
  const totalOutlay = totalInvestment + safeEventCosts;
  const netProfit100AfterCosts = totalProfit100 - safeEventCosts;
  const netProfitConservativeAfterCosts = totalProfit90 - safeEventCosts;
  const breakEvenSellThroughPct =
    totalRevenue100 > 0
      ? Math.min(999, Number(((totalOutlay / totalRevenue100) * 100).toFixed(1)))
      : 0;
  const unitsToBreakEven =
    totalPieces > 0 && totalRevenue100 > 0
      ? Math.min(totalPieces, Math.ceil(totalOutlay / Math.max(1, totalRevenue100 / totalPieces)))
      : 0;
  const footfallConversionNeeded =
    expectedFootfall > 0
      ? Number(((unitsToBreakEven / expectedFootfall) * 100).toFixed(2))
      : 0;

  return {
    totalAllocatedBudget,
    totalInvestment,
    totalRevenue100,
    totalRevenue90,
    totalProfit100,
    totalProfit90,
    totalPieces,
    weightedBeauty,
    blendedMarginPct,
    weightedConservativeSellThroughPct,
    unsoldInventoryCostConservative,
    totalEventCosts: safeEventCosts,
    totalOutlay,
    netProfit100AfterCosts,
    netProfitConservativeAfterCosts,
    breakEvenSellThroughPct,
    unitsToBreakEven,
    footfallConversionNeeded,
  };
}

export function syncCategoryGroupsToStallStock(
  resolvedGroups: CategoryGroupResolved[],
  existingStock: StallStockItem[],
  globalSellThrough = 90
): StallStockItem[] {
  const existingBundlesByGroup = new Map<string, StallStockItem>();
  const activeGroupIds = new Set(resolvedGroups.map((rg) => rg.group.id));

  existingStock.forEach((item) => {
    if (!item.isSyncedBundle || item.itemType === 'event_cost') return;
    const key =
      item.groupId ||
      (item.id === 's_bangles' ? 'grp_bangles' : item.id.replace(/^sync_/, ''));
    if (key && activeGroupIds.has(key) && !existingBundlesByGroup.has(key)) {
      existingBundlesByGroup.set(key, item);
    }
  });

  const seenSyncedIds = new Set<string>();
  const syncedRows: StallStockItem[] = resolvedGroups
    .filter((rg) => rg.activeCombo !== null && (rg.activeCombo.pieces > 0 || rg.activeCombo.cost > 0))
    .map(({ group, activeCombo }) => {
      const prev = existingBundlesByGroup.get(group.id);
      const combo = activeCombo!;
      const canonicalId = `sync_${group.id}`;
      seenSyncedIds.add(canonicalId);
      const usePrevSellThrough = Boolean(prev && prev.sellThroughManual);
      return {
        id: canonicalId,
        name: `${group.name} Mix (${combo.label} · ${combo.pieces} pcs)`,
        category: group.name,
        cost: combo.cost,
        price: combo.rev100,
        qty: prev ? Math.max(1, prev.qty) : 1,
        sellThrough: usePrevSellThrough
          ? prev!.sellThrough
          : group.conservativeSellThroughPct ?? combo.sellThroughPct ?? globalSellThrough,
        isSyncedBundle: true,
        unitPieces: combo.pieces,
        groupId: group.id,
        itemType: 'stock',
        ...(usePrevSellThrough ? { sellThroughManual: true } : {}),
      };
    });

  const seenNonSyncedIds = new Set<string>();
  const nonSyncedRows = existingStock.filter((item) => {
    if (item.isSyncedBundle && item.itemType !== 'event_cost') return false;
    if (seenSyncedIds.has(item.id) || seenNonSyncedIds.has(item.id)) return false;
    seenNonSyncedIds.add(item.id);
    return true;
  });

  return [...syncedRows, ...nonSyncedRows];
}
