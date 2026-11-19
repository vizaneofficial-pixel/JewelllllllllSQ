import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyLiveState,
  makeLiveStorageKey,
  sanitizeLiveState,
} from './liveSellingStorage';
import { deriveOverallSyncStatus } from '../services/liveSellingService';
import {
  computeDailySalesReport,
  createSaleTransaction,
  createSellingSession,
  mergeSyncedTransactions,
} from './liveSellingEngine';

test('Live storage keys and sanitization isolate users and projects strictly', () => {
  const keyA = makeLiveStorageKey('user_alpha', 'proj_1');
  const keyB = makeLiveStorageKey('user_beta', 'proj_1');
  const keyC = makeLiveStorageKey('user_alpha', 'proj_2');
  const keyGuest = makeLiveStorageKey(null, 'proj_1');

  assert.notEqual(keyA, keyB);
  assert.notEqual(keyA, keyC);
  assert.notEqual(keyA, keyGuest);

  const raw = {
    userId: 'user_alpha',
    projectId: 'proj_1',
    pinnedKeys: ['grp_1::p1', '', 'grp_1::p1'],
    stockOverrides: { 'grp_1::p1': 12.8, bad: -5 },
    defaultPaymentMethod: 'upi' as const,
    transactions: [],
    sessions: [],
  };

  const sanitized = sanitizeLiveState(raw, 'user_alpha', 'proj_1');
  assert.deepEqual(sanitized.pinnedKeys, ['grp_1::p1']);
  assert.deepEqual(sanitized.stockOverrides, { 'grp_1::p1': 12 });
  assert.equal(sanitized.defaultPaymentMethod, 'upi');

  const empty = createEmptyLiveState('guest', 'proj_1');
  assert.equal(empty.defaultPaymentMethod, 'unrecorded');
  assert.equal(empty.transactions.length, 0);
});

test('deriveOverallSyncStatus surfaces explicit Saved locally, Syncing, Synced, and Sync failed — retrying states', () => {
  const baseTxn = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: 'sess_1',
    syncStatus: 'pending',
    items: [
      {
        groupId: 'g1',
        categoryName: 'Bangles',
        productId: 'p1',
        productName: 'Silver Cuff',
        quantity: 1,
        originalUnitPrice: 400,
        perUnitDiscount: 0,
        purchaseCostPerUnit: 150,
        stockTracked: false,
      },
    ],
  }).transaction!;

  assert.equal(
    deriveOverallSyncStatus('guest', [baseTxn], false).label,
    'Saved locally'
  );
  assert.equal(
    deriveOverallSyncStatus('user_1', [baseTxn], false).label,
    'Saved locally'
  );
  assert.equal(
    deriveOverallSyncStatus('user_1', [baseTxn], true).label,
    'Syncing'
  );
  assert.equal(
    deriveOverallSyncStatus('user_1', [{ ...baseTxn, syncStatus: 'failed' }], false).label,
    'Sync failed — retrying'
  );
  assert.equal(
    deriveOverallSyncStatus('user_1', [{ ...baseTxn, syncStatus: 'synced' }], false).label,
    'Synced'
  );
});

test('Closing a day while offline retains pending transactions and preserves closed report snapshot across sync', () => {
  const sess1 = createSellingSession('proj_1', [], 'cash', 1000);
  const offlineSale = createSaleTransaction({
    userId: 'user_1',
    projectId: 'proj_1',
    sessionId: sess1.id,
    paymentMethod: 'cash',
    syncStatus: 'pending',
    timestampMs: 1500,
    items: [
      {
        groupId: 'g1',
        categoryName: 'Jewelry',
        productId: 'p1',
        productName: 'Pearl Studs',
        quantity: 2,
        originalUnitPrice: 250,
        perUnitDiscount: 20,
        purchaseCostPerUnit: 90,
        stockTracked: true,
      },
    ],
  }).transaction!;

  const report = computeDailySalesReport({
    transactions: [offlineSale],
    inventoryCatalog: [],
    sessionId: sess1.id,
    dateKey: sess1.dateKey,
    sessionLabel: sess1.label,
  });

  const closedSession = {
    ...sess1,
    status: 'closed' as const,
    closedAtMs: 2000,
    pendingSyncOnClose: report.pendingSyncCount > 0,
    closedReportSnapshot: report,
  };

  assert.equal(closedSession.pendingSyncOnClose, true);
  assert.equal(closedSession.closedReportSnapshot?.actualRevenue, 460);
  assert.equal(closedSession.closedReportSnapshot?.realizedGrossProfit, 280);

  // Merge after reconnection with empty remote keeps pending sale intact
  const { merged } = mergeSyncedTransactions({
    localTransactions: [offlineSale],
    remoteTransactions: [],
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].syncStatus, 'pending');
});
