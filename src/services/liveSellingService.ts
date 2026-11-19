import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type {
  DailySalesReport,
  LiveSaleLineItem,
  LiveSaleTransaction,
  LiveSellingSession,
  PaymentMethod,
  SyncState,
} from '../types/stall';
import { mergeSyncedTransactions } from '../utils/liveSellingEngine';
import { makePurchaseItemKey } from '../utils/orderAndProjectEngine';

export type OverallLiveSyncStatus =
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'failed'
  | 'local_only';

export function deriveOverallSyncStatus(
  userId: string | null | undefined,
  transactions: LiveSaleTransaction[],
  isSyncingNow: boolean
): { status: OverallLiveSyncStatus; label: string; pendingCount: number; failedCount: number } {
  if (!userId || userId === 'guest') {
    return {
      status: 'local_only',
      label: transactions.length > 0 ? 'Saved locally' : 'Local mode',
      pendingCount: 0,
      failedCount: 0,
    };
  }

  if (isSyncingNow) {
    return {
      status: 'syncing',
      label: 'Syncing',
      pendingCount: transactions.filter(
        (t) => t.syncStatus === 'pending' || t.syncStatus === 'syncing' || t.syncStatus === 'failed'
      ).length,
      failedCount: 0,
    };
  }

  const failedCount = transactions.filter((t) => t.syncStatus === 'failed').length;
  const pendingCount = transactions.filter(
    (t) => t.syncStatus === 'pending' || t.syncStatus === 'local_only'
  ).length;

  if (failedCount > 0) {
    return {
      status: 'failed',
      label: 'Sync failed — retrying',
      pendingCount: pendingCount + failedCount,
      failedCount,
    };
  }

  if (pendingCount > 0) {
    return {
      status: 'pending',
      label: 'Saved locally',
      pendingCount,
      failedCount: 0,
    };
  }

  return {
    status: 'synced',
    label: 'Synced',
    pendingCount: 0,
    failedCount: 0,
  };
}

function sanitizeId(raw: string, fallback: string): string {
  const clean = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return clean || fallback;
}

function sanitizeLineItemForFirestore(line: LiveSaleLineItem): LiveSaleLineItem {
  return {
    lineId: sanitizeId(line.lineId, 'line_1'),
    groupId: sanitizeId(line.groupId, 'grp_1'),
    categoryNameSnapshot: (line.categoryNameSnapshot || 'General').slice(0, 80),
    productId: sanitizeId(line.productId, 'prod_1'),
    productNameSnapshot: (line.productNameSnapshot || 'Product').slice(0, 100),
    quantity: Math.max(1, Math.floor(line.quantity)),
    originalUnitPrice: Math.max(0, Number(line.originalUnitPrice) || 0),
    perUnitDiscount: Math.max(0, Number(line.perUnitDiscount) || 0),
    actualUnitPrice: Math.max(0.01, Number(line.actualUnitPrice) || 0.01),
    originalTotalValue: Math.max(0, Number(line.originalTotalValue) || 0),
    totalDiscount: Math.max(0, Number(line.totalDiscount) || 0),
    actualTotalRevenue: Math.max(0, Number(line.actualTotalRevenue) || 0),
    purchaseCostPerUnitSnapshot: Math.max(0, Number(line.purchaseCostPerUnitSnapshot) || 0),
    totalCogs: Math.max(0, Number(line.totalCogs) || 0),
    realizedGrossProfit: Number(line.realizedGrossProfit) || 0,
    stockTracked: Boolean(line.stockTracked),
  };
}

