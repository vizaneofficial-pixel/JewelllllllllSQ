import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Edit3,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  LiveSaleTransaction,
  LiveSellingSession,
  PaymentMethod,
} from '../../types/stall';
import {
  PAYMENT_METHOD_LABELS,
  formatInr,
  validateDiscount,
  type SaleLineInput,
} from '../../utils/liveSellingEngine';

interface SalesHistoryViewProps {
  transactions: LiveSaleTransaction[];
  sessions: LiveSellingSession[];
  activeSessionId: string;
  onReverseTransaction: (
    txnId: string,
    reason?: string
  ) => { ok: boolean; error?: string };
  onCorrectTransaction: (
    txnId: string,
    opts: { items: SaleLineInput[]; paymentMethod: PaymentMethod; reason?: string }
  ) => { ok: boolean; error?: string };
}

type HistoryFilter = 'all' | 'active' | 'discounts' | 'adjusted';

const PAYMENT_OPTIONS: PaymentMethod[] = ['unrecorded', 'upi', 'cash', 'card', 'other'];

export function SalesHistoryView({
  transactions,
  sessions,
  activeSessionId,
  onReverseTransaction,
  onCorrectTransaction,
}: SalesHistoryViewProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [scope, setScope] = useState<'session' | 'all_days'>('session');
  const [search, setSearch] = useState('');
  const [editingTxn, setEditingTxn] = useState<LiveSaleTransaction | null>(null);
  const [editQtys, setEditQtys] = useState<number[]>([]);
  const [editDiscounts, setEditDiscounts] = useState<number[]>([]);
  const [editPayment, setEditPayment] = useState<PaymentMethod>('unrecorded');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const sessionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sessions) m.set(s.id, s.label);
    return m;
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (scope === 'session' && t.sessionId !== activeSessionId) return false;
      if (filter === 'active' && t.status !== 'completed') return false;
      if (
        filter === 'discounts' &&
        (t.totalDiscount <= 0 || t.status !== 'completed')
      ) {
        return false;
      }
      if (filter === 'adjusted' && t.status === 'completed') return false;
      if (q) {
        const hay = `${t.primaryProductName} ${t.primaryCategoryName} ${t.items
          .map((i) => i.productNameSnapshot)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, scope, activeSessionId, filter, search]);

  const openCorrection = (txn: LiveSaleTransaction) => {
    setEditingTxn(txn);
    setEditQtys(txn.items.map((i) => i.quantity));
    setEditDiscounts(txn.items.map((i) => i.perUnitDiscount));
    setEditPayment(txn.paymentMethod);
    setEditReason('');
    setEditError(null);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;

    const lineInputs: SaleLineInput[] = [];
    for (let idx = 0; idx < editingTxn.items.length; idx += 1) {
      const orig = editingTxn.items[idx];
      const qty = Math.max(1, Math.floor(editQtys[idx] ?? orig.quantity));
      const disc = Math.max(0, Number(editDiscounts[idx] ?? orig.perUnitDiscount) || 0);
      const check = validateDiscount(orig.originalUnitPrice, disc);
      if (!check.valid) {
        setEditError(`${orig.productNameSnapshot}: ${check.error}`);
        return;
      }
      lineInputs.push({
        groupId: orig.groupId,
        categoryName: orig.categoryNameSnapshot,
        productId: orig.productId,
        productName: orig.productNameSnapshot,
        quantity: qty,
        originalUnitPrice: orig.originalUnitPrice,
        perUnitDiscount: disc,
        purchaseCostPerUnit: orig.purchaseCostPerUnitSnapshot,
        stockTracked: orig.stockTracked,
      });
    }

    const res = onCorrectTransaction(editingTxn.id, {
      items: lineInputs,
      paymentMethod: editPayment,
      reason: editReason.trim() || 'Corrected from sales history',
    });
    if (!res.ok) {
      setEditError(res.error || 'Unable to save correction');
      return;
    }
    setEditingTxn(null);
  };

  return (
    <div className="space-y-3">
      {/* Search + Scope */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-[#8C84A6] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter history by item..."
            aria-label="Search sales history"
            className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-[#13111C] border border-[#252136] text-xs text-[#F5F3FA]"
          />
        </div>
        <div className="inline-flex rounded-xl bg-[#13111C] border border-[#252136] p-1">
          <button
            type="button"
            onClick={() => setScope('session')}
            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold ${
              scope === 'session' ? 'bg-[#8B5CF6] text-white' : 'text-[#A29BB8]'
            }`}
          >
            Current Day
          </button>
          <button
            type="button"
            onClick={() => setScope('all_days')}
            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold ${
              scope === 'all_days' ? 'bg-[#8B5CF6] text-white' : 'text-[#A29BB8]'
            }`}
          >
            All Days
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(
          [
            ['all', 'All Entries'],
            ['active', 'Completed'],
            ['discounts', 'Bargains / Discounts'],
            ['adjusted', 'Reversed / Corrected'],
          ] as Array<[HistoryFilter, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 min-h-[34px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
              filter === id
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-8 text-center space-y-1.5">
          <Clock className="w-6 h-6 text-[#8C84A6] mx-auto" />
          <div className="text-sm font-semibold text-[#F5F3FA]">
            No sales matching filter
          </div>
          <p className="text-xs text-[#9D95B8]">
            Completed sales, reversals, and corrections appear here with full timestamps.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((txn) => {
            const timeLabel = new Date(txn.timestampMs).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isReversalEntry = Boolean(txn.reversalOfTransactionId);
            const isActive = txn.status === 'completed';

            return (
              <div
                key={txn.id}
                className={`rounded-2xl border p-3.5 space-y-2.5 ${
                  txn.stockConflict && !txn.stockConflictResolved
                    ? 'bg-[#21151B] border-[#FB7185]/45'
                    : isActive
                    ? 'bg-[#13111C] border-[#252136]'
                    : 'bg-[#100E18] border-[#221E33] opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-[#F5F3FA] truncate">
                        {txn.isBasket
                          ? txn.primaryProductName
                          : `${txn.totalQuantity}× ${txn.primaryProductName}`}
                      </span>
                      {txn.status === 'reversed' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#FB7185]/18 text-[#FDA4AF]">
                          {isReversalEntry ? 'Reversal Entry' : 'Reversed'}
                        </span>
                      )}
                      {txn.status === 'corrected' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#F59E0B]/18 text-[#FCD34D]">
                          Corrected
                        </span>
                      )}
                      {txn.correctionOfTransactionId && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#8B5CF6]/20 text-[#C4B5FD]">
                          Correction
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#9D95B8] mt-0.5">
                      <span>{timeLabel}</span>
                      <span>·</span>
                      <span>{sessionMap.get(txn.sessionId) || 'Session'}</span>
                      <span>·</span>
                      <span>{PAYMENT_METHOD_LABELS[txn.paymentMethod]}</span>
                      <span>·</span>
                      <span>
                        {txn.syncStatus === 'synced'
                          ? 'Synced'
                          : txn.syncStatus === 'failed'
                          ? 'Sync retry queued'
                          : 'Saved locally'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono tabular-nums text-base font-bold ${
                        isActive ? 'text-[#F5F3FA]' : 'text-[#8C84A6] line-through'
                      }`}
                    >
                      {formatInr(txn.actualTotalRevenue)}
                    </div>
                    {txn.totalDiscount > 0 && (
                      <div className="text-[10px] font-mono tabular-nums text-[#F59E0B]">
                        -{formatInr(txn.totalDiscount)} disc
                      </div>
                    )}
                    {isActive && (
                      <div className="text-[10px] font-mono tabular-nums text-[#34D399]">
                        +{formatInr(txn.realizedGrossProfit)} profit
                      </div>
                    )}
                  </div>
                </div>

                {txn.isBasket && (
                  <div className="rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 space-y-1 text-xs">
                    {txn.items.map((l) => (
                      <div
                        key={l.lineId}
                        className="flex items-center justify-between text-[#DDD7EE]"
                      >
                        <span className="truncate">
                          {l.quantity}× {l.productNameSnapshot}
                          {l.perUnitDiscount > 0 ? ` (-₹${l.perUnitDiscount}/pc)` : ''}
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatInr(l.actualTotalRevenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {txn.stockConflict && !txn.stockConflictResolved && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#FB7185]/15 px-3 py-2 text-xs text-[#FDA4AF]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{txn.stockConflictNote || 'Concurrent stock conflict detected.'}</span>
                  </div>
                )}

                {isActive && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#221E33]">
                    <button
                      type="button"
                      onClick={() => openCorrection(txn)}
                      className="min-h-[36px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#C4B5FD] inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Correct</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onReverseTransaction(txn.id, 'Reversed from Sales History')
                      }
                      className="min-h-[36px] px-3 rounded-xl bg-[#1A1726] border border-[#FB7185]/35 text-xs font-semibold text-[#FDA4AF] inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reverse / Return</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Correction Sheet */}
      {editingTxn && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Correct sale transaction"
          onClick={() => setEditingTxn(null)}
        >
          <form
            onSubmit={handleSaveCorrection}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#13111C] border border-[#322C47] p-5 pb-safe max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-[#F5F3FA]">
                  Correct Sale Entry
                </h3>
                <p className="text-xs text-[#9D95B8]">
                  Supersedes original record and preserves full audit trail
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTxn(null)}
                aria-label="Cancel correction"
                className="w-9 h-9 rounded-xl bg-[#1A1726] flex items-center justify-center text-[#A29BB8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {editingTxn.items.map((line, idx) => (
                <div
                  key={line.lineId}
                  className="rounded-2xl bg-[#0E0C15] border border-[#252136] p-3 space-y-2"
                >
                  <div className="text-xs font-bold text-[#F5F3FA]">
                    {line.productNameSnapshot}{' '}
                    <span className="text-[#9D95B8] font-mono">
                      ({formatInr(line.originalUnitPrice)})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-[#9D95B8]">Quantity</span>
                      <input
                        type="number"
                        min={1}
                        value={editQtys[idx] ?? line.quantity}
                        onChange={(e) => {
                          const next = [...editQtys];
                          next[idx] = Math.max(1, Math.floor(Number(e.target.value) || 1));
                          setEditQtys(next);
                        }}
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#13111C] border border-[#2D2744] font-mono tabular-nums text-xs text-[#F5F3FA]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-[#9D95B8]">Discount / pc (₹)</span>
                      <input
                        type="number"
                        min={0}
                        value={editDiscounts[idx] ?? line.perUnitDiscount}
                        onChange={(e) => {
                          const next = [...editDiscounts];
                          next[idx] = Math.max(0, Number(e.target.value) || 0);
                          setEditDiscounts(next);
                        }}
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#13111C] border border-[#2D2744] font-mono tabular-nums text-xs text-[#F5F3FA]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-[#A29BB8]">Payment Method</span>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_OPTIONS.map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setEditPayment(pm)}
                    className={`min-h-[34px] px-3 rounded-xl text-xs font-medium border ${
                      editPayment === pm
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                        : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[pm]}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Reason for correction (optional)"
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#252136] text-xs text-[#F5F3FA]"
            />

            {editError && <p className="text-xs text-[#FB7185]">{editError}</p>}

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Correction</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
