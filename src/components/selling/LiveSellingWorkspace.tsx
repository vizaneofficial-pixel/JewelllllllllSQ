import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  FileSpreadsheet,
  Layers,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  WifiOff,
  Zap,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type { LiveInventoryItem, PaymentMethod } from '../../types/stall';
import {
  PAYMENT_METHOD_LABELS,
  formatInr,
  fromPaise,
  toPaise,
} from '../../utils/liveSellingEngine';
import { DailyReportView } from './DailyReportView';
import { LiveAnalyticsView } from './LiveAnalyticsView';
import { QuickBasketSheet } from './QuickBasketSheet';
import { QuickSaleAdjustSheet } from './QuickSaleAdjustSheet';
import { SalesHistoryView } from './SalesHistoryView';

type SellingSubView = 'counter' | 'history' | 'analytics' | 'report';
type CounterSortMode = 'smart' | 'top_sold' | 'az';

const PAYMENT_CYCLE: PaymentMethod[] = ['unrecorded', 'upi', 'cash', 'card', 'other'];

interface LiveSellingWorkspaceProps {
  workspace: StallWorkspaceController;
  onOpenStockManager: () => void;
}

export function LiveSellingWorkspace({
  workspace,
  onOpenStockManager,
}: LiveSellingWorkspaceProps) {
  const {
    liveSelling,
    currentProjectName,
    stallTotals,
  } = workspace;

  const {
    inventoryCatalog,
    transactions,
    sessions,
    activeSession,
    defaultPaymentMethod,
    basket,
    undoBanner,
    dismissUndoBanner,
    isOnline,
    isSyncing,
    syncSummary,
    wakeLockActive,
    currentSessionReport,
    selectedReportSessionId,
    setSelectedReportSessionId,
    selectedSessionReport,
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
    syncNow,
  } = liveSelling;

  const [subView, setSubView] = useState<SellingSubView>('counter');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortMode, setSortMode] = useState<CounterSortMode>('smart');
  const [adjustItem, setAdjustItem] = useState<LiveInventoryItem | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  const categoryNames = useMemo(() => {
    const names = Array.from(new Set(inventoryCatalog.map((i) => i.categoryName)));
    return names;
  }, [inventoryCatalog]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = inventoryCatalog.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${item.productName} ${item.categoryName} ${item.shortName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'az') {
        return a.productName.localeCompare(b.productName);
      }
      if (sortMode === 'top_sold') {
        return b.soldQty - a.soldQty || b.saleFrequency - a.saleFrequency;
      }
      // Smart: Pinned first -> Recently/frequently sold -> Available items -> Sold-out last
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.isSoldOut !== b.isSoldOut) return a.isSoldOut ? 1 : -1;
      const aRecency = a.lastSoldAtMs ?? 0;
      const bRecency = b.lastSoldAtMs ?? 0;
      if (b.saleFrequency !== a.saleFrequency) return b.saleFrequency - a.saleFrequency;
      if (bRecency !== aRecency) return bRecency - aRecency;
      return a.productName.localeCompare(b.productName);
    });
  }, [inventoryCatalog, selectedCategory, searchQuery, sortMode]);

  const pinnedItems = useMemo(
    () => inventoryCatalog.filter((i) => i.isPinned),
    [inventoryCatalog]
  );

  const basketSummary = useMemo(() => {
    let units = 0;
    let totalP = 0;
    for (const b of basket) {
      const unitP = Math.max(
        100,
        toPaise(b.originalUnitPrice) - toPaise(b.perUnitDiscount)
      );
      units += b.quantity;
      totalP += unitP * b.quantity;
    }
    return { units, total: fromPaise(totalP) };
  }, [basket]);

  const handleOneTapSell = (item: LiveInventoryItem) => {
    setSellError(null);
    if (item.sellingPrice <= 0) {
      setSellError(`Set a selling price for "${item.productName}" before selling.`);
      return;
    }
    if (item.isSoldOut) {
      setAdjustItem(item);
      return;
    }
    const res = recordQuickSale(item, {
      quantity: 1,
      perUnitDiscount: 0,
      paymentMethod: defaultPaymentMethod,
    });
    if (!res.ok && res.error) {
      setSellError(res.error);
    }
  };

  const cyclePaymentDefault = () => {
    const idx = PAYMENT_CYCLE.indexOf(defaultPaymentMethod);
    const next = PAYMENT_CYCLE[(idx + 1) % PAYMENT_CYCLE.length];
    setDefaultPaymentMethod(next);
  };

  const cycleSort = () => {
    setSortMode((prev) =>
      prev === 'smart' ? 'top_sold' : prev === 'top_sold' ? 'az' : 'smart'
    );
  };

  const hasFloatingOverlay = basket.length > 0 || Boolean(undoBanner);

  return (
    <div
      className={`space-y-3.5 step-fade-in ${
        hasFloatingOverlay ? 'pb-36 lg:pb-24' : 'pb-6'
      }`}
    >
      {/* Compact Live Counter Header Bar */}
      <section className="rounded-3xl bg-gradient-to-br from-[#191529] via-[#14111F] to-[#110F1A] border border-[#2D2744] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#C4B5FD] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-sm sm:text-base font-bold text-[#F5F3FA] truncate">
                  Live Selling
                </h1>
                <span className="px-2 py-0.5 rounded-lg bg-[#1E1A2E] text-[10px] font-semibold text-[#C4B5FD] whitespace-nowrap">
                  {activeSession.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9D95B8] font-mono tabular-nums mt-0.5">
                <span className="text-[#F5F3FA] font-semibold">
                  {formatInr(currentSessionReport.actualRevenue)}
                </span>
                <span>·</span>
                <span>{currentSessionReport.totalUnitsSold} sold</span>
                <span>·</span>
                <span className="text-[#34D399]">
                  +{formatInr(currentSessionReport.realizedGrossProfit)} gross
                </span>
              </div>
            </div>
          </div>

          {/* Right Status: Sync State + Default Payment Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={cyclePaymentDefault}
              title="Tap to change session default payment method"
              className="min-h-[34px] px-2.5 rounded-xl bg-[#1A1726] border border-[#2D2744] text-[11px] font-semibold text-[#DDD7EE] inline-flex items-center gap-1"
            >
              <span className="text-[#8C84A6]">Pay:</span>
              <span className="text-[#C4B5FD]">
                {PAYMENT_METHOD_LABELS[defaultPaymentMethod]}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={!isOnline || isSyncing}
              data-testid="live-sync-badge"
              className={`min-h-[34px] px-2.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                !isOnline
                  ? 'bg-[#F59E0B]/15 border-[#F59E0B]/35 text-[#FCD34D]'
                  : syncSummary.status === 'failed'
                  ? 'bg-[#FB7185]/15 border-[#FB7185]/35 text-[#FDA4AF]'
                  : syncSummary.status === 'synced'
                  ? 'bg-[#34D399]/12 border-[#34D399]/30 text-[#6EE7B7]'
                  : 'bg-[#1A1726] border-[#2D2744] text-[#C4B5FD]'
              }`}
            >
              {!isOnline ? (
                <WifiOff className="w-3 h-3" />
              ) : syncSummary.status === 'syncing' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : syncSummary.status === 'synced' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : syncSummary.status === 'failed' ? (
                <RefreshCw className="w-3 h-3" />
              ) : syncSummary.status === 'local_only' ? (
                <CloudOff className="w-3 h-3" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
              <span>{!isOnline ? 'Offline · Saved locally' : syncSummary.label}</span>
            </button>

            {wakeLockActive && (
              <span
                title="Screen stays awake during Live Selling"
                className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg bg-[#1A1726] text-[10px] text-[#8C84A6]"
              >
                Screen Awake
              </span>
            )}
          </div>
        </div>

        {/* Sub-view Tabs (Sell / History / Analytics / Report) */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#0E0C15] border border-[#221E33]">
          {(
            [
              ['counter', 'Sell', Zap],
              ['history', 'History', Clock],
              ['analytics', 'Analytics', BarChart2],
              ['report', 'Report', FileSpreadsheet],
            ] as Array<[SellingSubView, string, React.ComponentType<{ className?: string }>]>
          ).map(([id, label, Icon]) => {
            const active = subView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSubView(id)}
                className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.65)]'
                    : 'text-[#9D95B8] hover:text-[#F5F3FA]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Multi-device / Concurrent Stock Conflict Resolver */}
      {conflictTransactions.length > 0 && (
        <section className="rounded-2xl bg-[#23141C] border border-[#FB7185]/45 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FDA4AF]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Stock Sync Conflict Detected ({conflictTransactions.length})
            </span>
          </div>
          {conflictTransactions.slice(0, 3).map((ct) => (
            <div
              key={ct.id}
              className="rounded-xl bg-[#130D12] border border-[#FB7185]/25 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="text-[#DDD7EE]">
                {ct.stockConflictNote || ct.primaryProductName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => resolveStockConflict(ct.id, 'acknowledge')}
                  className="px-2.5 py-1 rounded-lg bg-[#1E1A2E] text-[#C4B5FD] font-semibold"
                >
                  Keep Sale
                </button>
                <button
                  type="button"
                  onClick={() => resolveStockConflict(ct.id, 'reverse')}
                  className="px-2.5 py-1 rounded-lg bg-[#FB7185]/20 text-[#FDA4AF] font-semibold"
                >
                  Reverse
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {sellError && (
        <div className="rounded-2xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#FDA4AF]">
          <span>{sellError}</span>
          <button
            type="button"
            onClick={() => setSellError(null)}
            className="text-[#F5F3FA] font-semibold"
          >
            OK
          </button>
        </div>
      )}

      {/* ==================== COUNTER / SELL VIEW ==================== */}
      {subView === 'counter' && (
        <div className="space-y-3">
          {inventoryCatalog.length === 0 ? (
            <div className="rounded-3xl bg-[#13111C] border border-dashed border-[#322C47] p-7 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/18 border border-[#8B5CF6]/35 text-[#C4B5FD] flex items-center justify-center mx-auto">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Add products to start Live Selling
                </h2>
                <p className="text-xs text-[#A29BB8] mt-1 max-w-sm mx-auto">
                  Live Selling pulls products, prices, costs, and stock quantities directly from this project&apos;s inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenStockManager}
                className="min-h-[44px] px-5 rounded-2xl bg-[#8B5CF6] text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Products in Stock</span>
              </button>
            </div>
          ) : (
            <>
              {/* Sticky Search + Sort + Category Filter Strip */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#8C84A6] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Quick find product..."
                      aria-label="Search products to sell"
                      className="w-full min-h-[44px] pl-9 pr-3 rounded-2xl bg-[#13111C] border border-[#252136] text-sm text-[#F5F3FA] placeholder-[#78718E]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={cycleSort}
                    className="min-h-[44px] px-3 rounded-2xl bg-[#13111C] border border-[#252136] text-xs font-semibold text-[#C4B5FD] whitespace-nowrap"
                  >
                    Sort:{' '}
                    {sortMode === 'smart'
                      ? 'Smart'
                      : sortMode === 'top_sold'
                      ? 'Top'
                      : 'A–Z'}
                  </button>
                </div>

                {categoryNames.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`shrink-0 min-h-[34px] px-3 rounded-xl text-xs font-semibold border ${
                        selectedCategory === 'all'
                          ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                          : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
                      }`}
                    >
                      All ({inventoryCatalog.length})
                    </button>
                    {categoryNames.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`shrink-0 min-h-[34px] px-3 rounded-xl text-xs font-semibold border ${
                          selectedCategory === cat
                            ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                            : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pinned Fast-Access Strip */}
              {pinnedItems.length > 0 && !searchQuery && selectedCategory === 'all' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A78BFA] px-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Pinned Quick-Tap</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {pinnedItems.map((item) => (
                      <button
                        key={`pin_${item.key}`}
                        type="button"
                        disabled={item.isSoldOut || item.sellingPrice <= 0}
                        onClick={() => handleOneTapSell(item)}
                        className="shrink-0 min-w-[140px] px-3.5 py-2.5 rounded-2xl bg-[#1A152E] border border-[#8B5CF6]/45 text-left active:scale-95 transition-transform disabled:opacity-45"
                      >
                        <div className="text-xs font-bold text-[#F5F3FA] truncate">
                          {item.shortName || item.productName}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="font-mono tabular-nums text-sm font-bold text-[#C4B5FD]">
                            {formatInr(item.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-[#9D95B8]">
                            {item.isSoldOut
                              ? 'Sold out'
                              : item.availableQty !== null
                              ? `${item.availableQty} left`
                              : '1 tap'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Phone-First Product Selling Grid */}
              <div
                data-testid="live-selling-product-grid"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
              >
                {filteredProducts.map((item) => {
                  const isLow =
                    item.isStockTracked &&
                    item.availableQty !== null &&
                    item.availableQty > 0 &&
                    item.availableQty <= 2;

                  return (
                    <div
                      key={item.key}
                      data-testid={`sell-card-${item.productId}`}
                      className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
                        item.isSoldOut
                          ? 'bg-[#110F18] border-[#252136] opacity-75'
                          : 'bg-[#13111C] border-[#28233C] hover:border-[#8B5CF6]/55'
                      }`}
                    >
                      {/* Primary 1-Tap Full-Price Selling Area */}
                      <button
                        type="button"
                        onClick={() => handleOneTapSell(item)}
                        aria-label={`Sell 1 ${item.productName} at ${formatInr(item.sellingPrice)}`}
                        className="w-full p-3.5 pb-2.5 text-left flex-1 flex flex-col justify-between gap-2.5 active:bg-[#8B5CF6]/15 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9D95B8] truncate">
                              {item.categoryName}
                            </span>
                            {item.soldQty > 0 && (
                              <span className="text-[10px] font-mono tabular-nums text-[#34D399] font-semibold shrink-0">
                                {item.soldQty} sold
                              </span>
                            )}
                          </div>
                          <div className="font-display text-sm font-bold text-[#F5F3FA] leading-snug line-clamp-2">
                            {item.productName}
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-1.5 pt-1">
                          <div>
                            <div className="font-mono tabular-nums text-lg font-extrabold text-[#F5F3FA] leading-none">
                              {item.sellingPrice > 0
                                ? formatInr(item.sellingPrice)
                                : 'Set price'}
                            </div>
                            <div className="mt-1.5">
                              {item.isSoldOut ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FB7185]/18 text-[#FDA4AF]">
                                  Sold out
                                </span>
                              ) : item.isStockTracked && item.availableQty !== null ? (
                                <span
                                  className={`inline-block text-[10px] font-semibold font-mono tabular-nums px-2 py-0.5 rounded-md ${
                                    isLow
                                      ? 'bg-[#F59E0B]/18 text-[#FCD34D]'
                                      : 'bg-[#1E1A2E] text-[#C4B5FD]'
                                  }`}
                                >
                                  {item.availableQty} left
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#1A1726] text-[#9D95B8]">
                                  Open stock
                                </span>
                              )}
                            </div>
                          </div>

                          {!item.isSoldOut && item.sellingPrice > 0 && (
                            <span className="text-[10px] font-semibold text-[#A78BFA] whitespace-nowrap">
                              Tap to sell
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Secondary Bargain / Qty / Pin Strip */}
                      <div className="border-t border-[#201C30] bg-[#0F0D16] px-2 py-1.5 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => setAdjustItem(item)}
                          aria-label={`Discount or quantity for ${item.productName}`}
                          className="flex-1 min-h-[34px] px-2 rounded-lg text-[11px] font-semibold text-[#C4B5FD] hover:bg-[#1E1A2E] inline-flex items-center justify-center gap-1"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>{item.isSoldOut ? 'Restock' : '-₹ / Qty'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinProduct(item.key)}
                          aria-label={
                            item.isPinned
                              ? `Unpin ${item.productName}`
                              : `Pin ${item.productName}`
                          }
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            item.isPinned
                              ? 'text-[#FCD34D] bg-[#F59E0B]/15'
                              : 'text-[#78718E] hover:text-[#DDD7EE]'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== HISTORY VIEW ==================== */}
      {subView === 'history' && (
        <SalesHistoryView
          transactions={transactions}
          sessions={sessions}
          activeSessionId={activeSession.id}
          onReverseTransaction={reverseTransaction}
          onCorrectTransaction={correctTransaction}
        />
      )}

      {/* ==================== ANALYTICS VIEW ==================== */}
      {subView === 'analytics' && (
        <LiveAnalyticsView report={currentSessionReport} />
      )}

      {/* ==================== DAILY REPORT VIEW ==================== */}
      {subView === 'report' && (
        <DailyReportView
          projectName={currentProjectName}
          eventTotalExpenses={stallTotals.totalEventCosts}
          sessions={sessions}
          activeSessionId={activeSession.id}
          selectedSessionId={selectedReportSessionId}
          onSelectSessionId={setSelectedReportSessionId}
          report={selectedSessionReport}
          onCloseCurrentDay={closeCurrentDay}
        />
      )}

      {/* Floating Basket Bar (Only shown when items added to Quick Basket) */}
      {basket.length > 0 && (
        <div className="fixed bottom-[80px] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-8 z-30 max-w-md mx-auto lg:mx-0">
          <button
            type="button"
            onClick={() => setBasketOpen(true)}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_14px_34px_-6px_rgba(139,92,246,0.75)] flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-bold">
                Quick Basket ({basketSummary.units}{' '}
                {basketSummary.units === 1 ? 'pc' : 'pcs'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums text-sm font-extrabold">
              <span>{formatInr(basketSummary.total)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Instant Floating Undo Sale Banner ("Sale recorded · Undo") */}
      {undoBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="live-sale-undo-banner"
          className={`fixed ${
            basket.length > 0
              ? 'bottom-[140px] lg:bottom-24'
              : 'bottom-[80px] lg:bottom-6'
          } left-4 right-4 lg:left-auto lg:right-8 z-40 max-w-md mx-auto lg:mx-0 rounded-2xl bg-[#11241E] border border-[#34D399]/50 px-4 py-3 shadow-2xl flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-bold text-[#F5F3FA]">Sale recorded</span>
              <span className="text-[#A7F3D0] ml-1.5 truncate">
                {undoBanner.title} · {formatInr(undoBanner.revenue)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => reverseTransaction(undoBanner.transactionId, 'Instant undo')}
              className="min-h-[34px] px-3 rounded-xl bg-[#34D399] text-[#071A13] text-xs font-extrabold inline-flex items-center gap-1 active:scale-95"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={dismissUndoBanner}
              className="text-[11px] font-semibold text-[#A7F3D0] px-1"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Modals / Bottom Sheets */}
      <QuickSaleAdjustSheet
        item={
          adjustItem
            ? inventoryCatalog.find((i) => i.key === adjustItem.key) || adjustItem
            : null
        }
        defaultPaymentMethod={defaultPaymentMethod}
        onClose={() => setAdjustItem(null)}
        onCompleteSale={(item, opts) => recordQuickSale(item, opts)}
        onAddToBasket={(item, qty, disc) => addToBasket(item, qty, disc)}
        onSetAvailableStock={setAvailableStockOverride}
      />

      <QuickBasketSheet
        isOpen={basketOpen}
        onClose={() => setBasketOpen(false)}
        entries={basket}
        defaultPaymentMethod={defaultPaymentMethod}
        onUpdateEntry={updateBasketEntry}
        onRemoveEntry={removeFromBasket}
        onClearBasket={clearBasket}
        onCompleteBasket={completeBasketSale}
      />
    </div>
  );
}
