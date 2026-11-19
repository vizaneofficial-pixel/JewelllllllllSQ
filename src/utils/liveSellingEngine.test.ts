import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSaleLineItem,
  checkStockAvailability,
  computeDailySalesReport,
  computeLiveInventoryCatalog,
  correctSaleTransaction,
  createSaleTransaction,
  createSellingSession,
  mergeLiveSalesIntoActualSales,
  mergeSyncedTransactions,
  reverseSaleTransaction,
  validateDiscount,
} from './liveSellingEngine';
import type { CategoryGroupResolved } from '../types/stall';

function makeResolvedGroups(): CategoryGroupResolved[] {
  return [
    {
      group: {
        id: 'grp_bangles',
        name: 'Bangles',
        accentColor: '#8B5CF6',
        budgetCap: 5000,
        minProfitFloor: 0,
        maxPerCategory: 30,
        minColoursRule: 0,
        rules: {
          allAtLeastOne: true,
          evenDistribution: false,
          beautyFirst: false,
          maxProfitFocus: false,
          safe90Mode: false,
        },
        categories: [
          {
            id: 'prod_ox',
            name: 'Oxidised Bangles',
            shortName: 'Oxidised',
            cost: 200,
            price: 500,
            plannedQty: 10,
            beauty: 8,
            barColor: '#8B5CF6',
            textClass: '',
            bgClass: '',
          },
          {
            id: 'prod_last',
            name: 'Kundan Jhumka',
            shortName: 'Jhumka',
            cost: 120,
            price: 300,
            plannedQty: 1,
            beauty: 9,
            barColor: '#EC4899',
            textClass: '',
            bgClass: '',
          },
          {
            id: 'prod_untracked',
            name: 'Handmade Ring',
            shortName: 'Ring',
            cost: 50,
            price: 150,
            // No plannedQty -> untracked stock (NOT zero!)
            beauty: 7,
            barColor: '#34D399',
            textClass: '',
            bgClass: '',
          },
          {
            id: 'prod_zero',
            name: 'Sold Out Cuff',
            shortName: 'Cuff',
            cost: 80,
            price: 220,
            plannedQty: 0, // Explicitly 0 -> tracked sold out
            beauty: 7,
            barColor: '#F59E0B',
            textClass: '',
            bgClass: '',
          },
        ],
        selectedComboId: null,
        customQuantities: null,
      },
      combos: [],
      activeCombo: null,
    },
  ];
}

test('Discount validation enforces fixed rupee deductions and blocks zero/negative final prices', () => {
  // ₹500 product with Full Price, -20, -30, -40, -50
  assert.equal(validateDiscount(500, 0).actualUnitPrice, 500);
  assert.equal(validateDiscount(500, 20).actualUnitPrice, 480);
  assert.equal(validateDiscount(500, 30).actualUnitPrice, 470);
  assert.equal(validateDiscount(500, 40).actualUnitPrice, 460);
  assert.equal(validateDiscount(500, 50).actualUnitPrice, 450);

  // Custom discount valid
  const customOk = validateDiscount(500, 125.5);
  assert.equal(customOk.valid, true);
  assert.equal(customOk.actualUnitPrice, 374.5);

  // Invalid: makes price 0 or negative or negative discount
  assert.equal(validateDiscount(500, 500).valid, false);
  assert.equal(validateDiscount(500, 550).valid, false);
  assert.equal(validateDiscount(500, -10).valid, false);
  assert.equal(validateDiscount(0, 0).valid, false);
});

