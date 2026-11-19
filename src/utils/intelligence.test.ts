import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSellThroughScenarios,
  generateStockCombinationsWithMeta,
  getDefaultPriorityWeights,
  resolveCategoryGroups,
} from './optimizer';
import { evaluateProductOpportunity } from './opportunityEngine';
import {
  buildCustomerInteractionScripts,
  buildPlacementRecommendations,
  buildProductBundles,
  buildPricingIdeas,
  calculateDailyTargets,
  LAYOUT_PRESETS,
} from './strategyBuilder';
import { INITIAL_CATEGORY_GROUPS } from '../data/defaults';
import type { MarketResearchRecord, StallSetupPlan } from '../types/stall';

test('custom priorityWeights genuinely shift top-ranked stock combinations', () => {
  const bangles = INITIAL_CATEGORY_GROUPS[0];
  const baseConfig = {
    budgetCap: bangles.budgetCap,
    minProfitFloor: bangles.minProfitFloor,
    maxPerCategory: bangles.maxPerCategory,
    minColoursRule: bangles.minColoursRule,
    conservativeSellThroughPct: 90,
  };

  const profitHeavy = generateStockCombinationsWithMeta(
    bangles.categories,
    {
      ...baseConfig,
      priorityWeights: { profit: 100, variety: 0, appeal: 0, budgetUsage: 10, lowRisk: 0 },
    },
    bangles.rules,
    30
  );

  const appealHeavy = generateStockCombinationsWithMeta(
    bangles.categories,
    {
      ...baseConfig,
      priorityWeights: { profit: 0, variety: 0, appeal: 100, budgetUsage: 10, lowRisk: 0 },
    },
    bangles.rules,
    30
  );

  assert.ok(profitHeavy.combos.length > 10, 'should generate more than 10 distinct combinations');
  assert.ok(appealHeavy.combos.length > 10, 'should generate more than 10 distinct combinations');
  assert.ok(
    profitHeavy.combos[0].prof100 >= appealHeavy.combos[0].prof100,
    'profit-heavy weights should produce >= profit than appeal-heavy weights'
  );
  assert.ok(
    appealHeavy.combos[0].avgBeauty >= profitHeavy.combos[0].avgBeauty,
    'appeal-heavy weights should produce >= appeal than profit-heavy weights'
  );
  // Budget constraint strictly enforced across all generated combinations
  for (const combo of profitHeavy.combos) {
    assert.ok(combo.cost <= bangles.budgetCap, `combo ${combo.id} exceeded budgetCap`);
    assert.ok(combo.reason.length > 10, `combo ${combo.id} must have a data-derived reason`);
  }
});

test('getDefaultPriorityWeights returns valid 0-100 weights for all modes', () => {
  const w = getDefaultPriorityWeights('lowest_risk');
  assert.equal(w.lowRisk, 100);
  assert.ok(w.profit >= 0 && w.profit <= 100);
});

test('buildSellThroughScenarios computes exact 100/90/75/50 scenarios with unsold inventory', () => {
  const scenarios = buildSellThroughScenarios({
    rev100: 20000,
    totalCost: 10000,
    totalEventCosts: 4000,
  });

  assert.equal(scenarios.length, 4);
  assert.deepEqual(
    scenarios.map((s) => s.pct),
    [100, 90, 75, 50]
  );

  const s100 = scenarios[0];
  assert.equal(s100.revenue, 20000);
  assert.equal(s100.grossProfit, 10000);
  assert.equal(s100.finalProfit, 6000);
  assert.equal(s100.unsoldInventoryValue, 0);
  assert.equal(s100.coversBreakEven, true);

  const s50 = scenarios[3];
  assert.equal(s50.revenue, 10000);
  assert.equal(s50.grossProfit, 0);
  assert.equal(s50.finalProfit, -4000);
  assert.equal(s50.unsoldInventoryValue, 5000);
  assert.equal(s50.coversBreakEven, false);
});

test('evaluateProductOpportunity returns insufficient_data when cost or price is missing', () => {
  const res = evaluateProductOpportunity({
    item: { id: 'x1', name: 'Test Item', cost: 0, price: 300, beauty: 8 },
    categoryName: 'Bangles',
    categoryBudget: 3000,
    researchRecords: [],
  });
  assert.equal(res.rating, 'insufficient_data');
  assert.equal(res.ratingLabel, 'Not enough information');
  assert.equal(res.suggestedQtyMin, null);
  assert.ok(res.missingDataHints.length >= 2);
});

