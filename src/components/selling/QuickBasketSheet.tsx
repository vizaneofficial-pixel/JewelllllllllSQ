import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus, Trash2, X } from 'lucide-react';
import type { LiveBasketEntry, PaymentMethod } from '../../types/stall';
import {
  PAYMENT_METHOD_LABELS,
  formatInr,
  fromPaise,
  toPaise,
} from '../../utils/liveSellingEngine';

interface QuickBasketSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LiveBasketEntry[];
  defaultPaymentMethod: PaymentMethod;
  onUpdateEntry: (
    key: string,
    patch: { quantity?: number; perUnitDiscount?: number }
  ) => { ok: boolean; error?: string };
  onRemoveEntry: (key: string) => void;
  onClearBasket: () => void;
  onCompleteBasket: (
    paymentMethod: PaymentMethod,
    note?: string
  ) => { ok: boolean; error?: string };
}

const PAYMENT_OPTIONS: PaymentMethod[] = ['unrecorded', 'upi', 'cash', 'card', 'other'];

export function QuickBasketSheet({
  isOpen,
  onClose,
  entries,
  defaultPaymentMethod,
  onUpdateEntry,
  onRemoveEntry,
  onClearBasket,
  onCompleteBasket,
}: QuickBasketSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(defaultPaymentMethod);
      setError(null);
    }
  }, [isOpen, defaultPaymentMethod]);

  if (!isOpen) return null;

  let origP = 0;
  let discP = 0;
  let actualP = 0;
  let cogsP = 0;
  let totalUnits = 0;

  for (const e of entries) {
    const unitActualP = Math.max(100, toPaise(e.originalUnitPrice) - toPaise(e.perUnitDiscount));
    origP += toPaise(e.originalUnitPrice) * e.quantity;
    discP += toPaise(e.perUnitDiscount) * e.quantity;
    actualP += unitActualP * e.quantity;
    cogsP += toPaise(e.purchaseCostPerUnit) * e.quantity;
    totalUnits += e.quantity;
  }

  const finalRev = fromPaise(actualP);
  const totalDisc = fromPaise(discP);
  const grossProfit = fromPaise(actualP - cogsP);

  const handleCheckout = () => {
    const res = onCompleteBasket(paymentMethod, note.trim() || undefined);
    if (!res.ok) {
      setError(res.error || 'Unable to complete basket sale');
      return;
    }
    setNote('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-product quick basket"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#13111C] border border-[#322C47] p-5 pb-safe max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[#F5F3FA]">
              Quick Basket ({totalUnits} {totalUnits === 1 ? 'pc' : 'pcs'})
            </h3>
            <p className="text-xs text-[#9D95B8]">
              Combine multiple items into one bill
            </p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearBasket();
                  onClose();
                }}
                className="min-h-[36px] px-2.5 rounded-xl bg-[#1A1726] text-xs font-medium text-[#FB7185]"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close basket"
              className="w-10 h-10 rounded-xl bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#A29BB8]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {entries.map((entry) => {
            const unitActual = fromPaise(
              Math.max(100, toPaise(entry.originalUnitPrice) - toPaise(entry.perUnitDiscount))
            );
            const lineTotal = fromPaise(toPaise(unitActual) * entry.quantity);
            const maxAllowed =
              entry.stockTracked && entry.availableQty !== null
                ? entry.availableQty
                : 999;

            return (
              <div
                key={entry.key}
                className="rounded-2xl bg-[#0E0C15] border border-[#252136] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F5F3FA] truncate">
                      {entry.productName}
                    </div>
                    <div className="text-[11px] text-[#A29BB8] font-mono tabular-nums">
                      {formatInr(unitActual)} / pc
                      {entry.perUnitDiscount > 0
                        ? ` (Orig ${formatInr(entry.originalUnitPrice)} − ${formatInr(entry.perUnitDiscount)})`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                      {formatInr(lineTotal)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.productName} from basket`}
                      onClick={() => onRemoveEntry(entry.key)}
                      className="w-8 h-8 rounded-lg text-[#9D95B8] hover:text-[#FB7185] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1C1829]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const res = onUpdateEntry(entry.key, {
                          quantity: entry.quantity - 1,
                        });
                        if (!res.ok) setError(res.error || null);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#F5F3FA]"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono tabular-nums text-xs font-bold">
                      {entry.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={entry.quantity >= maxAllowed}
                      onClick={() => {
                        const res = onUpdateEntry(entry.key, {
                          quantity: entry.quantity + 1,
                        });
                        if (!res.ok) setError(res.error || null);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#F5F3FA] disabled:opacity-35"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {[0, 20, 30, 50].map((d) => {
                      if (d >= entry.originalUnitPrice) return null;
                      const active = entry.perUnitDiscount === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            const res = onUpdateEntry(entry.key, {
                              perUnitDiscount: d,
                            });
                            if (!res.ok) setError(res.error || null);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                            active
                              ? 'bg-[#8B5CF6] text-white'
                              : 'bg-[#161322] text-[#A29BB8]'
                          }`}
                        >
                          {d === 0 ? 'Full' : `-₹${d}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-[#A29BB8]">Payment Method</span>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_OPTIONS.map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => setPaymentMethod(pm)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-medium border ${
                  paymentMethod === pm
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
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. Bundle customer)"
          className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#252136] text-xs text-[#F5F3FA]"
        />

        <div className="rounded-2xl bg-[#0E0C15] border border-[#2D2744] p-3.5 space-y-1 text-xs">
          <div className="flex justify-between text-[#A29BB8]">
            <span>Original Value</span>
            <span className="font-mono tabular-nums">{formatInr(fromPaise(origP))}</span>
          </div>
          {totalDisc > 0 && (
            <div className="flex justify-between text-[#F59E0B]">
              <span>Discounts</span>
              <span className="font-mono tabular-nums">-{formatInr(totalDisc)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-[#221E33]">
            <span className="font-bold text-[#F5F3FA]">Basket Total</span>
            <span className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA]">
              {formatInr(finalRev)}
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-[#34D399]">
            <span>Realized Gross Profit</span>
            <span className="font-mono tabular-nums font-semibold">
              {grossProfit >= 0 ? '+' : ''}
              {formatInr(grossProfit)}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3 py-2 text-xs text-[#FDA4AF]">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={entries.length === 0}
          onClick={handleCheckout}
          className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-[0_10px_28px_-8px_rgba(139,92,246,0.65)] disabled:opacity-40"
        >
          <Check className="w-4 h-4" />
          <span>Complete Basket Sale · {formatInr(finalRev)}</span>
        </button>
      </div>
    </div>
  );
}
