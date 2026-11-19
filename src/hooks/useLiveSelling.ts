import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActualSaleRecord,
  CategoryGroupResolved,
  DailySalesReport,
  LiveBasketEntry,
  LiveInventoryItem,
  LiveSaleTransaction,
  LiveSellingSession,
  PaymentMethod,
  PurchaseItemProgress,
} from '../types/stall';
import { triggerHaptic } from '../utils/experienceMode';
import {
  checkStockAvailability,
  computeDailySalesReport,
  computeLiveInventoryCatalog,
  correctSaleTransaction,
  createSaleTransaction,
  createSellingSession,
  isActiveValidSale,
  mergeSyncedTransactions,
  reverseSaleTransaction,
  validateDiscount,
  type SaleLineInput,
} from '../utils/liveSellingEngine';
import {
  createEmptyLiveState,
  getOrCreateDeviceId,
  loadLiveStateAsync,
  loadLiveStateSync,
  persistLiveState,
  type LiveSellingLocalState,
} from '../utils/liveSellingStorage';
import {
  deriveOverallSyncStatus,
  flushPendingLiveSellingQueue,
  loadRemoteLiveSellingData,
  subscribeRemoteLiveSelling,
  syncLiveSessionToFirestore,
  syncLiveTransactionToFirestore,
} from '../services/liveSellingService';

export interface UndoSaleBanner {
  transactionId: string;
  title: string;
  revenue: number;
  expiresAtMs: number;
}

interface UseLiveSellingParams {
  userId: string | null | undefined;
  projectId: string | null | undefined;
  resolvedGroups: CategoryGroupResolved[];
  purchaseProgress: Record<string, PurchaseItemProgress>;
  isSellTabActive: boolean;
  onSyncActualSalesSnapshot?: (validLiveCount: number) => void;
}