test('evaluateProductOpportunity attaches grounded research evidence without fabricating demand', () => {
  const groundedRecord: MarketResearchRecord = {
    id: 'r1',
    query: 'Resin bangles prices in India',
    topic: 'Local price ranges',
    createdAtMs: Date.now(),
    retrievedDate: '2026-11-19',
    grounded: true,
    summary: 'Found live sources',
    verifiedFacts: [
      {
        claim: 'Handmade resin bangles typically sell between ₹350 and ₹550 at craft pop-ups.',
        sourceTitle: 'Craft Bazaar Guide',
        sourceUrl: 'https://example.com/resin',
      },
    ],
    interpretation: [],
    hypothesesToValidate: [],
    checklist: [],
    sources: [{ title: 'Craft Bazaar Guide', uri: 'https://example.com/resin' }],
  };

  const withResearch = evaluateProductOpportunity({
    item: { id: 'w1', name: 'White (Resin)', cost: 220, price: 499, beauty: 9.2 },
    categoryName: 'Bangles',
    categoryBudget: 3000,
    researchRecords: [groundedRecord],
  });

  assert.equal(withResearch.rating, 'strong');
  assert.equal(withResearch.profitPerPiece, 279);
  assert.ok(withResearch.demandEvidence?.includes('Craft Bazaar Guide'));
  assert.ok(withResearch.competitionSignal?.includes('Within sourced range'));
  assert.ok(withResearch.suggestedQtyMin !== null && withResearch.suggestedQtyMin >= 1);

  const withoutResearch = evaluateProductOpportunity({
    item: { id: 'w1', name: 'White (Resin)', cost: 220, price: 499, beauty: 9.2 },
    categoryName: 'Bangles',
    categoryBudget: 3000,
    researchRecords: [],
  });
  assert.equal(withoutResearch.demandEvidence, null);
  assert.equal(withoutResearch.competitionSignal, null);
  assert.ok(
    withoutResearch.missingDataHints.some((h) => h.toLowerCase().includes('market research'))
  );
});

test('buildProductBundles stays profitable by default and warns on excessive discount', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);
  const safeBundles = buildProductBundles(resolved);
  assert.ok(safeBundles.length >= 2);
  for (const b of safeBundles) {
    assert.equal(b.isProfitable, true);
    assert.ok(b.estimatedProfit > 0, `bundle ${b.title} must be profitable`);
    assert.equal(b.bundlePrice, b.combinedSellingPrice - b.discountAmount);
  }

  // Excessive 75% discount should trigger an explicit warning and isProfitable = false
  const unsafeBundles = buildProductBundles(resolved, 75);
  assert.ok(unsafeBundles.some((b) => !b.isProfitable && Boolean(b.warning)));
});

test('buildPlacementRecommendations uses actual inventory & stall dimensions', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);
  const setup: StallSetupPlan = { widthFt: 6, depthFt: 4, stallType: 'tabletop' };
  const advice = buildPlacementRecommendations(resolved, setup);
  assert.equal(advice.length, 8);
  const densityCard = advice.find((a) => a.id === 'avoid_overcrowding');
  assert.ok(densityCard?.recommendation.includes('6×4 ft'));
  assert.ok(LAYOUT_PRESETS.length === 3);

  const pricing = buildPricingIdeas(resolved);
  assert.ok(pricing.length >= 3);
  const scripts = buildCustomerInteractionScripts(resolved, 'Grand Casa');
  assert.equal(scripts.length, 5);
});

test('calculateDailyTargets divides accurately and never invents actual sales', () => {
  const emptyActuals = calculateDailyTargets({
    expectedRevenue: 22000,
    breakEvenSalesAmount: 18000,
    totalPieces: 60,
    breakEvenPieces: 48,
    tracker: { sellingDays: 2 },
  });
  assert.equal(emptyActuals.dailyRevenueTarget, 11000);
  assert.equal(emptyActuals.dailyBreakEvenRevenue, 9000);
  assert.equal(emptyActuals.dailyPiecesTarget, 30);
  assert.equal(emptyActuals.actualRevenue, null);
  assert.equal(emptyActuals.revenueProgressPct, null);

  const withActuals = calculateDailyTargets({
    expectedRevenue: 22000,
    breakEvenSalesAmount: 18000,
    totalPieces: 60,
    breakEvenPieces: 48,
    tracker: { sellingDays: 2, actualRevenueEntered: 11000, actualPiecesEntered: 30 },
  });
  assert.equal(withActuals.revenueProgressPct, 50);
  assert.equal(withActuals.piecesProgressPct, 50);
  assert.equal(withActuals.remainingRevenueToTarget, 11000);
});

