import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INITIAL_CATEGORY_GROUPS } from '../data/defaults.js';
import {
  calculateStallTotals,
  computeDiversifiedOverviewTotals,
  resolveCategoryGroups,
  syncCategoryGroupsToStallStock,
} from './optimizer.js';
import { hydrateWorkspaceSnapshot } from './accountHelpers.js';
import { applyAiToolAction, executeLocalAiCommand } from './aiActions.js';
import {
  beautyToFiveScale,
  buildSupplierOrderCsv,
  computeActualSalesSummary,
  computeEventReadiness,
  computePurchaseProgressSummary,
  computeSmartAlerts,
  createEmptyProjectSnapshot,
  createSavedPlanSnapshot,
  detectSavedPlanOutdatedPrices,
  fiveScaleToBeauty,
  formatCategoryPurchaseOrder,
  formatFullPurchaseOrder,
  makePurchaseItemKey,
} from './orderAndProjectEngine.js';

describe('Supplier-ready Copy Order formatting', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);

  it('formats category order using ONLY wholesale prices and NEVER selling prices or profit', () => {
    const firstGroup = resolved[0];
    const orderText = formatCategoryPurchaseOrder(firstGroup, {
      projectName: 'Diwali Pop-Up',
    });

    assert.match(orderText, /ORDER/);
    assert.match(orderText, /Wholesale price: ₹/);
    assert.match(orderText, /Quantity:/);
    assert.match(orderText, /Subtotal: ₹/);
    assert.match(orderText, /TOTAL ITEMS:/);
    assert.match(orderText, /CATEGORY TOTAL: ₹/);
    assert.doesNotMatch(orderText, /Selling|Profit|Expected Profit|Margin/i);

    // Ensure selling price of first active item does not appear as price
    const activeCounts = firstGroup.activeCombo?.counts || [];
    const firstIncludedIdx = activeCounts.findIndex((q) => q > 0);
    if (firstIncludedIdx >= 0) {
      const cat = firstGroup.group.categories[firstIncludedIdx];
      assert.ok(orderText.includes(cat.name));
      assert.ok(orderText.includes(`Wholesale price: ₹${Math.round(cat.cost).toLocaleString('en-IN')}`));
      if (cat.price !== cat.cost) {
        assert.ok(!orderText.includes(`→₹${cat.price}`));
      }
    }
  });

  it('formats full purchase order across all categories with overall quantity and wholesale total', () => {
    const fullText = formatFullPurchaseOrder(resolved, {
      projectName: 'Grand Casa Expo',
      eventDate: '14–16 Nov',
    });

    assert.match(fullText, /FULL SUPPLIER PURCHASE ORDER — GRAND CASA EXPO/);
    assert.match(fullText, /OVERALL QUANTITY:/);
    assert.match(fullText, /OVERALL WHOLESALE TOTAL: ₹/);
    assert.doesNotMatch(fullText, /Selling price|Expected profit|Margin/i);
  });

  it('exports supplier order CSV strictly with wholesale columns', () => {
    const csv = buildSupplierOrderCsv(resolved);
    const firstLine = csv.split('\n')[0];
    assert.equal(firstLine, '"Category","Product","Wholesale Price (INR)","Quantity","Subtotal (INR)"');
  });
});

describe('Purchase progress & partial deliveries', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);

  it('accurately computes ordered, partial received, remaining pieces, and unreceived list', () => {
    const g0 = resolved[0];
    const firstIdx = (g0.activeCombo?.counts || []).findIndex((q) => q > 0);
    assert.ok(firstIdx >= 0);
    const cat0 = g0.group.categories[firstIdx];
    const plannedQty0 = g0.activeCombo!.counts[firstIdx];
    const key0 = makePurchaseItemKey(g0.group.id, cat0.id);

    const summary = computePurchaseProgressSummary(resolved, {
      [key0]: {
        status: 'ordered',
        checked: true,
        receivedQty: Math.max(0, plannedQty0 - 1),
        updatedAtMs: Date.now(),
      },
    });

    assert.equal(summary.checkedItemsCount, 1);
    assert.equal(summary.orderedPieces, plannedQty0);
    assert.equal(summary.receivedPieces, Math.max(0, plannedQty0 - 1));
    assert.equal(summary.remainingPieces, summary.totalPlannedPieces - summary.receivedPieces);
    assert.ok(summary.unreceivedItems.some((item) => item.key === key0));
  });
});