export function useLiveSelling({
  userId,
  projectId,
  resolvedGroups,
  purchaseProgress,
  isSellTabActive,
}: UseLiveSellingParams) {
  const effectiveUserId = userId || 'guest';
  const effectiveProjectId = projectId || 'local_default';
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  const [state, setState] = useState<LiveSellingLocalState>(() => {
    const initial = loadLiveStateSync(effectiveUserId, effectiveProjectId);
    if (initial.sessions.some((s) => s.status === 'open')) {
      return initial;
    }
    const openSess = createSellingSession(
      effectiveProjectId,
      initial.sessions,
      initial.defaultPaymentMethod
    );
    return {
      ...initial,
      sessions: [openSess, ...initial.sessions],
    };
  });

  const [basket, setBasket] = useState<LiveBasketEntry[]>([]);
  const [undoBanner, setUndoBanner] = useState<UndoSaleBanner | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [selectedReportSessionId, setSelectedReportSessionId] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const syncingRef = useRef(false);
  const undoTimerRef = useRef<number | null>(null);

  // Tracked base stock map for multi-device conflict detection
  const catalogBeforeConflicts = useMemo(
    () =>
      computeLiveInventoryCatalog({
        resolvedGroups,
        purchaseProgress,
        transactions: state.transactions,
        pinnedKeys: state.pinnedKeys,
        stockOverrides: state.stockOverrides,
      }),
    [resolvedGroups, purchaseProgress, state.transactions, state.pinnedKeys, state.stockOverrides]
  );

  const trackedBaseByKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of catalogBeforeConflicts) {
      if (item.isStockTracked && item.trackedBaseQty !== null) {
        map[item.key] = item.trackedBaseQty;
      }
    }
    return map;
  }, [catalogBeforeConflicts]);

  const trackedBaseRef = useRef(trackedBaseByKey);
  trackedBaseRef.current = trackedBaseByKey;

  // Reload state cleanly whenever user or project changes
  useEffect(() => {
    let cancelled = false;
    const syncLoaded = loadLiveStateSync(effectiveUserId, effectiveProjectId);
    const hasOpenSync = syncLoaded.sessions.some((s) => s.status === 'open');
    const bootstrapped = hasOpenSync
      ? syncLoaded
      : {
          ...syncLoaded,
          sessions: [
            createSellingSession(
              effectiveProjectId,
              syncLoaded.sessions,
              syncLoaded.defaultPaymentMethod
            ),
            ...syncLoaded.sessions,
          ],
        };
    setState(bootstrapped);
    setBasket([]);
    setUndoBanner(null);
    setSelectedReportSessionId(null);

    void loadLiveStateAsync(effectiveUserId, effectiveProjectId).then((idbLoaded) => {
      if (cancelled) return;
      const hasOpen = idbLoaded.sessions.some((s) => s.status === 'open');
      const next = hasOpen
        ? idbLoaded
        : {
            ...idbLoaded,
            sessions: [
              createSellingSession(
                effectiveProjectId,
                idbLoaded.sessions,
                idbLoaded.defaultPaymentMethod
              ),
              ...idbLoaded.sessions,
            ],
          };
      setState((prev) => {
        if (
          prev.projectId === next.projectId &&
          prev.userId === next.userId &&
          prev.transactions.length >= next.transactions.length &&
          prev.updatedAtMs > next.updatedAtMs
        ) {
          return prev;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, effectiveProjectId]);

  const commitState = useCallback(
    (updater: (prev: LiveSellingLocalState) => LiveSellingLocalState) => {
      setState((prev) => {
        const next = updater(prev);
        persistLiveState(next);
        return next;
      });
    },
    []
  );

  // Ensure an open session always exists
  const activeSession = useMemo(() => {
    const open = state.sessions.find((s) => s.status === 'open');
    if (open) return open;
    return createSellingSession(
      effectiveProjectId,
      state.sessions,
      state.defaultPaymentMethod
    );
  }, [state.sessions, state.defaultPaymentMethod, effectiveProjectId]);

  // Run full sync flush with Firestore when authenticated & online
  const flushSyncQueue = useCallback(async () => {
    if (!userId || userId === 'guest') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const current = stateRef.current;
      const res = await flushPendingLiveSellingQueue({
        uid: userId,
        projectId: effectiveProjectId,
        transactions: current.transactions,
        sessions: current.sessions,
        trackedBaseByKey: trackedBaseRef.current,
      });

      commitState((prev) => {
        // Preserve any brand-new transactions registered while sync was in-flight
        const syncedMap = new Map(res.transactions.map((t) => [t.id, t]));
        for (const t of prev.transactions) {
          if (!syncedMap.has(t.id)) {
            syncedMap.set(t.id, t);
          }
        }
        const mergedTxns = Array.from(syncedMap.values()).sort(
          (a, b) => b.timestampMs - a.timestampMs
        );
        return {
          ...prev,
          transactions: mergedTxns,
          sessions: res.sessions.length > 0 ? res.sessions : prev.sessions,
        };
      });
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [userId, effectiveProjectId, commitState]);

  // Subscribe to online/offline events + auto-flush when online
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      setIsOnline(true);
      void flushSyncQueue();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flushSyncQueue]);

  // Periodic retry when failed or pending items exist while online
  useEffect(() => {
    if (!userId || userId === 'guest' || !isOnline) return;
    const hasPending = state.transactions.some(
      (t) => t.syncStatus === 'pending' || t.syncStatus === 'failed'
    );
    if (!hasPending) return;

    const timer = window.setTimeout(() => {
      void flushSyncQueue();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [userId, isOnline, state.transactions, flushSyncQueue]);

  // Initial remote hydrate + real-time Firestore subscription when authenticated
  useEffect(() => {
    if (!userId || userId === 'guest' || !effectiveProjectId) return;
    let unsub: (() => void) | null = null;
    let active = true;

    void loadRemoteLiveSellingData(userId, effectiveProjectId)
      .then((remote) => {
        if (!active) return;
        commitState((prev) => {
          const { merged } = mergeSyncedTransactions({
            localTransactions: prev.transactions,
            remoteTransactions: remote.transactions,
            trackedBaseByKey: trackedBaseRef.current,
          });
          const sessById = new Map<string, LiveSellingSession>();
          for (const s of remote.sessions) sessById.set(s.id, s);
          for (const s of prev.sessions) {
            if (!sessById.has(s.id) || s.status === 'closed') {
              sessById.set(s.id, s);
            }
          }
          const sessions = Array.from(sessById.values()).sort(
            (a, b) => b.startedAtMs - a.startedAtMs
          );
          if (!sessions.some((s) => s.status === 'open')) {
            sessions.unshift(
              createSellingSession(effectiveProjectId, sessions, prev.defaultPaymentMethod)
            );
          }
          return { ...prev, transactions: merged, sessions };
        });

        if (typeof navigator === 'undefined' || navigator.onLine) {
          void flushSyncQueue();
        }
      })
      .catch(() => {
        // Offline or unreachable -> remain strictly on local state without crashing
      });

    try {
      unsub = subscribeRemoteLiveSelling(userId, effectiveProjectId, {
        onTransactions: (remoteTxns) => {
          if (!active) return;
          commitState((prev) => {
            const { merged } = mergeSyncedTransactions({
              localTransactions: prev.transactions,
              remoteTransactions: remoteTxns,
              trackedBaseByKey: trackedBaseRef.current,
            });
            return { ...prev, transactions: merged };
          });
        },
        onSessions: (remoteSessions) => {
          if (!active || remoteSessions.length === 0) return;
          commitState((prev) => {
            const byId = new Map(prev.sessions.map((s) => [s.id, s]));
            for (const rs of remoteSessions) {
              const local = byId.get(rs.id);
              if (!local || (rs.status === 'closed' && local.status === 'open')) {
                byId.set(rs.id, rs);
              }
            }
            const sessions = Array.from(byId.values()).sort(
              (a, b) => b.startedAtMs - a.startedAtMs
            );
            return { ...prev, sessions };
          });
        },
      });
    } catch {
      // Non-fatal
    }

    return () => {
      active = false;
      unsub?.();
    };
  }, [userId, effectiveProjectId, commitState, flushSyncQueue]);

  // Progressive enhancement: Screen Wake Lock during active Live Selling tab
  useEffect(() => {
    if (
      !isSellTabActive ||
      typeof navigator === 'undefined' ||
      !('wakeLock' in navigator)
    ) {
      setWakeLockActive(false);
      return;
    }

    let sentinel: { release: () => Promise<void> } | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const wl = await (
          navigator as Navigator & {
            wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock.request('screen');
        if (disposed) {
          await wl.release().catch(() => {});
          return;
        }
        sentinel = wl;
        setWakeLockActive(true);
      } catch {
        setWakeLockActive(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isSellTabActive) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      setWakeLockActive(false);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [isSellTabActive]);

  const showUndoToast = useCallback((txn: LiveSaleTransaction) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    const expiresAtMs = Date.now() + 6500;
    setUndoBanner({
      transactionId: txn.id,
      title:
        txn.totalQuantity > 1 && !txn.isBasket
          ? `${txn.totalQuantity}× ${txn.primaryProductName}`
          : txn.primaryProductName,
      revenue: txn.actualTotalRevenue,
      expiresAtMs,
    });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoBanner(null);
      undoTimerRef.current = null;
    }, 6500);
  }, []);

  const pushTxnAsync = useCallback(
    async (txn: LiveSaleTransaction, allTxns: LiveSaleTransaction[]) => {
      if (!userId || userId === 'guest') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const synced = await syncLiveTransactionToFirestore(
        userId,
        effectiveProjectId,
        txn,
        trackedBaseRef.current,
        allTxns
      );
      commitState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((item) =>
          item.id === synced.id ? synced : item
        ),
      }));
    },
    [userId, effectiveProjectId, commitState]
  );

  /**
   * 1-tap full-price or fast discounted sale. Persists synchronously before returning.
   */
  const recordQuickSale = useCallback(
    (
      item: LiveInventoryItem,
      opts?: {
        quantity?: number;
        perUnitDiscount?: number;
        paymentMethod?: PaymentMethod;
        note?: string;
      }
    ): { ok: boolean; transaction?: LiveSaleTransaction; error?: string } => {
      const qty = Math.max(1, Math.floor(opts?.quantity ?? 1));
      const perUnitDiscount = Math.max(0, Number(opts?.perUnitDiscount ?? 0));

      const stockCheck = checkStockAvailability(item, qty, 0);
      if (!stockCheck.allowed) {
        return { ok: false, error: stockCheck.error || 'Insufficient stock.' };
      }

      const discCheck = validateDiscount(item.sellingPrice, perUnitDiscount);
      if (!discCheck.valid) {
        return { ok: false, error: discCheck.error || 'Invalid discount.' };
      }

      const initialSyncStatus =
        userId && userId !== 'guest' ? 'pending' : 'local_only';

      const created = createSaleTransaction({
        userId: effectiveUserId,
        projectId: effectiveProjectId,
        sessionId: activeSession.id,
        paymentMethod: opts?.paymentMethod || stateRef.current.defaultPaymentMethod,
        syncStatus: initialSyncStatus,
        note: opts?.note,
        deviceId: deviceIdRef.current,
        items: [
          {
            groupId: item.groupId,
            categoryName: item.categoryName,
            productId: item.productId,
            productName: item.productName,
            quantity: qty,
            originalUnitPrice: item.sellingPrice,
            perUnitDiscount,
            purchaseCostPerUnit: item.purchaseCost,
            stockTracked: item.isStockTracked,
          },
        ],
      });

      if (created.error || !created.transaction) {
        return { ok: false, error: created.error || 'Unable to record sale.' };
      }

      const txn = created.transaction;
      let nextAll: LiveSaleTransaction[] = [];

      commitState((prev) => {
        const hasSession = prev.sessions.some((s) => s.id === activeSession.id);
        const nextSessions = hasSession ? prev.sessions : [activeSession, ...prev.sessions];
        nextAll = [txn, ...prev.transactions];
        return {
          ...prev,
          sessions: nextSessions,
          transactions: nextAll,
        };
      });

      triggerHaptic(12);
      showUndoToast(txn);
      void pushTxnAsync(txn, nextAll);
      return { ok: true, transaction: txn };
    },
    [
      userId,
      effectiveUserId,
      effectiveProjectId,
      activeSession,
      commitState,
      showUndoToast,
      pushTxnAsync,
    ]
  );

  // Quick Basket operations
  const addToBasket = useCallback(
    (
      item: LiveInventoryItem,
      quantity = 1,
      perUnitDiscount = 0
    ): { ok: boolean; error?: string } => {
      const existing = basket.find((b) => b.key === item.key);
      const alreadyQty = existing ? existing.quantity : 0;
      const check = checkStockAvailability(item, quantity, alreadyQty);
      if (!check.allowed) {
        return { ok: false, error: check.error || 'Insufficient stock.' };
      }
      const discCheck = validateDiscount(item.sellingPrice, perUnitDiscount);
      if (!discCheck.valid) {
        return { ok: false, error: discCheck.error || 'Invalid discount.' };
      }

      setBasket((prev) => {
        const found = prev.find((b) => b.key === item.key);
        if (found) {
          return prev.map((b) =>
            b.key === item.key
              ? {
                  ...b,
                  quantity: b.quantity + Math.max(1, Math.floor(quantity)),
                  perUnitDiscount,
                }
              : b
          );
        }
        return [
          ...prev,
          {
            key: item.key,
            groupId: item.groupId,
            categoryName: item.categoryName,
            productId: item.productId,
            productName: item.productName,
            originalUnitPrice: item.sellingPrice,
            purchaseCostPerUnit: item.purchaseCost,
            stockTracked: item.isStockTracked,
            availableQty: item.availableQty,
            quantity: Math.max(1, Math.floor(quantity)),
            perUnitDiscount,
          },
        ];
      });
      triggerHaptic(8);
      return { ok: true };
    },
    [basket]
  );

  const updateBasketEntry = useCallback(
    (
      key: string,
      patch: { quantity?: number; perUnitDiscount?: number }
    ): { ok: boolean; error?: string } => {
      const currentCatalogItem = catalogBeforeConflicts.find((c) => c.key === key);
      const currentEntry = basket.find((b) => b.key === key);
      if (!currentEntry) return { ok: false, error: 'Basket item not found.' };

      const nextQty =
        patch.quantity !== undefined
          ? Math.floor(patch.quantity)
          : currentEntry.quantity;

      if (nextQty <= 0) {
        setBasket((prev) => prev.filter((b) => b.key !== key));
        return { ok: true };
      }

      if (currentCatalogItem) {
        const check = checkStockAvailability(currentCatalogItem, nextQty, 0);
        if (!check.allowed) {
          return { ok: false, error: check.error };
        }
      }

      const nextDisc =
        patch.perUnitDiscount !== undefined
          ? Math.max(0, patch.perUnitDiscount)
          : currentEntry.perUnitDiscount;
      const discCheck = validateDiscount(currentEntry.originalUnitPrice, nextDisc);
      if (!discCheck.valid) {
        return { ok: false, error: discCheck.error };
      }

      setBasket((prev) =>
        prev.map((b) =>
          b.key === key
            ? { ...b, quantity: nextQty, perUnitDiscount: nextDisc }
            : b
        )
      );
      return { ok: true };
    },
    [basket, catalogBeforeConflicts]
  );

  const removeFromBasket = useCallback((key: string) => {
    setBasket((prev) => prev.filter((b) => b.key !== key));
  }, []);

  const clearBasket = useCallback(() => {
    setBasket([]);
  }, []);

  const completeBasketSale = useCallback(
    (
      paymentMethodOverride?: PaymentMethod,
      note?: string
    ): { ok: boolean; transaction?: LiveSaleTransaction; error?: string } => {
      if (basket.length === 0) {
        return { ok: false, error: 'Basket is empty.' };
      }

      // Validate all basket items against latest live stock
      for (const entry of basket) {
        const catItem = catalogBeforeConflicts.find((c) => c.key === entry.key);
        if (catItem) {
          const check = checkStockAvailability(catItem, entry.quantity, 0);
          if (!check.allowed) {
            return { ok: false, error: check.error };
          }
        }
      }

      const lineInputs: SaleLineInput[] = basket.map((b) => ({
        groupId: b.groupId,
        categoryName: b.categoryName,
        productId: b.productId,
        productName: b.productName,
        quantity: b.quantity,
        originalUnitPrice: b.originalUnitPrice,
        perUnitDiscount: b.perUnitDiscount,
        purchaseCostPerUnit: b.purchaseCostPerUnit,
        stockTracked: b.stockTracked,
      }));

      const initialSyncStatus =
        userId && userId !== 'guest' ? 'pending' : 'local_only';

      const created = createSaleTransaction({
        userId: effectiveUserId,
        projectId: effectiveProjectId,
        sessionId: activeSession.id,
        paymentMethod:
          paymentMethodOverride || stateRef.current.defaultPaymentMethod,
        syncStatus: initialSyncStatus,
        note,
        deviceId: deviceIdRef.current,
        items: lineInputs,
      });

      if (created.error || !created.transaction) {
        return { ok: false, error: created.error || 'Unable to complete basket sale.' };
      }

      const txn = created.transaction;
      let nextAll: LiveSaleTransaction[] = [];

      commitState((prev) => {
        const hasSession = prev.sessions.some((s) => s.id === activeSession.id);
        const nextSessions = hasSession ? prev.sessions : [activeSession, ...prev.sessions];
        nextAll = [txn, ...prev.transactions];
        return {
          ...prev,
          sessions: nextSessions,
          transactions: nextAll,
        };
      });

      setBasket([]);
      triggerHaptic(15);
      showUndoToast(txn);
      void pushTxnAsync(txn, nextAll);
      return { ok: true, transaction: txn };
    },
    [
      basket,
      catalogBeforeConflicts,
      userId,
      effectiveUserId,
      effectiveProjectId,
      activeSession,
      commitState,
      showUndoToast,
      pushTxnAsync,
    ]
  );

  const reverseTransaction = useCallback(
    (
      targetId: string,
      reason?: string
    ): { ok: boolean; error?: string } => {
      const current = stateRef.current;
      const syncStatus = userId && userId !== 'guest' ? 'pending' : 'local_only';
      const res = reverseSaleTransaction(current.transactions, targetId, {
        userId: effectiveUserId,
        reason,
        syncStatus,
      });

      if (res.error || !res.reversalRecord || !res.updatedOriginal) {
        return { ok: false, error: res.error || 'Unable to undo transaction.' };
      }

      commitState((prev) => ({
        ...prev,
        transactions: res.nextTransactions,
      }));

      if (undoBanner?.transactionId === targetId) {
        setUndoBanner(null);
      }

      triggerHaptic(10);
      // Sync original status update first, then reversal record
      if (userId && userId !== 'guest' && typeof navigator !== 'undefined' && navigator.onLine) {
        void (async () => {
          await syncLiveTransactionToFirestore(
            userId,
            effectiveProjectId,
            res.updatedOriginal!,
            trackedBaseRef.current,
            res.nextTransactions
          );
          await syncLiveTransactionToFirestore(
            userId,
            effectiveProjectId,
            res.reversalRecord!,
            trackedBaseRef.current,
            res.nextTransactions
          );
          void flushSyncQueue();
        })();
      }
      return { ok: true };
    },
    [userId, effectiveUserId, effectiveProjectId, commitState, undoBanner, flushSyncQueue]
  );

  const correctTransaction = useCallback(
    (
      targetId: string,
      opts: {
        items: SaleLineInput[];
        paymentMethod: PaymentMethod;
        reason?: string;
      }
    ): { ok: boolean; error?: string } => {
      const current = stateRef.current;
      const syncStatus = userId && userId !== 'guest' ? 'pending' : 'local_only';
      const res = correctSaleTransaction(current.transactions, targetId, {
        userId: effectiveUserId,
        items: opts.items,
        paymentMethod: opts.paymentMethod,
        reason: opts.reason,
        syncStatus,
      });

      if (res.error || !res.correctionRecord || !res.updatedOriginal) {
        return { ok: false, error: res.error || 'Unable to correct transaction.' };
      }

      commitState((prev) => ({
        ...prev,
        transactions: res.nextTransactions,
      }));

      if (userId && userId !== 'guest' && typeof navigator !== 'undefined' && navigator.onLine) {
        void (async () => {
          await syncLiveTransactionToFirestore(
            userId,
            effectiveProjectId,
            res.updatedOriginal!,
            trackedBaseRef.current,
            res.nextTransactions
          );
          await syncLiveTransactionToFirestore(
            userId,
            effectiveProjectId,
            res.correctionRecord!,
            trackedBaseRef.current,
            res.nextTransactions
          );
          void flushSyncQueue();
        })();
      }
      return { ok: true };
    },
    [userId, effectiveUserId, effectiveProjectId, commitState, flushSyncQueue]
  );

  const setDefaultPaymentMethod = useCallback(
    (method: PaymentMethod) => {
      commitState((prev) => ({
        ...prev,
        defaultPaymentMethod: method,
        sessions: prev.sessions.map((s) =>
          s.id === activeSession.id ? { ...s, defaultPaymentMethod: method } : s
        ),
      }));
    },
    [commitState, activeSession.id]
  );

  const togglePinProduct = useCallback(
    (productKey: string) => {
      commitState((prev) => {
        const exists = prev.pinnedKeys.includes(productKey);
        return {
          ...prev,
          pinnedKeys: exists
            ? prev.pinnedKeys.filter((k) => k !== productKey)
            : [productKey, ...prev.pinnedKeys],
        };
      });
      triggerHaptic(6);
    },
    [commitState]
  );

  const setAvailableStockOverride = useCallback(
    (item: LiveInventoryItem, newRemainingAvailable: number | null) => {
      commitState((prev) => {
        const nextOverrides = { ...prev.stockOverrides };
        if (newRemainingAvailable === null) {
          delete nextOverrides[item.key];
        } else {
          const cleanAvailable = Math.max(0, Math.floor(newRemainingAvailable));
          nextOverrides[item.key] = item.soldQty + cleanAvailable;
        }
        return {
          ...prev,
          stockOverrides: nextOverrides,
        };
      });
    },
    [commitState]
  );

  const resolveStockConflict = useCallback(
    (transactionId: string, action: 'acknowledge' | 'reverse') => {
      if (action === 'reverse') {
        return reverseTransaction(transactionId, 'Reversed due to cross-device stock conflict');
      }
      commitState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                stockConflictResolved: true,
                syncStatus:
                  userId && userId !== 'guest' ? 'pending' : 'local_only',
              }
            : t
        ),
      }));
      void flushSyncQueue();
      return { ok: true };
    },
    [reverseTransaction, commitState, userId, flushSyncQueue]
  );

  const closeCurrentDay = useCallback((): {
    closedSession: LiveSellingSession;
    nextSession: LiveSellingSession;
    report: DailySalesReport;
  } => {
    const now = Date.now();
    const current = stateRef.current;
    const report = computeDailySalesReport({
      transactions: current.transactions,
      inventoryCatalog: catalogBeforeConflicts,
      sessionId: activeSession.id,
      dateKey: activeSession.dateKey,
      sessionLabel: activeSession.label,
    });

    const hasPendingInSession = current.transactions.some(
      (t) =>
        t.sessionId === activeSession.id &&
        (t.syncStatus === 'pending' || t.syncStatus === 'failed')
    );

    const closedSession: LiveSellingSession = {
      ...activeSession,
      status: 'closed',
      closedAtMs: now,
      pendingSyncOnClose: hasPendingInSession,
      closedReportSnapshot: report,
    };

    const nextSession = createSellingSession(
      effectiveProjectId,
      [closedSession, ...current.sessions.filter((s) => s.id !== closedSession.id)],
      current.defaultPaymentMethod,
      now + 1
    );

    commitState((prev) => ({
      ...prev,
      sessions: [
        nextSession,
        ...prev.sessions.map((s) =>
          s.id === closedSession.id ? closedSession : s
        ),
      ],
    }));

    setSelectedReportSessionId(closedSession.id);
    triggerHaptic(16);

    if (userId && userId !== 'guest' && typeof navigator !== 'undefined' && navigator.onLine) {
      void Promise.all([
        syncLiveSessionToFirestore(userId, effectiveProjectId, closedSession),
        syncLiveSessionToFirestore(userId, effectiveProjectId, nextSession),
      ]).catch(() => {});
    }

    return { closedSession, nextSession, report };
  }, [
    catalogBeforeConflicts,
    activeSession,
    effectiveProjectId,
    commitState,
    userId,
  ]);

  const currentSessionReport = useMemo(
    () =>
      computeDailySalesReport({
        transactions: state.transactions,
        inventoryCatalog: catalogBeforeConflicts,
        sessionId: activeSession.id,
        dateKey: activeSession.dateKey,
        sessionLabel: activeSession.label,
      }),
    [state.transactions, catalogBeforeConflicts, activeSession]
  );

  const selectedSessionReport = useMemo(() => {
    if (!selectedReportSessionId || selectedReportSessionId === activeSession.id) {
      return currentSessionReport;
    }
    const foundSess = state.sessions.find((s) => s.id === selectedReportSessionId);
    if (!foundSess) return currentSessionReport;
    // Compute fresh report from transactions so post-close reversals/adjustments stay accurate,
    // falling back cleanly if empty
    const computed = computeDailySalesReport({
      transactions: state.transactions,
      inventoryCatalog: catalogBeforeConflicts,
      sessionId: foundSess.id,
      dateKey: foundSess.dateKey,
      sessionLabel: foundSess.label,
    });
    if (computed.transactionCount === 0 && foundSess.closedReportSnapshot) {
      return foundSess.closedReportSnapshot;
    }
    return computed;
  }, [
    selectedReportSessionId,
    activeSession.id,
    currentSessionReport,
    state.sessions,
    state.transactions,
    catalogBeforeConflicts,
  ]);

  const syncSummary = useMemo(
    () => deriveOverallSyncStatus(userId, state.transactions, isSyncing),
    [userId, state.transactions, isSyncing]
  );

  const liveDerivedActualSales: ActualSaleRecord[] = useMemo(() => {
    const out: ActualSaleRecord[] = [];
    for (const txn of state.transactions) {
      if (!isActiveValidSale(txn)) continue;
      for (const l of txn.items) {
        out.push({
          id: `live_${txn.id}_${l.lineId}`,
          groupId: l.groupId,
          categoryName: l.categoryNameSnapshot,
          productId: l.productId,
          productName: l.productNameSnapshot,
          qtySold: l.quantity,
          actualPricePerUnit: l.actualUnitPrice,
          unitCost: l.purchaseCostPerUnitSnapshot,
          recordedAtMs: txn.timestampMs,
        });
      }
    }
    return out;
  }, [state.transactions]);

  const conflictTransactions = useMemo(
    () =>
      state.transactions.filter(
        (t) => Boolean(t.stockConflict) && !t.stockConflictResolved
      ),
    [state.transactions]
  );

  return {
    inventoryCatalog: catalogBeforeConflicts,
    transactions: state.transactions,
    sessions: state.sessions,
    activeSession,
    pinnedKeys: state.pinnedKeys,
    defaultPaymentMethod: state.defaultPaymentMethod,
    basket,
    undoBanner,
    dismissUndoBanner: () => setUndoBanner(null),
    isOnline,
    isSyncing,
    syncSummary,
    wakeLockActive,
    currentSessionReport,
    selectedReportSessionId: selectedReportSessionId || activeSession.id,
    setSelectedReportSessionId,
    selectedSessionReport,
    liveDerivedActualSales,
    conflictTransactions,
    recordQuickSale,
    addToBasket,
    updateBasketEntry,
    removeFromBasket,
    clearBasket,
    completeBasketSale,
    reverseTransaction,
    correctTransaction,
    setDefaultPaymentMethod,
    togglePinProduct,
    setAvailableStockOverride,
    resolveStockConflict,
    closeCurrentDay,
    syncNow: flushSyncQueue,
    resetLocalLiveState: () =>
      commitState(() => createEmptyLiveState(effectiveUserId, effectiveProjectId)),
  };
}

export type LiveSellingController = ReturnType<typeof useLiveSelling>;