function serializeTransactionForFirestore(
  uid: string,
  projectId: string,
  txn: LiveSaleTransaction,
  isCreate: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: sanitizeId(txn.id, `txn_${Date.now()}`),
    userId: uid,
    projectId: sanitizeId(projectId, 'active'),
    sessionId: sanitizeId(txn.sessionId, 'sess_1'),
    isBasket: Boolean(txn.isBasket),
    items: txn.items.slice(0, 50).map(sanitizeLineItemForFirestore),
    primaryProductId: sanitizeId(txn.primaryProductId, 'prod_1'),
    primaryProductName: (txn.primaryProductName || 'Product').slice(0, 120),
    primaryCategoryName: (txn.primaryCategoryName || 'General').slice(0, 80),
    totalQuantity: Math.max(1, Math.floor(txn.totalQuantity)),
    originalTotalValue: Math.max(0, Number(txn.originalTotalValue) || 0),
    totalDiscount: Math.max(0, Number(txn.totalDiscount) || 0),
    actualTotalRevenue: Math.max(0, Number(txn.actualTotalRevenue) || 0),
    totalCogs: Math.max(0, Number(txn.totalCogs) || 0),
    realizedGrossProfit: Number(txn.realizedGrossProfit) || 0,
    paymentMethod: txn.paymentMethod || 'unrecorded',
    timestampMs: txn.timestampMs,
    status: txn.status,
    stockConflict: Boolean(txn.stockConflict),
    stockConflictNote: txn.stockConflictNote ? txn.stockConflictNote.slice(0, 240) : null,
    stockConflictResolved: Boolean(txn.stockConflictResolved),
    reversalOfTransactionId: txn.reversalOfTransactionId || null,
    reversedByTransactionId: txn.reversedByTransactionId || null,
    correctionOfTransactionId: txn.correctionOfTransactionId || null,
    correctedByTransactionId: txn.correctedByTransactionId || null,
    updatedAt: serverTimestamp(),
  };

  if (txn.note) {
    payload.note = txn.note.slice(0, 240);
  }
  if (txn.deviceId) {
    payload.deviceId = txn.deviceId.slice(0, 64);
  }
  if (isCreate) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

function hydrateRemoteTransaction(id: string, raw: Record<string, unknown>): LiveSaleTransaction {
  return {
    id,
    userId: typeof raw.userId === 'string' ? raw.userId : '',
    projectId: typeof raw.projectId === 'string' ? raw.projectId : '',
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
    isBasket: Boolean(raw.isBasket),
    items: Array.isArray(raw.items) ? (raw.items as LiveSaleLineItem[]) : [],
    primaryProductId: typeof raw.primaryProductId === 'string' ? raw.primaryProductId : '',
    primaryProductName: typeof raw.primaryProductName === 'string' ? raw.primaryProductName : 'Product',
    primaryCategoryName: typeof raw.primaryCategoryName === 'string' ? raw.primaryCategoryName : 'General',
    totalQuantity: typeof raw.totalQuantity === 'number' ? raw.totalQuantity : 1,
    originalTotalValue: typeof raw.originalTotalValue === 'number' ? raw.originalTotalValue : 0,
    totalDiscount: typeof raw.totalDiscount === 'number' ? raw.totalDiscount : 0,
    actualTotalRevenue: typeof raw.actualTotalRevenue === 'number' ? raw.actualTotalRevenue : 0,
    totalCogs: typeof raw.totalCogs === 'number' ? raw.totalCogs : 0,
    realizedGrossProfit: typeof raw.realizedGrossProfit === 'number' ? raw.realizedGrossProfit : 0,
    paymentMethod: (raw.paymentMethod as PaymentMethod) || 'unrecorded',
    timestampMs: typeof raw.timestampMs === 'number' ? raw.timestampMs : Date.now(),
    status:
      raw.status === 'reversed' || raw.status === 'corrected' ? raw.status : 'completed',
    syncStatus: 'synced' as SyncState,
    syncedAtMs: Date.now(),
    syncError: null,
    stockConflict: Boolean(raw.stockConflict),
    stockConflictNote: typeof raw.stockConflictNote === 'string' ? raw.stockConflictNote : null,
    stockConflictResolved: Boolean(raw.stockConflictResolved),
    reversalOfTransactionId:
      typeof raw.reversalOfTransactionId === 'string' ? raw.reversalOfTransactionId : null,
    reversedByTransactionId:
      typeof raw.reversedByTransactionId === 'string' ? raw.reversedByTransactionId : null,
    correctionOfTransactionId:
      typeof raw.correctionOfTransactionId === 'string' ? raw.correctionOfTransactionId : null,
    correctedByTransactionId:
      typeof raw.correctedByTransactionId === 'string' ? raw.correctedByTransactionId : null,
    ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
    ...(typeof raw.deviceId === 'string' ? { deviceId: raw.deviceId } : {}),
  };
}