describe('Saved Stock Plans & outdated price detection', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);
  const overviewTotals = computeDiversifiedOverviewTotals(resolved, 9000, 10000);

  it('saves immutable snapshot and flags price drift when catalogue edits occur', () => {
    const plan = createSavedPlanSnapshot('Safe Mix v1', resolved, overviewTotals);
    assert.equal(plan.name, 'Safe Mix v1');
    assert.ok(plan.overallPieces > 0);

    const noDrift = detectSavedPlanOutdatedPrices(plan, INITIAL_CATEGORY_GROUPS);
    assert.equal(noDrift.hasOutdatedPrices, false);

    // Mutate a product wholesale cost in a copy of the catalogue
    const editedGroups = INITIAL_CATEGORY_GROUPS.map((g, gi) =>
      gi === 0
        ? {
            ...g,
            categories: g.categories.map((c, ci) =>
              ci === 0 ? { ...c, cost: c.cost + 45 } : c
            ),
          }
        : g
    );

    const drift = detectSavedPlanOutdatedPrices(plan, editedGroups);
    assert.equal(drift.hasOutdatedPrices, true);
    assert.equal(drift.driftedProducts.length, 1);
    assert.equal(drift.driftedProducts[0].currentCost, drift.driftedProducts[0].savedCost + 45);
  });
});

describe('Actual Sales tracking separate from estimated sales', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);

  it('calculates actual revenue, actual estimated profit, remaining stock, and best sellers', () => {
    const g0 = resolved[0];
    const cat0 = g0.group.categories[0];
    const summary = computeActualSalesSummary(
      [
        {
          id: 's1',
          groupId: g0.group.id,
          categoryName: g0.group.name,
          productId: cat0.id,
          productName: cat0.name,
          qtySold: 2,
          actualPricePerUnit: cat0.price + 20,
          unitCost: cat0.cost,
          recordedAtMs: Date.now(),
        },
      ],
      resolved,
      10000
    );

    assert.equal(summary.totalPiecesSold, 2);
    assert.equal(summary.actualRevenue, 2 * (cat0.price + 20));
    assert.equal(summary.actualEstimatedProfit, 2 * (cat0.price + 20 - cat0.cost));
    assert.equal(summary.bestSellers[0].productName, cat0.name);
    assert.ok(summary.remainingStockPieces <= summary.plannedPieces);
  });
});

describe('Zero-demo-data empty project creation & hydration', () => {
  it('createEmptyProjectSnapshot never injects Grand Casa, 10000 footfall, 9000 rent, or sample stock', () => {
    const snap = createEmptyProjectSnapshot({
      projectName: 'Diwali Boutique',
      eventName: 'City Craft Expo',
      type: 'exhibition_stall',
    });

    assert.equal(snap.projectMeta?.name, 'Diwali Boutique');
    assert.equal(snap.eventName, 'City Craft Expo');
    assert.equal(snap.expectedFootfall, 0);
    assert.equal(snap.stallFee, 0);
    assert.equal(snap.budgetCap, 0);
    assert.deepEqual(snap.categoryGroups, []);
    assert.deepEqual(snap.categories, []);
    assert.equal(snap.activeTab, 'optimizer');
    assert.ok(!JSON.stringify(snap).includes('Grand Casa'));
  });

  it('hydrateWorkspaceSnapshot on empty object never injects hardcoded demo values', () => {
    const hydrated = hydrateWorkspaceSnapshot({});
    assert.ok(!hydrated.eventName.includes('Grand Casa'));
    assert.equal(hydrated.expectedFootfall, 0);
    assert.equal(hydrated.stallFee, 0);
    assert.deepEqual(hydrated.categoryGroups, []);
    assert.ok(!JSON.stringify(hydrated).includes('Grand Casa'));
  });

  it('maps 1–5 star appeal scale cleanly to and from internal 1–10 scale', () => {
    for (let stars = 1; stars <= 5; stars += 1) {
      assert.equal(beautyToFiveScale(fiveScaleToBeauty(stars)), stars);
    }
  });
});