test('AI Coach arranges stall layout and opens Stall Setup via tool & local command', async () => {
  const { applyAiToolAction, executeLocalAiCommand } = await import('./aiActions');
  const { syncCategoryGroupsToStallStock } = await import('./optimizer');
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);
  const baseSnapshot = {
    eventName: 'Grand Casa',
    eventLocation: 'Siliguri',
    expectedFootfall: 10000,
    budgetCap: INITIAL_CATEGORY_GROUPS[0].budgetCap,
    minProfitFloor: INITIAL_CATEGORY_GROUPS[0].minProfitFloor,
    stallFee: 9000,
    maxPerCategory: 6,
    minColoursRule: 0,
    globalSellThrough: 90,
    rules: INITIAL_CATEGORY_GROUPS[0].rules,
    categories: INITIAL_CATEGORY_GROUPS[0].categories,
    selectedComboId: 'c_1',
    customQuantities: null,
    stallStock: syncCategoryGroupsToStallStock(resolved, [], 90),
    activeTab: 'overview' as const,
    categoryGroups: INITIAL_CATEGORY_GROUPS,
    activeGroupId: INITIAL_CATEGORY_GROUPS[0].id,
    stallSetup: { widthFt: 8, depthFt: 6, stallType: 'tabletop' as const },
  };

  const toolRes = applyAiToolAction(baseSnapshot, 'configure_planner', {
    layoutStyle: 'open_gallery',
    arrangeStallLayout: true,
    navigateToTab: 'strategies',
  });
  assert.equal(toolRes.ok, true);
  assert.equal(toolRes.nextState.activeTab, 'strategies');
  assert.equal(toolRes.nextState.stallSetup?.layoutStyle, 'open_gallery');
  assert.ok(
    (toolRes.nextState.stallSetup?.zoneCategoryOverrides?.back_riser?.length || 0) >= 1
  );

  const localRes = executeLocalAiCommand('Help me arrange my stall', baseSnapshot);
  assert.equal(localRes.ok, true);
  assert.equal(localRes.updatedState?.activeTab, 'strategies');
  assert.ok(
    (localRes.updatedState?.stallSetup?.zoneCategoryOverrides?.front_left?.length || 0) >= 1
  );
});

test('accountHelpers sanitizes new setup & priority fields with zero undefined keys', async () => {
  const { sanitizeCategoryGroups, sanitizeStallSetup } = await import('./accountHelpers');

  const cleanSetup = sanitizeStallSetup({
    widthFt: 10,
    depthFt: 8,
    stallType: 'corner_booth',
    layoutStyle: 'counter_focus',
    savedLayouts: [
      {
        id: 'l_1',
        name: 'Festive Corner',
        widthFt: 10,
        depthFt: 8,
        stallType: 'corner_booth',
        layoutStyle: 'counter_focus',
        zoneCategoryOverrides: { front_left: ['Bangles'] },
        savedAtMs: Date.now(),
      },
    ],
    dailyTracker: {
      sellingDays: 3,
      actualRevenueEntered: 8500,
    },
  });

  assert.equal(cleanSetup.layoutStyle, 'counter_focus');
  assert.equal(cleanSetup.savedLayouts?.length, 1);
  assert.equal(cleanSetup.dailyTracker?.sellingDays, 3);
  assert.equal(cleanSetup.dailyTracker?.actualRevenueEntered, 8500);
  assert.equal('actualPiecesEntered' in (cleanSetup.dailyTracker || {}), false);

  const cleanGroups = sanitizeCategoryGroups([
    {
      ...INITIAL_CATEGORY_GROUPS[0],
      priorityWeights: { profit: 80, variety: 50, appeal: 70, budgetUsage: 60, lowRisk: 40 },
      savedComboIds: ['c_1', 'c_3'],
    },
  ]);

  assert.deepEqual(cleanGroups[0].savedComboIds, ['c_1', 'c_3']);
  assert.equal(cleanGroups[0].priorityWeights?.profit, 80);
});

