import type {
  ActualSaleRecord,
  CategoryGroupResolved,
  DailySalesReport,
  LiveInventoryItem,
  LiveSaleLineItem,
  LiveSaleTransaction,
  LiveSellingSession,
  PaymentMethod,
  PurchaseItemProgress,
  SyncState,
} from '../types/stall';
import { makePurchaseItemKey } from './orderAndProjectEngine';

export const QUICK_DISCOUNT_PRESETS = [0, 20, 30, 40, 50] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  other: 'Other',
  unrecorded: 'Not recorded',
};

/**
 * Convert INR rupee value into integer minor units (paise) to avoid floating-point drift.
 */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Convert integer minor units (paise) back into clean INR rupees (up to 2 decimals).
 */
export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/**
 * Format INR currency cleanly (shows decimals only when non-zero paise exist).
 */
export function formatInr(amount: number): string {
  const clean = fromPaise(toPaise(amount));
  const hasDecimals = Math.abs(clean - Math.round(clean)) > 0.001;
  return `₹${clean.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  })}`;
}

export function generateUniqueId(prefix: string): string {
  const ts = Date.now().toString(36);
  const randA = Math.random().toString(36).slice(2, 8);
  const randB = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${randA}${randB}`;
}

export function getLocalDateKey(timestampMs = Date.now()): string {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatSessionLabel(dateKey: string, dayNumber: number): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const shortDate = dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    return `Day ${dayNumber} · ${shortDate}`;
  }
  return `Day ${dayNumber}`;
}

export interface DiscountValidationResult {
  valid: boolean;
  originalUnitPrice: number;
  perUnitDiscount: number;
  actualUnitPrice: number;
  error?: string;
}

/**
 * Strictly validate fixed rupee discount:
 * - Original selling price must be > 0
 * - Discount must be >= 0
 * - Final actual selling price must be strictly > 0 (never zero or negative)
 */
export function validateDiscount(
  originalUnitPrice: number,
  perUnitDiscount: number
): DiscountValidationResult {
  const origP = toPaise(originalUnitPrice);
  const discP = toPaise(perUnitDiscount);

  if (!Number.isFinite(originalUnitPrice) || origP <= 0) {
    return {
      valid: false,
      originalUnitPrice: fromPaise(Math.max(0, origP)),
      perUnitDiscount: 0,
      actualUnitPrice: 0,
      error: 'Product selling price must be greater than ₹0.',
    };
  }

  if (!Number.isFinite(perUnitDiscount) || discP < 0) {
    return {
      valid: false,
      originalUnitPrice: fromPaise(origP),
      perUnitDiscount: 0,
      actualUnitPrice: fromPaise(origP),
      error: 'Discount cannot be negative.',
    };
  }

  const actualP = origP - discP;
  if (actualP <= 0) {
    return {
      valid: false,
      originalUnitPrice: fromPaise(origP),
      perUnitDiscount: fromPaise(discP),
      actualUnitPrice: fromPaise(actualP),
      error: `Discount must be less than ₹${fromPaise(origP)} so final price stays above ₹0.`,
    };
  }

  return {
    valid: true,
    originalUnitPrice: fromPaise(origP),
    perUnitDiscount: fromPaise(discP),
    actualUnitPrice: fromPaise(actualP),
  };
}

export interface SaleLineInput {
  groupId: string;
  categoryName: string;
  productId: string;
  productName: string;
  quantity: number;
  originalUnitPrice: number;
  perUnitDiscount?: number;
  purchaseCostPerUnit: number;
  stockTracked: boolean;
}

/**
 * Build one financial line item using integer minor units (paise).
 */
export function buildSaleLineItem(input: SaleLineInput): {
  line?: LiveSaleLineItem;
  error?: string;
} {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    return { error: 'Quantity must be at least 1.' };
  }

  const check = validateDiscount(
    input.originalUnitPrice,
    input.perUnitDiscount ?? 0
  );
  if (!check.valid) {
    return { error: check.error };
  }

  const origUnitP = toPaise(check.originalUnitPrice);
  const discUnitP = toPaise(check.perUnitDiscount);
  const actualUnitP = origUnitP - discUnitP;
  const costUnitP = Math.max(0, toPaise(input.purchaseCostPerUnit));

  const originalTotalP = origUnitP * qty;
  const totalDiscountP = discUnitP * qty;
  const actualRevenueP = originalTotalP - totalDiscountP;
  const totalCogsP = costUnitP * qty;
  const realizedGrossProfitP = actualRevenueP - totalCogsP;

  return {
    line: {
      lineId: generateUniqueId('line'),
      groupId: input.groupId,
      categoryNameSnapshot: input.categoryName.trim() || 'General',
      productId: input.productId,
      productNameSnapshot: input.productName.trim() || 'Product',
      quantity: qty,
      originalUnitPrice: fromPaise(origUnitP),
      perUnitDiscount: fromPaise(discUnitP),
      actualUnitPrice: fromPaise(actualUnitP),
      originalTotalValue: fromPaise(originalTotalP),
      totalDiscount: fromPaise(totalDiscountP),
      actualTotalRevenue: fromPaise(actualRevenueP),
      purchaseCostPerUnitSnapshot: fromPaise(costUnitP),
      totalCogs: fromPaise(totalCogsP),
      realizedGrossProfit: fromPaise(realizedGrossProfitP),
      stockTracked: Boolean(input.stockTracked),
    },
  };
}

export interface CreateSaleTransactionParams {
  userId: string;
  projectId: string;
  sessionId: string;
  items: SaleLineInput[];
  paymentMethod?: PaymentMethod;
  syncStatus?: SyncState;
  timestampMs?: number;
  note?: string;
  deviceId?: string;
  correctionOfTransactionId?: string | null;
}

/**
 * Create a single-product or multi-product basket transaction with exact paise aggregation.
 */
export function createSaleTransaction(
  params: CreateSaleTransactionParams
): { transaction?: LiveSaleTransaction; error?: string } {
  if (!params.items || params.items.length === 0) {
    return { error: 'At least one product is required to register a sale.' };
  }

  const builtLines: LiveSaleLineItem[] = [];
  for (const item of params.items) {
    const res = buildSaleLineItem(item);
    if (res.error || !res.line) {
      return { error: res.error || 'Invalid sale item.' };
    }
    builtLines.push(res.line);
  }

  let totalQty = 0;
  let origTotalP = 0;
  let discTotalP = 0;
  let actualRevP = 0;
  let totalCogsP = 0;
  let grossProfitP = 0;

  for (const line of builtLines) {
    totalQty += line.quantity;
    origTotalP += toPaise(line.originalTotalValue);
    discTotalP += toPaise(line.totalDiscount);
    actualRevP += toPaise(line.actualTotalRevenue);
    totalCogsP += toPaise(line.totalCogs);
    grossProfitP += toPaise(line.realizedGrossProfit);
  }

  const first = builtLines[0];
  const isBasket = builtLines.length > 1;
  const paymentMethod: PaymentMethod = params.paymentMethod || 'unrecorded';
  const now = params.timestampMs ?? Date.now();

  const transaction: LiveSaleTransaction = {
    id: generateUniqueId('txn'),
    userId: params.userId || 'guest',
    projectId: params.projectId,
    sessionId: params.sessionId,
    isBasket,
    items: builtLines,
    primaryProductId: first.productId,
    primaryProductName: isBasket
      ? `${first.productNameSnapshot} + ${builtLines.length - 1} more`
      : first.productNameSnapshot,
    primaryCategoryName: isBasket ? 'Basket' : first.categoryNameSnapshot,
    totalQuantity: totalQty,
    originalTotalValue: fromPaise(origTotalP),
    totalDiscount: fromPaise(discTotalP),
    actualTotalRevenue: fromPaise(actualRevP),
    totalCogs: fromPaise(totalCogsP),
    realizedGrossProfit: fromPaise(grossProfitP),
    paymentMethod,
    timestampMs: now,
    status: 'completed',
    syncStatus: params.syncStatus || 'local_only',
    syncedAtMs: null,
    syncError: null,
    stockConflict: false,
    stockConflictNote: null,
    stockConflictResolved: false,
    reversalOfTransactionId: null,
    reversedByTransactionId: null,
    correctionOfTransactionId: params.correctionOfTransactionId ?? null,
    correctedByTransactionId: null,
    ...(params.note?.trim() ? { note: params.note.trim().slice(0, 240) } : {}),
    ...(params.deviceId ? { deviceId: params.deviceId } : {}),
  };

  return { transaction };
}

/**
 * Reverse an existing completed transaction without deleting it.
 * Prevents duplicate reversals idempotently.
 */
export function reverseSaleTransaction(
  transactions: LiveSaleTransaction[],
  targetId: string,
  opts: {
    userId: string;
    reason?: string;
    syncStatus?: SyncState;
    timestampMs?: number;
  }
): {
  nextTransactions: LiveSaleTransaction[];
  reversalRecord?: LiveSaleTransaction;
  updatedOriginal?: LiveSaleTransaction;
  error?: string;
} {
  const original = transactions.find((t) => t.id === targetId);
  if (!original) {
    return { nextTransactions: transactions, error: 'Transaction not found.' };
  }
  if (original.status === 'reversed' || original.reversedByTransactionId) {
    return {
      nextTransactions: transactions,
      error: 'Transaction has already been reversed.',
    };
  }
  if (original.reversalOfTransactionId) {
    return {
      nextTransactions: transactions,
      error: 'Cannot reverse a reversal audit entry.',
    };
  }

  const now = opts.timestampMs ?? Date.now();
  const reversalId = generateUniqueId('rev');

  // Reversal record preserves immutable audit trail with zero active financial impact
  // because the original is marked status: 'reversed' and reversal entries have status: 'reversed'
  const reversalRecord: LiveSaleTransaction = {
    ...original,
    id: reversalId,
    userId: opts.userId || original.userId,
    timestampMs: now,
    status: 'reversed',
    syncStatus: opts.syncStatus || (original.userId === 'guest' ? 'local_only' : 'pending'),
    syncedAtMs: null,
    syncError: null,
    reversalOfTransactionId: original.id,
    reversedByTransactionId: null,
    correctionOfTransactionId: null,
    correctedByTransactionId: null,
    note: opts.reason?.trim() || 'Sale reversed / undone',
  };

  const updatedOriginal: LiveSaleTransaction = {
    ...original,
    status: 'reversed',
    reversedByTransactionId: reversalId,
    syncStatus:
      opts.syncStatus ||
      (original.userId === 'guest' ? 'local_only' : 'pending'),
    syncError: null,
    note: opts.reason?.trim() || original.note || 'Reversed',
  };

  const nextTransactions = [
    reversalRecord,
    ...transactions.map((t) => (t.id === original.id ? updatedOriginal : t)),
  ];

  return {
    nextTransactions,
    reversalRecord,
    updatedOriginal,
  };
}

/**
 * Correct an existing completed transaction by superseding the original (status: 'corrected')
 * and recording a linked replacement transaction. Preserves complete audit history.
 */
export function correctSaleTransaction(
  transactions: LiveSaleTransaction[],
  targetId: string,
  opts: {
    userId: string;
    items: SaleLineInput[];
    paymentMethod: PaymentMethod;
    reason?: string;
    syncStatus?: SyncState;
    timestampMs?: number;
  }
): {
  nextTransactions: LiveSaleTransaction[];
  correctionRecord?: LiveSaleTransaction;
  updatedOriginal?: LiveSaleTransaction;
  error?: string;
} {
  const original = transactions.find((t) => t.id === targetId);
  if (!original) {
    return { nextTransactions: transactions, error: 'Transaction not found.' };
  }
  if (original.status !== 'completed') {
    return {
      nextTransactions: transactions,
      error: 'Only active completed transactions can be corrected.',
    };
  }

  const created = createSaleTransaction({
    userId: opts.userId || original.userId,
    projectId: original.projectId,
    sessionId: original.sessionId,
    items: opts.items,
    paymentMethod: opts.paymentMethod,
    syncStatus:
      opts.syncStatus || (original.userId === 'guest' ? 'local_only' : 'pending'),
    timestampMs: opts.timestampMs ?? Date.now(),
    note: opts.reason?.trim() || `Correction of ${original.id}`,
    deviceId: original.deviceId,
    correctionOfTransactionId: original.id,
  });

  if (created.error || !created.transaction) {
    return {
      nextTransactions: transactions,
      error: created.error || 'Unable to create correction.',
    };
  }

  const updatedOriginal: LiveSaleTransaction = {
    ...original,
    status: 'corrected',
    correctedByTransactionId: created.transaction.id,
    syncStatus:
      opts.syncStatus || (original.userId === 'guest' ? 'local_only' : 'pending'),
    syncError: null,
  };

  const nextTransactions = [
    created.transaction,
    ...transactions.map((t) => (t.id === original.id ? updatedOriginal : t)),
  ];

  return {
    nextTransactions,
    correctionRecord: created.transaction,
    updatedOriginal,
  };
}

/**
 * Returns true if a transaction contributes to active sales revenue, units, and stock deduction.
 * Cancelled ('reversed'), superseded ('corrected'), and reversal audit entries are strictly excluded.
 */
export function isActiveValidSale(txn: LiveSaleTransaction): boolean {
  return txn.status === 'completed' && !txn.reversalOfTransactionId;
}

/**
 * Compute live selling inventory catalog directly from StallIQ's real project categories,
 * purchase progress, stock overrides, and completed sales transactions.
 *
 * Crucial distinction:
 * - Planned quantity (from active combo or product.plannedQty)
 * - Purchased/received quantity (from purchaseProgress)
 * - Available quantity (trackedBaseQty - soldQty, or null if untracked)
 * - Unknown / untracked quantity is NEVER treated as zero!
 */
export function computeLiveInventoryCatalog(params: {
  resolvedGroups: CategoryGroupResolved[];
  purchaseProgress?: Record<string, PurchaseItemProgress>;
  transactions: LiveSaleTransaction[];
  pinnedKeys?: string[];
  stockOverrides?: Record<string, number>;
}): LiveInventoryItem[] {
  const {
    resolvedGroups,
    purchaseProgress = {},
    transactions,
    pinnedKeys = [],
    stockOverrides = {},
  } = params;

  const pinnedSet = new Set(pinnedKeys);

  // Aggregate sold quantity, frequency, and recency per (groupId::productId)
  const soldByKey = new Map<
    string,
    { qty: number; frequency: number; lastSoldAtMs: number | null }
  >();

  for (const txn of transactions) {
    if (!isActiveValidSale(txn)) continue;
    for (const line of txn.items) {
      const key = makePurchaseItemKey(line.groupId, line.productId);
      const prev = soldByKey.get(key) || {
        qty: 0,
        frequency: 0,
        lastSoldAtMs: null,
      };
      prev.qty += line.quantity;
      prev.frequency += 1;
      prev.lastSoldAtMs =
        prev.lastSoldAtMs === null
          ? txn.timestampMs
          : Math.max(prev.lastSoldAtMs, txn.timestampMs);
      soldByKey.set(key, prev);
    }
  }

  const catalog: LiveInventoryItem[] = [];

  resolvedGroups.forEach(({ group, activeCombo }) => {
    group.categories.forEach((cat, idx) => {
      const key = makePurchaseItemKey(group.id, cat.id);
      const prog = purchaseProgress[key];
      const purchasedQty =
        prog && typeof prog.receivedQty === 'number' && prog.receivedQty > 0
          ? Math.floor(prog.receivedQty)
          : null;

      const comboCount =
        activeCombo && typeof activeCombo.counts[idx] === 'number'
          ? Math.max(0, Math.floor(activeCombo.counts[idx]))
          : null;

      const explicitPlanned =
        typeof cat.plannedQty === 'number' && Number.isFinite(cat.plannedQty)
          ? Math.max(0, Math.floor(cat.plannedQty))
          : null;

      // Determine plannedQty without turning unspecified quantities into 0
      const plannedQty: number | null =
        explicitPlanned !== null
          ? explicitPlanned
          : comboCount !== null && comboCount > 0
          ? comboCount
          : null;

      const overrideQty =
        typeof stockOverrides[key] === 'number' &&
        Number.isFinite(stockOverrides[key]) &&
        stockOverrides[key] >= 0
          ? Math.floor(stockOverrides[key])
          : null;

      // Priority for tracked base stock:
      // 1. Explicit authorized stock override (restock / live adjustment)
      // 2. Received/purchased quantity (if user tracked deliveries)
      // 3. Explicit planned quantity (including explicit 0) or positive active combo count
      // Otherwise: untracked (availableQty = null)
      const trackedBaseQty: number | null =
        overrideQty !== null
          ? overrideQty
          : purchasedQty !== null
          ? purchasedQty
          : plannedQty !== null
          ? plannedQty
          : null;

      const isStockTracked = trackedBaseQty !== null;
      const salesInfo = soldByKey.get(key) || {
        qty: 0,
        frequency: 0,
        lastSoldAtMs: null,
      };

      const rawRemaining = isStockTracked ? trackedBaseQty - salesInfo.qty : null;
      const availableQty =
        rawRemaining !== null ? Math.max(0, rawRemaining) : null;
      const oversoldBy =
        rawRemaining !== null && rawRemaining < 0 ? Math.abs(rawRemaining) : 0;

      catalog.push({
        key,
        groupId: group.id,
        categoryName: group.name,
        categoryColor: group.accentColor,
        productId: cat.id,
        productName: cat.name,
        shortName: cat.shortName || cat.name,
        sellingPrice: fromPaise(toPaise(Math.max(0, cat.price || 0))),
        purchaseCost: fromPaise(toPaise(Math.max(0, cat.cost || 0))),
        imageUrl: cat.imageUrl,
        barColor: cat.barColor,
        plannedQty,
        purchasedQty,
        trackedBaseQty,
        soldQty: salesInfo.qty,
        availableQty,
        oversoldBy,
        isStockTracked,
        isSoldOut: isStockTracked && (availableQty ?? 0) <= 0,
        isPinned: pinnedSet.has(key),
        saleFrequency: salesInfo.frequency,
        lastSoldAtMs: salesInfo.lastSoldAtMs,
      });
    });
  });

  return catalog;
}

/**
 * Validate whether requested quantity can be sold without overselling tracked stock.
 */
export function checkStockAvailability(
  item: LiveInventoryItem,
  requestedQty: number,
  alreadyInBasketQty = 0
): { allowed: boolean; maxAllowed: number | null; error?: string } {
  const qty = Math.floor(Number(requestedQty));
  if (!Number.isFinite(qty) || qty < 1) {
    return { allowed: false, maxAllowed: 0, error: 'Quantity must be at least 1.' };
  }
  if (item.sellingPrice <= 0) {
    return {
      allowed: false,
      maxAllowed: 0,
      error: `Set a selling price for "${item.productName}" in Stock before selling.`,
    };
  }
  if (!item.isStockTracked || item.availableQty === null) {
    return { allowed: true, maxAllowed: null };
  }
  const remainingAfterBasket = Math.max(0, item.availableQty - alreadyInBasketQty);
  if (remainingAfterBasket <= 0) {
    return {
      allowed: false,
      maxAllowed: 0,
      error: `"${item.productName}" is sold out.`,
    };
  }
  if (qty > remainingAfterBasket) {
    return {
      allowed: false,
      maxAllowed: remainingAfterBasket,
      error: `Only ${remainingAfterBasket} unit${remainingAfterBasket === 1 ? '' : 's'} remaining for "${item.productName}".`,
    };
  }
  return { allowed: true, maxAllowed: remainingAfterBasket };
}

/**
 * Compute comprehensive Daily Sales Report & Live Analytics using integer paise math.
 * Always separates Realized Gross Profit from Net Profit and excludes cancelled/superseded transactions.
 */
export function computeDailySalesReport(params: {
  transactions: LiveSaleTransaction[];
  inventoryCatalog: LiveInventoryItem[];
  sessionId?: string | null;
  dateKey?: string;
  sessionLabel?: string;
}): DailySalesReport {
  const { transactions, inventoryCatalog, sessionId, dateKey, sessionLabel } = params;

  const scoped = sessionId
    ? transactions.filter((t) => t.sessionId === sessionId)
    : transactions;

  const validSales = scoped.filter(isActiveValidSale);
  const reversedCount = scoped.filter(
    (t) => t.status === 'reversed' && !t.reversalOfTransactionId
  ).length;
  const pendingSyncCount = scoped.filter(
    (t) => t.syncStatus === 'pending' || t.syncStatus === 'failed' || t.syncStatus === 'syncing'
  ).length;
  const conflictCount = scoped.filter(
    (t) => Boolean(t.stockConflict) && !t.stockConflictResolved
  ).length;

  let totalUnitsSold = 0;
  let origSalesP = 0;
  let totalDiscountP = 0;
  let actualRevP = 0;
  let cogsP = 0;
  let grossProfitP = 0;

  const paymentBreakdownP: Record<PaymentMethod, { revenueP: number; count: number }> = {
    cash: { revenueP: 0, count: 0 },
    upi: { revenueP: 0, count: 0 },
    card: { revenueP: 0, count: 0 },
    other: { revenueP: 0, count: 0 },
    unrecorded: { revenueP: 0, count: 0 },
  };

  const productAgg = new Map<
    string,
    {
      productId: string;
      groupId: string;
      productName: string;
      categoryName: string;
      unitsSold: number;
      originalValueP: number;
      discountP: number;
      revenueP: number;
      cogsP: number;
      grossProfitP: number;
    }
  >();

  const categoryAgg = new Map<
    string,
    {
      groupId: string;
      categoryName: string;
      unitsSold: number;
      originalValueP: number;
      discountP: number;
      revenueP: number;
      cogsP: number;
      grossProfitP: number;
    }
  >();

  for (const txn of validSales) {
    const txnRevP = toPaise(txn.actualTotalRevenue);
    const pm: PaymentMethod = txn.paymentMethod || 'unrecorded';
    paymentBreakdownP[pm].revenueP += txnRevP;
    paymentBreakdownP[pm].count += 1;

    for (const line of txn.items) {
      const lOrigP = toPaise(line.originalTotalValue);
      const lDiscP = toPaise(line.totalDiscount);
      const lRevP = toPaise(line.actualTotalRevenue);
      const lCogsP = toPaise(line.totalCogs);
      const lProfitP = toPaise(line.realizedGrossProfit);

      totalUnitsSold += line.quantity;
      origSalesP += lOrigP;
      totalDiscountP += lDiscP;
      actualRevP += lRevP;
      cogsP += lCogsP;
      grossProfitP += lProfitP;

      const pKey = `${line.groupId}::${line.productId}::${line.productNameSnapshot}`;
      const pPrev = productAgg.get(pKey) || {
        productId: line.productId,
        groupId: line.groupId,
        productName: line.productNameSnapshot,
        categoryName: line.categoryNameSnapshot,
        unitsSold: 0,
        originalValueP: 0,
        discountP: 0,
        revenueP: 0,
        cogsP: 0,
        grossProfitP: 0,
      };
      pPrev.unitsSold += line.quantity;
      pPrev.originalValueP += lOrigP;
      pPrev.discountP += lDiscP;
      pPrev.revenueP += lRevP;
      pPrev.cogsP += lCogsP;
      pPrev.grossProfitP += lProfitP;
      productAgg.set(pKey, pPrev);

      const cKey = line.categoryNameSnapshot;
      const cPrev = categoryAgg.get(cKey) || {
        groupId: line.groupId,
        categoryName: line.categoryNameSnapshot,
        unitsSold: 0,
        originalValueP: 0,
        discountP: 0,
        revenueP: 0,
        cogsP: 0,
        grossProfitP: 0,
      };
      cPrev.unitsSold += line.quantity;
      cPrev.originalValueP += lOrigP;
      cPrev.discountP += lDiscP;
      cPrev.revenueP += lRevP;
      cPrev.cogsP += lCogsP;
      cPrev.grossProfitP += lProfitP;
      categoryAgg.set(cKey, cPrev);
    }
  }

  const transactionCount = validSales.length;
  const averageTransactionValue =
    transactionCount > 0 ? fromPaise(Math.round(actualRevP / transactionCount)) : 0;
  const averageDiscountPerUnit =
    totalUnitsSold > 0 ? fromPaise(Math.round(totalDiscountP / totalUnitsSold)) : 0;

  let remainingTrackedStockUnits = 0;
  let untrackedProductsCount = 0;
  for (const item of inventoryCatalog) {
    if (item.isStockTracked && item.availableQty !== null) {
      remainingTrackedStockUnits += item.availableQty;
    } else {
      untrackedProductsCount += 1;
    }
  }

  const productReport = Array.from(productAgg.values())
    .map((p) => ({
      productId: p.productId,
      groupId: p.groupId,
      productName: p.productName,
      categoryName: p.categoryName,
      unitsSold: p.unitsSold,
      originalValue: fromPaise(p.originalValueP),
      totalDiscount: fromPaise(p.discountP),
      revenue: fromPaise(p.revenueP),
      cogs: fromPaise(p.cogsP),
      realizedGrossProfit: fromPaise(p.grossProfitP),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);

  const categoryReport = Array.from(categoryAgg.values())
    .map((c) => ({
      groupId: c.groupId,
      categoryName: c.categoryName,
      unitsSold: c.unitsSold,
      originalValue: fromPaise(c.originalValueP),
      totalDiscount: fromPaise(c.discountP),
      revenue: fromPaise(c.revenueP),
      cogs: fromPaise(c.cogsP),
      realizedGrossProfit: fromPaise(c.grossProfitP),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);

  return {
    generatedAtMs: Date.now(),
    sessionId: sessionId || null,
    dateKey: dateKey || getLocalDateKey(),
    sessionLabel: sessionLabel || 'Current Session',
    totalUnitsSold,
    transactionCount,
    originalSalesValue: fromPaise(origSalesP),
    totalDiscounts: fromPaise(totalDiscountP),
    actualRevenue: fromPaise(actualRevP),
    costOfGoodsSold: fromPaise(cogsP),
    realizedGrossProfit: fromPaise(grossProfitP),
    averageTransactionValue,
    averageDiscountPerUnit,
    remainingTrackedStockUnits,
    untrackedProductsCount,
    paymentBreakdown: {
      cash: {
        revenue: fromPaise(paymentBreakdownP.cash.revenueP),
        count: paymentBreakdownP.cash.count,
      },
      upi: {
        revenue: fromPaise(paymentBreakdownP.upi.revenueP),
        count: paymentBreakdownP.upi.count,
      },
      card: {
        revenue: fromPaise(paymentBreakdownP.card.revenueP),
        count: paymentBreakdownP.card.count,
      },
      other: {
        revenue: fromPaise(paymentBreakdownP.other.revenueP),
        count: paymentBreakdownP.other.count,
      },
      unrecorded: {
        revenue: fromPaise(paymentBreakdownP.unrecorded.revenueP),
        count: paymentBreakdownP.unrecorded.count,
      },
    },
    productReport,
    categoryReport,
    reversedCount,
    pendingSyncCount,
    conflictCount,
  };
}

/**
 * Bridge valid Live Selling transactions into ActualSaleRecord[] so existing Overview / Insights
 * analytics automatically reflect Live Selling activity without duplicating financial math.
 */
export function mergeLiveSalesIntoActualSales(
  liveTransactions: LiveSaleTransaction[],
  manualActualSales: ActualSaleRecord[]
): ActualSaleRecord[] {
  const fromLive: ActualSaleRecord[] = [];
  for (const txn of liveTransactions) {
    if (!isActiveValidSale(txn)) continue;
    for (const line of txn.items) {
      fromLive.push({
        id: `live_${txn.id}_${line.lineId}`,
        groupId: line.groupId,
        categoryName: line.categoryNameSnapshot,
        productId: line.productId,
        productName: line.productNameSnapshot,
        qtySold: line.quantity,
        actualPricePerUnit: line.actualUnitPrice,
        unitCost: line.purchaseCostPerUnitSnapshot,
        recordedAtMs: txn.timestampMs,
      });
    }
  }
  const manualOnly = manualActualSales.filter((s) => !s.id.startsWith('live_'));
  return [...fromLive, ...manualOnly].sort((a, b) => b.recordedAtMs - a.recordedAtMs);
}

/**
 * Idempotent merge of local transactions and remote Firestore transactions.
 * - Never creates duplicates (keyed strictly by unique transaction ID).
 * - Preserves local unsynced ('pending' | 'failed' | 'local_only') transactions so offline sales never vanish.
 * - Flags stock conflicts if combined sold quantities exceed tracked base stock across devices.
 */
export function mergeSyncedTransactions(params: {
  localTransactions: LiveSaleTransaction[];
  remoteTransactions: LiveSaleTransaction[];
  trackedBaseByKey?: Record<string, number>;
}): {
  merged: LiveSaleTransaction[];
  conflictIds: string[];
} {
  const { localTransactions, remoteTransactions, trackedBaseByKey = {} } = params;
  const byId = new Map<string, LiveSaleTransaction>();

  for (const r of remoteTransactions) {
    byId.set(r.id, { ...r, syncStatus: 'synced' });
  }

  for (const l of localTransactions) {
    const existing = byId.get(l.id);
    if (!existing) {
      byId.set(l.id, l);
    } else if (
      l.syncStatus === 'pending' ||
      l.syncStatus === 'failed' ||
      l.syncStatus === 'syncing'
    ) {
      // Keep newer local status mutations (e.g., offline reversal of an already-synced sale)
      // until sync commits them to Firestore.
      if (l.status !== existing.status) {
        byId.set(l.id, l);
      } else {
        byId.set(l.id, { ...existing, syncStatus: 'synced' });
      }
    }
  }

  // Sort oldest -> newest to evaluate cumulative stock conflicts deterministically
  const chronological = Array.from(byId.values()).sort(
    (a, b) => a.timestampMs - b.timestampMs
  );

  const runningSold = new Map<string, number>();
  const conflictIds: string[] = [];

  const evaluated = chronological.map((txn) => {
    if (!isActiveValidSale(txn)) return txn;
    let hasConflict = Boolean(txn.stockConflict);
    let conflictNote = txn.stockConflictNote || null;

    if (!txn.stockConflictResolved) {
      for (const line of txn.items) {
        const key = makePurchaseItemKey(line.groupId, line.productId);
        const base = trackedBaseByKey[key];
        const nextSold = (runningSold.get(key) || 0) + line.quantity;
        runningSold.set(key, nextSold);

        if (typeof base === 'number' && Number.isFinite(base) && nextSold > base) {
          hasConflict = true;
          conflictNote = `Total sold (${nextSold}) exceeds tracked stock (${base}) for ${line.productNameSnapshot}. Review stock or adjust sale.`;
        }
      }
    }

    if (hasConflict && !txn.stockConflictResolved) {
      conflictIds.push(txn.id);
    }

    return hasConflict !== Boolean(txn.stockConflict) || conflictNote !== (txn.stockConflictNote || null)
      ? { ...txn, stockConflict: hasConflict, stockConflictNote: conflictNote }
      : txn;
  });

  // Return newest-first for UI display
  const merged = evaluated.sort((a, b) => b.timestampMs - a.timestampMs);
  return { merged, conflictIds };
}

/**
 * Create a new open selling session for a project.
 */
export function createSellingSession(
  projectId: string,
  existingSessions: LiveSellingSession[],
  defaultPaymentMethod: PaymentMethod = 'unrecorded',
  timestampMs = Date.now()
): LiveSellingSession {
  const dateKey = getLocalDateKey(timestampMs);
  const dayNumber = existingSessions.length + 1;
  return {
    id: generateUniqueId('sess'),
    projectId,
    dateKey,
    label: formatSessionLabel(dateKey, dayNumber),
    status: 'open',
    startedAtMs: timestampMs,
    closedAtMs: null,
    defaultPaymentMethod,
    pendingSyncOnClose: false,
    closedReportSnapshot: null,
  };
}