function hydrateRemoteSession(id: string, raw: Record<string, unknown>): LiveSellingSession {
  return {
    id,
    projectId: typeof raw.projectId === 'string' ? raw.projectId : '',
    dateKey: typeof raw.dateKey === 'string' ? raw.dateKey : '',
    label: typeof raw.label === 'string' ? raw.label : 'Session',
    status: raw.status === 'closed' ? 'closed' : 'open',
    startedAtMs: typeof raw.startedAtMs === 'number' ? raw.startedAtMs : Date.now(),
    closedAtMs: typeof raw.closedAtMs === 'number' ? raw.closedAtMs : null,
    defaultPaymentMethod: (raw.defaultPaymentMethod as PaymentMethod) || 'unrecorded',
    pendingSyncOnClose: Boolean(raw.pendingSyncOnClose),
    closedReportSnapshot: (raw.closedReportSnapshot as DailySalesReport | null) || null,
  };
}

export async function loadRemoteLiveSellingData(
  uid: string,
  projectId: string
): Promise<{ transactions: LiveSaleTransaction[]; sessions: LiveSellingSession[] }> {
  if (!uid || !projectId || !db) return { transactions: [], sessions: [] };
  const safeProj = sanitizeId(projectId, 'active');
  const txnPath = `users/${uid}/workspaces/${safeProj}/liveTransactions`;
  const sessPath = `users/${uid}/workspaces/${safeProj}/liveSessions`;

  try {
    const txnQ = query(
      collection(db, 'users', uid, 'workspaces', safeProj, 'liveTransactions'),
      where('userId', '==', uid),
      orderBy('timestampMs', 'desc'),
      limit(500)
    );
    const sessQ = query(
      collection(db, 'users', uid, 'workspaces', safeProj, 'liveSessions'),
      where('userId', '==', uid),
      orderBy('startedAtMs', 'desc'),
      limit(100)
    );

    const [txnSnap, sessSnap] = await Promise.all([getDocs(txnQ), getDocs(sessQ)]);
    return {
      transactions: txnSnap.docs.map((d) =>
        hydrateRemoteTransaction(d.id, d.data() as Record<string, unknown>)
      ),
      sessions: sessSnap.docs.map((d) =>
        hydrateRemoteSession(d.id, d.data() as Record<string, unknown>)
      ),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('insufficient')) {
      handleFirestoreError(err, OperationType.LIST, `${txnPath} | ${sessPath}`);
    }
    throw err;
  }
}

export function subscribeRemoteLiveSelling(
  uid: string,
  projectId: string,
  callbacks: {
    onTransactions: (txns: LiveSaleTransaction[]) => void;
    onSessions: (sessions: LiveSellingSession[]) => void;
    onError?: (err: unknown) => void;
  }
): Unsubscribe {
  if (!uid || !projectId || !db) return () => {};
  const safeProj = sanitizeId(projectId, 'active');

  const txnQ = query(
    collection(db, 'users', uid, 'workspaces', safeProj, 'liveTransactions'),
    where('userId', '==', uid),
    orderBy('timestampMs', 'desc'),
    limit(500)
  );
  const sessQ = query(
    collection(db, 'users', uid, 'workspaces', safeProj, 'liveSessions'),
    where('userId', '==', uid),
    orderBy('startedAtMs', 'desc'),
    limit(100)
  );

  const unsubTxns = onSnapshot(
    txnQ,
    (snap) => {
      callbacks.onTransactions(
        snap.docs.map((d) =>
          hydrateRemoteTransaction(d.id, d.data() as Record<string, unknown>)
        )
      );
    },
    (err) => callbacks.onError?.(err)
  );

  const unsubSess = onSnapshot(
    sessQ,
    (snap) => {
      callbacks.onSessions(
        snap.docs.map((d) =>
          hydrateRemoteSession(d.id, d.data() as Record<string, unknown>)
        )
      );
    },
    (err) => callbacks.onError?.(err)
  );

  return () => {
    unsubTxns();
    unsubSess();
  };
}

