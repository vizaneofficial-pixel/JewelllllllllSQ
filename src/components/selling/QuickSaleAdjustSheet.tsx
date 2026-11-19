import React, { useEffect, useState } from 'react';
import {
  Check,
  Minus,
  PackagePlus,
  Plus,
  ShoppingBag,
  Tag,
  X,
} from 'lucide-react';
import type { LiveInventoryItem, PaymentMethod } from '../../types/stall';
import {
  PAYMENT_METHOD_LABELS,
  QUICK_DISCOUNT_PRESETS,
  checkStockAvailability,
  formatInr,
  fromPaise,
  toPaise,
  validateDiscount,
} from '../../utils/liveSellingEngine';

interface QuickSaleAdjustSheetProps {
  item: LiveInventoryItem | null;
  defaultPaymentMethod: PaymentMethod;
  onClose: () => void;
  onCompleteSale: (
    item: LiveInventoryItem,
    opts: { quantity: number; perUnitDiscount: number; paymentMethod: PaymentMethod; note?: string }
  ) => { ok: boolean; error?: string };
  onAddToBasket: (
    item: LiveInventoryItem,
    quantity: number,
    perUnitDiscount: number
  ) => { ok: boolean; error?: string };
  onSetAvailableStock: (item: LiveInventoryItem, nextAvailable: number | null) => void;
}

const PAYMENT_OPTIONS: PaymentMethod[] = ['unrecorded', 'upi', 'cash', 'card', 'other'];