test('Multi-unit discounted sale calculates exact original, total discount, revenue, COGS, and gross profit without double-discounting', () => {
  // Spec example: 3 units at ₹500 each, ₹30 discount per unit, cost ₹200/unit
  const res = buildSaleLineItem({
    groupId: 'grp_bangles',
    categoryName: 'Bangles',
    productId: 'prod_ox',
    productName: 'Oxidised Bangles',
    quantity: 3,
    originalUnitPrice: 500,
    perUnitDiscount: 30,
    purchaseCostPerUnit: 200,
    stockTracked: true,
  });

  assert.equal(res.error, undefined);
  assert.ok(res.line);
  assert.equal(res.line.originalTotalValue, 1500);
  assert.equal(res.line.totalDiscount, 90);
  assert.equal(res.line.actualUnitPrice, 470);
  assert.equal(res.line.actualTotalRevenue, 1410);
  assert.equal(res.line.totalCogs, 600);
  assert.equal(res.line.realizedGrossProfit, 810);
});

test('Multi-product basket aggregates line items accurately and snapshots product details', () => {
  const { transaction, error } = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    paymentMethod: 'upi',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_ox',
        productName: 'Oxidised Bangles',
        quantity: 2,
        originalUnitPrice: 500,
        perUnitDiscount: 20,
        purchaseCostPerUnit: 200,
        stockTracked: true,
      },
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_untracked',
        productName: 'Handmade Ring',
        quantity: 1,
        originalUnitPrice: 150,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 50,
        stockTracked: false,
      },
    ],
  });

  assert.equal(error, undefined);
  assert.ok(transaction);
  assert.equal(transaction.isBasket, true);
  assert.equal(transaction.totalQuantity, 3);
  assert.equal(transaction.originalTotalValue, 1150);
  assert.equal(transaction.totalDiscount, 40);
  assert.equal(transaction.actualTotalRevenue, 1110);
  assert.equal(transaction.totalCogs, 450);
  assert.equal(transaction.realizedGrossProfit, 660);
  assert.equal(transaction.paymentMethod, 'upi');
});

test('Inventory catalog distinguishes tracked, untracked, last-unit, and sold-out stock accurately', () => {
  const groups = makeResolvedGroups();
  const catalogBefore = computeLiveInventoryCatalog({
    resolvedGroups: groups,
    transactions: [],
  });

  const ox = catalogBefore.find((c) => c.productId === 'prod_ox')!;
  const last = catalogBefore.find((c) => c.productId === 'prod_last')!;
  const untracked = catalogBefore.find((c) => c.productId === 'prod_untracked')!;
  const zero = catalogBefore.find((c) => c.productId === 'prod_zero')!;

  assert.equal(ox.isStockTracked, true);
  assert.equal(ox.availableQty, 10);
  assert.equal(ox.isSoldOut, false);

  assert.equal(last.availableQty, 1);
  assert.equal(checkStockAvailability(last, 1).allowed, true);
  assert.equal(checkStockAvailability(last, 2).allowed, false);

  // Untracked product must NOT be treated as 0 / sold out
  assert.equal(untracked.isStockTracked, false);
  assert.equal(untracked.availableQty, null);
  assert.equal(untracked.isSoldOut, false);
  assert.equal(checkStockAvailability(untracked, 5).allowed, true);

  // Explicit 0 plannedQty IS sold out
  assert.equal(zero.isStockTracked, true);
  assert.equal(zero.availableQty, 0);
  assert.equal(zero.isSoldOut, true);
  assert.equal(checkStockAvailability(zero, 1).allowed, false);

  // Sell the last unit of Kundan Jhumka -> becomes sold out
  const { transaction: sale1 } = createSaleTransaction({
    userId: 'guest',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_last',
        productName: 'Kundan Jhumka',
        quantity: 1,
        originalUnitPrice: 300,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 120,
        stockTracked: true,
      },
    ],
  });

  const catalogAfter = computeLiveInventoryCatalog({
    resolvedGroups: groups,
    transactions: [sale1!],
  });
  const lastAfter = catalogAfter.find((c) => c.productId === 'prod_last')!;
  assert.equal(lastAfter.availableQty, 0);
  assert.equal(lastAfter.soldQty, 1);
  assert.equal(lastAfter.isSoldOut, true);
  assert.equal(checkStockAvailability(lastAfter, 1).allowed, false);
});