/**
 * Synchronize one transaction idempotently via Firestore runTransaction.
 * - If not created on server yet -> creates it atomically with immutable unique ID.
 * - If already present -> applies only valid status / conflict-resolution / audit updates.
 */
export async function syncLiveTransactionToFirestore(
  uid: string,
  projectId: string,
  txn: LiveSaleTransaction,
  trackedBaseByKey: Record<string, number>,
  allCurrentTransactions: LiveSaleTransaction[]
): Promise<LiveSaleTransaction> {
  if (!uid || !projectId || !db) {
    return { ...txn, syncStatus: 'local_only' };
  }
  const safeProj = sanitizeId(projectId, 'active');
  const safeTxnId = sanitizeId(txn.id, `txn_${Date.now()}`);
  const ref = doc(db, 'users', uid, 'workspaces', safeProj, 'liveTransactions', safeTxnId);

  // Detect any local/known stock conflict cleanly before writing
  let hasConflict = Boolean(txn.stockConflict);
  let conflictNote = txn.stockConflictNote;
  if (!txn.stockConflictResolved && txn.status === 'completed' && !txn.reversalOfTransactionId) {
    const validCompleted = allCurrentTransactions.filter(
      (t) => t.status === 'completed' && !t.reversalOfTransactionId && t.timestampMs <= txn.timestampMs
    );
    const soldMap = new Map<string, number>();
    for (const itemTxn of validCompleted) {
      for (const l of itemTxn.items) {
        const k = makePurchaseItemKey(l.groupId, l.productId);
        soldMap.set(k, (soldMap.get(k) || 0) + l.quantity);
      }
    }
    for (const line of txn.items) {
      const k = makePurchaseItemKey(line.groupId, line.productId);
      const base = trackedBaseByKey[k];
      const cumulative = soldMap.get(k) || line.quantity;
      if (typeof base === 'number' && Number.isFinite(base) && cumulative > base) {
        hasConflict = true;
        conflictNote = `Total sold (${cumulative}) exceeds tracked stock (${base}) for ${line.productNameSnapshot}.`;
      }
    }
  }

  const enrichedTxn: LiveSaleTransaction = {
    ...txn,
    stockConflict: hasConflict,
    stockConflictNote: conflictNote,
  };

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, serializeTransactionForFirestore(uid, safeProj, enrichedTxn, true));
      } else {
        tx.update(ref, {
          status: enrichedTxn.status,
          reversedByTransactionId: enrichedTxn.reversedByTransactionId || null,
          correctedByTransactionId: enrichedTxn.correctedByTransactionId || null,
          stockConflict: Boolean(enrichedTxn.stockConflict),
          stockConflictNote: enrichedTxn.stockConflictNote || null,
          stockConflictResolved: Boolean(enrichedTxn.stockConflictResolved),
          ...(enrichedTxn.note ? { note: enrichedTxn.note.slice(0, 240) } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    });

    return {
      ...enrichedTxn,
      syncStatus: 'synced',
      syncedAtMs: Date.now(),
      syncError: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    if (msg.toLowerCase().includes('permission')) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${uid}/workspaces/${safeProj}/liveTransactions/${safeTxnId}`
      );
    }
    return {
      ...enrichedTxn,
      syncStatus: 'failed',
      syncError: msg,
    };
  }
}

export async function syncLiveSessionToFirestore(
  uid: string,
  projectId: string,
  session: LiveSellingSession
): Promise<void> {
  if (!uid || !projectId || !db) return;
  const safeProj = sanitizeId(projectId, 'active');
  const safeSessId = sanitizeId(session.id, `sess_${Date.now()}`);
  const ref = doc(db, 'users', uid, 'workspaces', safeProj, 'liveSessions', safeSessId);

  const payload = {
    id: safeSessId,
    userId: uid,
    projectId: safeProj,
    dateKey: session.dateKey.slice(0, 20),
    label: session.label.slice(0, 80),
    status: session.status,
    startedAtMs: session.startedAtMs,
    closedAtMs: session.closedAtMs,
    defaultPaymentMethod: session.defaultPaymentMethod || 'unrecorded',
    pendingSyncOnClose: Boolean(session.pendingSyncOnClose),
    closedReportSnapshot: session.closedReportSnapshot || null,
    updatedAt: serverTimestamp(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (!existing.exists()) {
        tx.set(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          status: payload.status,
          closedAtMs: payload.closedAtMs,
          defaultPaymentMethod: payload.defaultPaymentMethod,
          pendingSyncOnClose: payload.pendingSyncOnClose,
          closedReportSnapshot: payload.closedReportSnapshot,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('permission')) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${uid}/workspaces/${safeProj}/liveSessions/${safeSessId}`
      );
    }
    throw err;
  }
}