export function QuickSaleAdjustSheet({
  item,
  defaultPaymentMethod,
  onClose,
  onCompleteSale,
  onAddToBasket,
  onSetAvailableStock,
}: QuickSaleAdjustSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(0);
  const [customDiscountStr, setCustomDiscountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockValue, setRestockValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setQuantity(1);
    setSelectedPreset(0);
    setCustomDiscountStr('');
    setPaymentMethod(defaultPaymentMethod);
    setRestockOpen(item.isSoldOut || item.sellingPrice <= 0);
    setRestockValue(item.availableQty !== null ? String(item.availableQty) : '');
    setErrorMsg(null);
  }, [item?.key]);

  if (!item) return null;

  const rawDiscount =
    selectedPreset === 'custom'
      ? Math.max(0, Number(customDiscountStr) || 0)
      : selectedPreset;

  const discountValidation = validateDiscount(item.sellingPrice, rawDiscount);
  const stockCheck = checkStockAvailability(item, quantity, 0);

  const origTotal = fromPaise(toPaise(item.sellingPrice) * quantity);
  const totalDiscount = fromPaise(
    toPaise(discountValidation.valid ? discountValidation.perUnitDiscount : 0) * quantity
  );
  const finalTotal = fromPaise(
    Math.max(0, toPaise(origTotal) - toPaise(totalDiscount))
  );
  const totalCogs = fromPaise(toPaise(item.purchaseCost) * quantity);
  const estGrossProfit = fromPaise(toPaise(finalTotal) - toPaise(totalCogs));

  const maxStepper =
    item.isStockTracked && item.availableQty !== null
      ? Math.max(1, item.availableQty)
      : 999;

  const handleSellNow = () => {
    if (!stockCheck.allowed) {
      setErrorMsg(stockCheck.error || 'Insufficient stock');
      return;
    }
    if (!discountValidation.valid) {
      setErrorMsg(discountValidation.error || 'Invalid discount');
      return;
    }
    const res = onCompleteSale(item, {
      quantity,
      perUnitDiscount: discountValidation.perUnitDiscount,
      paymentMethod,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Unable to record sale');
      return;
    }
    onClose();
  };

  const handleBasketAdd = () => {
    if (!stockCheck.allowed) {
      setErrorMsg(stockCheck.error || 'Insufficient stock');
      return;
    }
    if (!discountValidation.valid) {
      setErrorMsg(discountValidation.error || 'Invalid discount');
      return;
    }
    const res = onAddToBasket(
      item,
      quantity,
      discountValidation.perUnitDiscount
    );
    if (!res.ok) {
      setErrorMsg(res.error || 'Unable to add to basket');
      return;
    }
    onClose();
  };

  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockValue.trim() === '') {
      onSetAvailableStock(item, null);
    } else {
      const clean = Math.max(0, Math.floor(Number(restockValue) || 0));
      onSetAvailableStock(item, clean);
    }
    setRestockOpen(false);
    setErrorMsg(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Sell ${item.productName}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#13111C] border border-[#322C47] p-5 pb-safe max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A78BFA]">
              {item.categoryName}
            </span>
            <h3 className="font-display text-lg font-bold text-[#F5F3FA] truncate">
              {item.productName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#A29BB8]">
              <span className="font-mono tabular-nums text-[#F5F3FA] font-semibold">
                {formatInr(item.sellingPrice)} / pc
              </span>
              <span>·</span>
              <span>
                {item.isStockTracked && item.availableQty !== null
                  ? item.availableQty === 0
                    ? 'Sold out (0 left)'
                    : `${item.availableQty} remaining`
                  : 'Open stock (untracked)'}
              </span>
              <button
                type="button"
                onClick={() => setRestockOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-[#C4B5FD] underline font-medium ml-1"
              >
                <PackagePlus className="w-3 h-3" />
                <span>{item.isSoldOut ? 'Restock' : 'Adjust stock'}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sale sheet"
            className="w-10 h-10 rounded-xl bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#A29BB8] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Stock Adjuster */}
        {restockOpen && (
          <form
            onSubmit={handleSaveRestock}
            className="rounded-2xl bg-[#0E0C15] border border-[#2D2744] p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#DDD7EE]">
                Available Units Right Now
              </span>
              <span className="text-[11px] text-[#8C84A6]">
                Sold so far: {item.soldQty}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={restockValue}
                onChange={(e) => setRestockValue(e.target.value)}
                placeholder="Empty = untracked"
                aria-label="Set remaining available stock"
                className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#13111C] border border-[#2D2744] font-mono tabular-nums text-sm text-[#F5F3FA]"
              />
              <button
                type="submit"
                className="min-h-[42px] px-3.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Update
              </button>
              {item.isStockTracked && (
                <button
                  type="button"
                  onClick={() => {
                    onSetAvailableStock(item, null);
                    setRestockOpen(false);
                  }}
                  className="min-h-[42px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs text-[#A29BB8]"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        )}

        {/* Quantity Selector */}
        <div className="rounded-2xl bg-[#0E0C15] border border-[#252136] p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#F5F3FA]">Quantity</div>
            <div className="text-[11px] text-[#8C84A6]">
              Discount applies per unit
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setQuantity((q) => Math.max(1, q - 1));
                setErrorMsg(null);
              }}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="w-12 h-12 rounded-xl bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#F5F3FA] disabled:opacity-35 active:scale-95"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={1}
              max={maxStepper}
              value={quantity}
              onChange={(e) => {
                const v = Math.max(1, Math.min(maxStepper, Math.floor(Number(e.target.value) || 1)));
                setQuantity(v);
                setErrorMsg(null);
              }}
              aria-label="Sale quantity"
              className="w-16 h-12 rounded-xl bg-[#161322] border border-[#322C47] text-center font-mono tabular-nums text-base font-bold text-[#F5F3FA]"
            />
            <button
              type="button"
              onClick={() => {
                setQuantity((q) => Math.min(maxStepper, q + 1));
                setErrorMsg(null);
              }}
              disabled={quantity >= maxStepper}
              aria-label="Increase quantity"
              className="w-12 h-12 rounded-xl bg-[#1A1726] border border-[#2D2744] flex items-center justify-center text-[#F5F3FA] disabled:opacity-35 active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fast Bargaining Discounts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F3FA] inline-flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#A78BFA]" />
              Quick Bargain Discount (per pc)
            </span>
            <span className="font-mono tabular-nums text-[#C4B5FD]">
              {discountValidation.valid
                ? `${formatInr(discountValidation.actualUnitPrice)} / pc`
                : 'Invalid'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_DISCOUNT_PRESETS.map((preset) => {
              const check = validateDiscount(item.sellingPrice, preset);
              const active = selectedPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={!check.valid}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setErrorMsg(null);
                  }}
                  className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 disabled:opacity-30 ${
                    active
                      ? 'bg-[#8B5CF6] border-[#A78BFA] text-white'
                      : 'bg-[#161322] border-[#252136] text-[#DDD7EE] hover:border-[#3A3352]'
                  }`}
                >
                  {preset === 0 ? 'Full Price' : `-₹${preset}`}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedPreset('custom');
                setErrorMsg(null);
              }}
              className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                selectedPreset === 'custom'
                  ? 'bg-[#8B5CF6] border-[#A78BFA] text-white'
                  : 'bg-[#161322] border-[#252136] text-[#C4B5FD]'
              }`}
            >
              Custom ₹
            </button>
          </div>

          {selectedPreset === 'custom' && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[#A29BB8] whitespace-nowrap">
                Discount / pc (₹):
              </span>
              <input
                type="number"
                min={0}
                step={5}
                value={customDiscountStr}
                onChange={(e) => {
                  setCustomDiscountStr(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="e.g. 75"
                aria-label="Custom discount per unit in rupees"
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#0E0C15] border border-[#322C47] font-mono tabular-nums text-sm text-[#F5F3FA]"
                autoFocus
              />
            </div>
          )}

          {!discountValidation.valid && (
            <p className="text-xs text-[#FB7185]">{discountValidation.error}</p>
          )}
        </div>

        {/* Payment Method Tag */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#A29BB8]">Payment Method</span>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_OPTIONS.map((pm) => {
              const active = paymentMethod === pm;
              return (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMethod(pm)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                      : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[pm]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Financial Live Calculation Strip */}
        <div className="rounded-2xl bg-[#0E0C15] border border-[#2D2744] p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[#A29BB8]">
            <span>
              Original ({quantity} × {formatInr(item.sellingPrice)})
            </span>
            <span className="font-mono tabular-nums">{formatInr(origTotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex items-center justify-between text-[#F59E0B]">
              <span>Bargain Discount</span>
              <span className="font-mono tabular-nums">-{formatInr(totalDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#221E33]">
            <span className="font-bold text-[#F5F3FA]">Final Sale Total</span>
            <span className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA]">
              {formatInr(finalTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8C84A6]">Realized Gross Profit</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                estGrossProfit >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
              }`}
            >
              {estGrossProfit >= 0 ? '+' : ''}
              {formatInr(estGrossProfit)}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3 py-2 text-xs text-[#FDA4AF]">
            {errorMsg}
          </div>
        )}

        {/* Primary & Secondary Actions */}
        <div className="grid grid-cols-5 gap-2 pt-1">
          <button
            type="button"
            disabled={!stockCheck.allowed || !discountValidation.valid}
            onClick={handleBasketAdd}
            className="col-span-2 min-h-[50px] px-3 rounded-2xl bg-[#1A1726] border border-[#322C47] text-xs font-semibold text-[#DDD7EE] inline-flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98]"
          >
            <ShoppingBag className="w-4 h-4 text-[#A78BFA]" />
            <span>+ Basket</span>
          </button>
          <button
            type="button"
            disabled={!stockCheck.allowed || !discountValidation.valid}
            onClick={handleSellNow}
            className="col-span-3 min-h-[50px] px-4 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-[0_10px_28px_-8px_rgba(139,92,246,0.65)] disabled:opacity-40 active:scale-[0.98]"
          >
            <Check className="w-4 h-4" />
            <span>Sell · {formatInr(finalTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