test('Instant undo / reversal restores stock, excludes cancelled sales from report, and prevents duplicate reversals', () => {
  const groups = makeResolvedGroups();
  const { transaction: sale1 } = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    paymentMethod: 'cash',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_ox',
        productName: 'Oxidised Bangles',
        quantity: 2,
        originalUnitPrice: 500,
        perUnitDiscount: 50,
        purchaseCostPerUnit: 200,
        stockTracked: true,
      },
    ],
  });

  const rev1 = reverseSaleTransaction([sale1!], sale1!.id, {
    userId: 'user_1',
    reason: 'Instant undo',
  });
  assert.equal(rev1.error, undefined);
  assert.equal(rev1.nextTransactions.length, 2); // Original marked reversed + reversal audit record

  // Duplicate reversal attempt is blocked
  const rev2 = reverseSaleTransaction(rev1.nextTransactions, sale1!.id, {
    userId: 'user_1',
    reason: 'Duplicate undo',
  });
  assert.ok(rev2.error);
  assert.equal(rev2.nextTransactions.length, 2);

  // Stock is fully restored back to 10
  const catalog = computeLiveInventoryCatalog({
    resolvedGroups: groups,
    transactions: rev1.nextTransactions,
  });
  assert.equal(catalog.find((c) => c.productId === 'prod_ox')!.availableQty, 10);

  // Daily report excludes reversed transaction from revenue and valid units
  const report = computeDailySalesReport({
    transactions: rev1.nextTransactions,
    inventoryCatalog: catalog,
    sessionId: 'sess_1',
  });
  assert.equal(report.totalUnitsSold, 0);
  assert.equal(report.transactionCount, 0);
  assert.equal(report.actualRevenue, 0);
  assert.equal(report.realizedGrossProfit, 0);
  assert.equal(report.reversedCount, 1);
});

test('Transaction correction supersedes original while preserving audit trail and accurate totals', () => {
  const groups = makeResolvedGroups();
  const { transaction: sale1 } = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    paymentMethod: 'unrecorded',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_ox',
        productName: 'Oxidised Bangles',
        quantity: 2,
        originalUnitPrice: 500,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 200,
        stockTracked: true,
      },
    ],
  });

  // Correct from qty 2 full price (unrecorded) -> qty 1 with ₹40 discount paid via UPI
  const corr = correctSaleTransaction([sale1!], sale1!.id, {
    userId: 'user_1',
    paymentMethod: 'upi',
    reason: 'Customer bought 1 piece with ₹40 discount',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_ox',
        productName: 'Oxidised Bangles',
        quantity: 1,
        originalUnitPrice: 500,
        perUnitDiscount: 40,
        purchaseCostPerUnit: 200,
        stockTracked: true,
      },
    ],
  });

  assert.equal(corr.error, undefined);
  assert.equal(corr.nextTransactions.length, 2);
  assert.equal(corr.updatedOriginal?.status, 'corrected');
  assert.equal(corr.correctionRecord?.correctionOfTransactionId, sale1!.id);

  const catalog = computeLiveInventoryCatalog({
    resolvedGroups: groups,
    transactions: corr.nextTransactions,
  });
  assert.equal(catalog.find((c) => c.productId === 'prod_ox')!.availableQty, 9);

  const report = computeDailySalesReport({
    transactions: corr.nextTransactions,
    inventoryCatalog: catalog,
    sessionId: 'sess_1',
  });
  assert.equal(report.totalUnitsSold, 1);
  assert.equal(report.transactionCount, 1);
  assert.equal(report.actualRevenue, 460);
  assert.equal(report.totalDiscounts, 40);
  assert.equal(report.realizedGrossProfit, 260);
  assert.equal(report.paymentBreakdown.upi.revenue, 460);
  assert.equal(report.paymentBreakdown.unrecorded.revenue, 0);
});

