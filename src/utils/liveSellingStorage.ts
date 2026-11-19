import type {
  LiveSaleTransaction,
  LiveSellingSession,
  PaymentMethod,
} from '../types/stall';

export interface LiveSellingLocalState {
  userId: string;
  projectId: string;
  transactions: LiveSaleTransaction[];
  sessions: LiveSellingSession[];
  pinnedKeys: string[];
  stockOverrides: Record<string, number>;
  defaultPaymentMethod: PaymentMethod;
  updatedAtMs: number;
}

const STORAGE_PREFIX = 'stalliq_live_v1_';
const IDB_NAME = 'stalliq_live_selling_db';
const IDB_VERSION = 1;
const IDB_STORE = 'project_live_state';

const VALID_PAYMENT_METHODS = new Set<PaymentMethod>([
  'cash',
  'upi',
  'card',
  'other',
  'unrecorded',
]);

export function makeLiveStorageKey(userId: string | null | undefined, projectId: string): string {
  const safeUid = (userId || 'guest').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  const safeProj = (projectId || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
  return `${STORAGE_PREFIX}${safeUid}__${safeProj}`;
}

export function createEmptyLiveState(
  userId: string | null | undefined,
  projectId: string
): LiveSellingLocalState {
  return {
    userId: (userId || 'guest').trim() || 'guest',
    projectId,
    transactions: [],
    sessions: [],
    pinnedKeys: [],
    stockOverrides: {},
    defaultPaymentMethod: 'unrecorded',
    updatedAtMs: Date.now(),
  };
}

export function sanitizeLiveState(
  raw: Partial<LiveSellingLocalState> | null | undefined,
  userId: string | null | undefined,
  projectId: string
): LiveSellingLocalState {
  const base = createEmptyLiveState(userId, projectId);
  if (!raw || typeof raw !== 'object') return base;

  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.filter(
        (t): t is LiveSaleTransaction =>
          Boolean(t) &&
          typeof t.id === 'string' &&
          Array.isArray(t.items) &&
          typeof t.timestampMs === 'number'
      )
    : [];

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(
        (s): s is LiveSellingSession =>
          Boolean(s) &&
          typeof s.id === 'string' &&
          typeof s.dateKey === 'string' &&
          (s.status === 'open' || s.status === 'closed')
      )
    : [];

  const pinnedKeys = Array.isArray(raw.pinnedKeys)
    ? Array.from(
        new Set(raw.pinnedKeys.filter((k): k is string => typeof k === 'string' && k.length > 0))
      )
    : [];

  const stockOverrides: Record<string, number> = {};
  if (raw.stockOverrides && typeof raw.stockOverrides === 'object') {
    for (const [k, v] of Object.entries(raw.stockOverrides)) {
      if (typeof k === 'string' && k.length > 0 && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        stockOverrides[k] = Math.floor(v);
      }
    }
  }

  const defaultPaymentMethod: PaymentMethod =
    raw.defaultPaymentMethod && VALID_PAYMENT_METHODS.has(raw.defaultPaymentMethod)
      ? raw.defaultPaymentMethod
      : 'unrecorded';

  return {
    userId: base.userId,
    projectId,
    transactions,
    sessions,
    pinnedKeys,
    stockOverrides,
    defaultPaymentMethod,
    updatedAtMs: typeof raw.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs) ? raw.updatedAtMs : Date.now(),
  };
}

/**
 * Synchronous load from localStorage mirror (fast bootstrap with zero offline flash).
 */
export function loadLiveStateSync(
  userId: string | null | undefined,
  projectId: string
): LiveSellingLocalState {
  const key = makeLiveStorageKey(userId, projectId);
  if (typeof window === 'undefined') {
    return createEmptyLiveState(userId, projectId);
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return createEmptyLiveState(userId, projectId);
    const parsed = JSON.parse(raw) as Partial<LiveSellingLocalState>;
    // Double-check strict projectId & userId isolation
    const safeUid = (userId || 'guest').trim() || 'guest';
    if (parsed.projectId !== projectId || (parsed.userId && parsed.userId !== safeUid)) {
      return createEmptyLiveState(userId, projectId);
    }
    return sanitizeLiveState(parsed, userId, projectId);
  } catch {
    return createEmptyLiveState(userId, projectId);
  }
}

function openLiveDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Load asynchronously from IndexedDB (preferred for large offline transaction history)
 * and reconcile cleanly with localStorage mirror by newest updatedAtMs.
 */
export async function loadLiveStateAsync(
  userId: string | null | undefined,
  projectId: string
): Promise<LiveSellingLocalState> {
  const syncState = loadLiveStateSync(userId, projectId);
  const key = makeLiveStorageKey(userId, projectId);
  const idb = await openLiveDb();
  if (!idb) return syncState;

  try {
    const idbData = await new Promise<Partial<LiveSellingLocalState> | null>((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve((getReq.result as Partial<LiveSellingLocalState>) || null);
      getReq.onerror = () => resolve(null);
    });
    idb.close();

    if (!idbData) return syncState;
    const safeUid = (userId || 'guest').trim() || 'guest';
    if (idbData.projectId !== projectId || (idbData.userId && idbData.userId !== safeUid)) {
      return syncState;
    }

    const parsedIdb = sanitizeLiveState(idbData, userId, projectId);
    // Pick whichever store holds more transactions or a newer update timestamp
    if (
      parsedIdb.transactions.length > syncState.transactions.length ||
      parsedIdb.updatedAtMs > syncState.updatedAtMs
    ) {
      return parsedIdb;
    }
    return syncState;
  } catch {
    try {
      idb.close();
    } catch {
      // ignore
    }
    return syncState;
  }
}

/**
 * Persist Live Selling state synchronously to localStorage AND asynchronously to IndexedDB
 * so reloads while offline never lose pending transactions or session state.
 */
export function persistLiveState(state: LiveSellingLocalState): void {
  const clean = sanitizeLiveState(state, state.userId, state.projectId);
  clean.updatedAtMs = Date.now();
  const key = makeLiveStorageKey(clean.userId, clean.projectId);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(clean));
    } catch {
      // Quota fallback handled via IndexedDB below
    }

    void openLiveDb().then((idb) => {
      if (!idb) return;
      try {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(clean, key);
        tx.oncomplete = () => idb.close();
        tx.onerror = () => idb.close();
      } catch {
        try {
          idb.close();
        } catch {
          // ignore
        }
      }
    });
  }
}

export function getOrCreateDeviceId(): string {
  const DEVICE_KEY = 'stalliq_device_id_v1';
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 6) return existing;
    const created = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}