describe('AI Coach inventory builder (add_products_to_inventory & local multi-product parser)', () => {
  it('adds single & multiple products, auto-creates missing category, and never invents selling prices', () => {
    const emptySnap = createEmptyProjectSnapshot({
      projectName: 'Weekend Pop-up',
      eventName: 'Sunday Market',
      type: 'popup_shop',
    });

    const res = applyAiToolAction(
      emptySnap,
      'add_products_to_inventory',
      {
        defaultCategoryName: 'Bangles',
        items: [
          { name: 'Oxidised Bangles', purchaseCost: 45, quantity: 20, appealRating: 4 },
          { name: 'Silk Thread Bangles', purchaseCost: 60, sellingPrice: 150, quantity: 15, appealRating: 5 },
        ],
      }
    );

    assert.equal(res.ok, true);
    assert.ok(res.nextState);
    assert.equal(res.nextState.categoryGroups?.length, 1);
    const grp = res.nextState.categoryGroups![0];
    assert.equal(grp.name, 'Bangles');
    assert.equal(grp.categories.length, 2);
    assert.equal(grp.categories[0].name, 'Oxidised Bangles');
    assert.equal(grp.categories[0].cost, 45);
    assert.equal(grp.categories[0].price, 0); // NOT invented!
    assert.equal(grp.categories[0].plannedQty, 20);
    assert.equal(beautyToFiveScale(grp.categories[0].beauty), 4);
    assert.equal(grp.categories[1].price, 150);
  });

  it('parses natural-language multi-product commands and supplier order requests locally', () => {
    const emptySnap = createEmptyProjectSnapshot({
      projectName: 'Festive Stall',
      eventName: 'Festive Mela',
      type: 'exhibition_stall',
    });

    const addRes = executeLocalAiCommand(
      'Create Hair Accessories & add 15 pearl clips at ₹30 each',
      emptySnap
    );
    assert.equal(addRes.ok, true);
    assert.ok(addRes.updatedState);
    assert.equal(addRes.updatedState!.categoryGroups?.length, 1);
    assert.equal(addRes.updatedState!.categoryGroups![0].categories[0].cost, 30);
    assert.equal(addRes.updatedState!.categoryGroups![0].categories[0].plannedQty, 15);

    const orderRes = executeLocalAiCommand(
      'Copy my full supplier order',
      addRes.updatedState!
    );
    assert.equal(orderRes.ok, true);
    assert.ok(orderRes.orderCopyText);
    assert.match(orderRes.orderCopyText!, /FULL SUPPLIER PURCHASE ORDER/);
    assert.doesNotMatch(orderRes.orderCopyText!, /Selling|Expected profit|Margin/i);
  });
});

describe('Event readiness & smart alerts', () => {
  const resolved = resolveCategoryGroups(INITIAL_CATEGORY_GROUPS);
  const stock = syncCategoryGroupsToStallStock(resolved, [], 90);
  const totals = calculateStallTotals(stock, 9000, 10000);
  const purchaseSummary = computePurchaseProgressSummary(resolved, {});

  it('evaluates 7 readiness steps cleanly', () => {
    const readiness = computeEventReadiness({
      eventName: 'Grand Casa',
      eventLocation: 'Siliguri',
      resolvedGroups: resolved,
      totalBudget: 8000,
      purchaseSummary,
      orderPreparedAtMs: Date.now(),
      stallSetup: { widthFt: 8, depthFt: 6, stallType: 'tabletop', layoutStyle: 'classic_u' },
    });
    assert.equal(readiness.totalCount, 7);
    assert.equal(readiness.completedCount, 7);
    assert.equal(readiness.pct, 100);
  });

  it('triggers alerts only when real issues exist', () => {
    // Force a product price below cost
    const brokenGroups = INITIAL_CATEGORY_GROUPS.map((g, gi) =>
      gi === 0
        ? {
            ...g,
            categories: g.categories.map((c, ci) =>
              ci === 0 ? { ...c, cost: 400, price: 250 } : c
            ),
          }
        : g
    );
    const brokenResolved = resolveCategoryGroups(brokenGroups);
    const alerts = computeSmartAlerts({
      resolvedGroups: brokenResolved,
      stallTotals: totals,
      purchaseSummary,
    });
    assert.ok(alerts.some((a) => a.id === 'price_below_cost'));
  });
});