test('Daily report computes all 10 metrics and keeps unrecorded payment separate from Cash/UPI', () => {
  const groups = makeResolvedGroups();
  const sess = createSellingSession('proj_1', []);
  const s1 = createSaleTransaction({
    userId: 'guest',
    projectId: 'proj_1',
    sessionId: sess.id,
    paymentMethod: 'unrecorded',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_ox',
        productName: 'Oxidised Bangles',
        quantity: 2,
        originalUnitPrice: 500,
        perUnitDiscount: 50,
        purchaseCostPerUnit: 200,
        stockTracked: true,
      },
    ],
  }).transaction!;
  const s2 = createSaleTransaction({
    userId: 'guest',
    projectId: 'proj_1',
    sessionId: sess.id,
    paymentMethod: 'cash',
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_untracked',
        productName: 'Handmade Ring',
        quantity: 1,
        originalUnitPrice: 150,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 50,
        stockTracked: false,
      },
    ],
  }).transaction!;

  const txns = [s2, s1];
  const catalog = computeLiveInventoryCatalog({
    resolvedGroups: groups,
    transactions: txns,
  });
  const report = computeDailySalesReport({
    transactions: txns,
    inventoryCatalog: catalog,
    sessionId: sess.id,
    sessionLabel: sess.label,
  });

  assert.equal(report.totalUnitsSold, 3);
  assert.equal(report.transactionCount, 2);
  assert.equal(report.originalSalesValue, 1150);
  assert.equal(report.totalDiscounts, 100);
  assert.equal(report.actualRevenue, 1050);
  assert.equal(report.costOfGoodsSold, 450);
  assert.equal(report.realizedGrossProfit, 600);
  assert.equal(report.averageTransactionValue, 525);
  assert.equal(report.averageDiscountPerUnit, 33.33);
  assert.equal(report.remainingTrackedStockUnits, 9); // 8 ox + 1 jhumka + 0 cuff
  assert.equal(report.paymentBreakdown.unrecorded.revenue, 900);
  assert.equal(report.paymentBreakdown.cash.revenue, 150);
  assert.equal(report.paymentBreakdown.upi.revenue, 0);

  // Bridges cleanly into ActualSaleRecord[] without duplicating manual rows
  const bridged = mergeLiveSalesIntoActualSales(txns, []);
  assert.equal(bridged.length, 2);
});

test('Idempotent offline sync merge deduplicates IDs, preserves pending local sales, and flags cross-device stock conflicts', () => {
  const remoteSale = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    syncStatus: 'synced',
    timestampMs: 1000,
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_last',
        productName: 'Kundan Jhumka',
        quantity: 1,
        originalUnitPrice: 300,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 120,
        stockTracked: true,
      },
    ],
  }).transaction!;

  const offlineSale = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    syncStatus: 'pending',
    timestampMs: 2000,
    items: [
      {
        groupId: 'grp_bangles',
        categoryName: 'Bangles',
        productId: 'prod_last',
        productName: 'Kundan Jhumka',
        quantity: 1,
        originalUnitPrice: 300,
        perUnitDiscount: 20,
        purchaseCostPerUnit: 120,
        stockTracked: true,
      },
    ],
  }).transaction!;

  // Merge when local also has a copy of remoteSale -> zero duplicates + conflict flagged on offlineSale
  const { merged, conflictIds } = mergeSyncedTransactions({
    localTransactions: [offlineSale, remoteSale],
    remoteTransactions: [remoteSale],
    trackedBaseByKey: { 'grp_bangles::prod_last': 1 },
  });

  assert.equal(merged.length, 2);
  assert.deepEqual(conflictIds, [offlineSale.id]);
  const flagged = merged.find((t) => t.id === offlineSale.id)!;
  assert.equal(flagged.stockConflict, true);
  assert.ok(flagged.stockConflictNote?.includes('Kundan Jhumka'));
  assert.equal(flagged.syncStatus, 'pending'); // Never silently dropped or marked synced prematurely!
});