/**
 * Flush all pending/failed transactions in chronological order (oldest first so creates
 * precede reversals/corrections) and sync sessions cleanly.
 */
export async function flushPendingLiveSellingQueue(params: {
  uid: string;
  projectId: string;
  transactions: LiveSaleTransaction[];
  sessions: LiveSellingSession[];
  trackedBaseByKey: Record<string, number>;
}): Promise<{
  transactions: LiveSaleTransaction[];
  sessions: LiveSellingSession[];
  syncedCount: number;
  failedCount: number;
}> {
  const { uid, projectId, transactions, sessions, trackedBaseByKey } = params;
  if (!uid || uid === 'guest' || !projectId || !db) {
    return { transactions, sessions, syncedCount: 0, failedCount: 0 };
  }

  // Also load latest remote records first to catch multi-device writes before pushing
  let workingTxns = transactions;
  try {
    const remote = await loadRemoteLiveSellingData(uid, projectId);
    const merged = mergeSyncedTransactions({
      localTransactions: transactions,
      remoteTransactions: remote.transactions,
      trackedBaseByKey,
    });
    workingTxns = merged.merged;
  } catch {
    // Offline or transient read failure; continue with local copy
  }

  const queue = workingTxns
    .filter((t) => t.syncStatus === 'pending' || t.syncStatus === 'failed' || t.syncStatus === 'syncing')
    .sort((a, b) => a.timestampMs - b.timestampMs);

  let syncedCount = 0;
  let failedCount = 0;

  const updatedMap = new Map<string, LiveSaleTransaction>();
  for (const item of workingTxns) {
    updatedMap.set(item.id, item);
  }

  for (const pendingTxn of queue) {
    const synced = await syncLiveTransactionToFirestore(
      uid,
      projectId,
      pendingTxn,
      trackedBaseByKey,
      Array.from(updatedMap.values())
    );
    updatedMap.set(synced.id, synced);
    if (synced.syncStatus === 'synced') {
      syncedCount += 1;
    } else if (synced.syncStatus === 'failed') {
      failedCount += 1;
    }
  }

  const nextSessions = [...sessions];
  for (let i = 0; i < nextSessions.length; i += 1) {
    const sess = nextSessions[i];
    const hasPendingInSess = Array.from(updatedMap.values()).some(
      (t) =>
        t.sessionId === sess.id &&
        (t.syncStatus === 'pending' || t.syncStatus === 'failed')
    );
    const resolvedSess: LiveSellingSession = {
      ...sess,
      pendingSyncOnClose: sess.status === 'closed' ? hasPendingInSess : false,
    };
    nextSessions[i] = resolvedSess;
    try {
      await syncLiveSessionToFirestore(uid, projectId, resolvedSess);
    } catch {
      // Keep local session intact if offline
    }
  }

  const finalTransactions = Array.from(updatedMap.values()).sort(
    (a, b) => b.timestampMs - a.timestampMs
  );

  return {
    transactions: finalTransactions,
    sessions: nextSessions,
    syncedCount,
    failedCount,
  };
}
