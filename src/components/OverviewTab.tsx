import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Receipt,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  ActualSaleRecord,
  CategoryGroupResolved,
  DiversifiedOverviewTotals,
  StallStockItem,
  StallStockRow,
  StallTotals,
} from '../types/stall';
import { buildSellThroughScenarios } from '../utils/optimizer';
import { beautyToFiveScale } from '../utils/orderAndProjectEngine';

const QUICK_EXPENSE_PRESETS = [
  { name: 'Transport & Travel', defaultCost: 1200 },
  { name: 'Packaging & Pouches', defaultCost: 800 },
  { name: 'Labour / Helper', defaultCost: 1500 },
  { name: 'Display & Lighting', defaultCost: 1000 },
  { name: 'Other Event Expense', defaultCost: 500 },
];

interface OverviewTabProps {
  preferredName?: string;
  projectName: string;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  expectedFootfall: number;
  stallFee: number;
  globalSellThrough: number;
  resolvedGroups: CategoryGroupResolved[];
  overviewTotals: DiversifiedOverviewTotals;
  stallTotals: StallTotals;
  eventCostRows: StallStockRow[];
  actualSales: ActualSaleRecord[];
  fullOrderCopied: boolean;
  highlightedSection?: string | null;
  onEventNameChange: (val: string) => void;
  onEventLocationChange: (val: string) => void;
  onEventDateChange: (val: string) => void;
  onExpectedFootfallChange: (val: number) => void;
  onStallFeeChange: (val: number) => void;
  onApplyGlobalSellThrough: (pct: number) => void;
  onAddEventCost: (name?: string, amount?: number) => void;
  onUpdateEventCost: (id: string, field: 'name' | 'cost', val: string) => void;
  onRemoveEventCost: (id: string) => void;
  onUpdateStockItem: (id: string, field: keyof StallStockItem, val: string) => void;
  onAddStockItem: () => void;
  onRemoveStockItem: (id: string) => void;
  onSelectGroupCombo: (groupId: string, comboId: string) => void;
  onEditCategoryGroup: (groupId: string) => void;
  onAddCategoryGroup: () => void;
  onCopyFullOrder: () => void;
  onRecordActualSale: (entry: {
    groupId: string;
    categoryName: string;
    productId: string;
    productName: string;
    qtySold: number;
    actualPricePerUnit: number;
    unitCost: number;
  }) => void;
  onRemoveActualSale: (saleId: string) => void;
  onOpenStockPlanner: () => void;
  onOpenStallSetup: () => void;
  onOpenResearch: () => void;
  aiAuditLoading: boolean;
  aiAuditReport: string | null;
  aiAuditError: string | null;
  onRunPlanReview: () => void;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const DONUT_PALETTE = ['#8B5CF6', '#34D399', '#F59E0B', '#38BDF8', '#FB7185', '#C084FC'];

export function OverviewTab({
  projectName,
  eventName,
  eventLocation,
  eventDate,
  expectedFootfall,
  stallFee,
  globalSellThrough,
  resolvedGroups,
  overviewTotals,
  stallTotals,
  eventCostRows,
  actualSales,
  fullOrderCopied,
  highlightedSection,
  onEventNameChange,
  onEventLocationChange,
  onEventDateChange,
  onExpectedFootfallChange,
  onStallFeeChange,
  onApplyGlobalSellThrough,
  onAddEventCost,
  onUpdateEventCost,
  onRemoveEventCost,
  onUpdateStockItem,
  onAddStockItem,
  onRemoveStockItem,
  onSelectGroupCombo,
  onEditCategoryGroup,
  onAddCategoryGroup,
  onCopyFullOrder,
  onRecordActualSale,
  onRemoveActualSale,
  onOpenStockPlanner,
  onOpenStallSetup,
  onOpenResearch,
  aiAuditLoading,
  aiAuditReport,
  aiAuditError,
  onRunPlanReview,
}: OverviewTabProps) {
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [showExpensesPanel, setShowExpensesPanel] = useState(false);
  const [showExtraStock, setShowExtraStock] = useState(false);
  const [showPlanBreakdown, setShowPlanBreakdown] = useState(false);
  const [showActualSales, setShowActualSales] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseCost, setNewExpenseCost] = useState('');

  // Actual sales form state
  const [saleProductKey, setSaleProductKey] = useState('');
  const [saleCustomName, setSaleCustomName] = useState('');
  const [saleQty, setSaleQty] = useState('1');
  const [salePrice, setSalePrice] = useState('');

  const scenarios = useMemo(
    () => buildSellThroughScenarios(stallTotals, [100, 90, 75, 50]),
    [stallTotals]
  );

  const extraStockRows = useMemo(
    () => stallTotals.itemRows.filter((row) => !row.isSyncedBundle),
    [stallTotals.itemRows]
  );

  const allProductOptions = useMemo(() => {
    const out: Array<{
      key: string;
      groupId: string;
      categoryName: string;
      productId: string;
      productName: string;
      unitCost: number;
      defaultPrice: number;
    }> = [];
    resolvedGroups.forEach(({ group }) => {
      group.categories.forEach((cat) => {
        out.push({
          key: `${group.id}::${cat.id}`,
          groupId: group.id,
          categoryName: group.name,
          productId: cat.id,
          productName: cat.name,
          unitCost: cat.cost,
          defaultPrice: cat.price,
        });
      });
    });
    return out;
  }, [resolvedGroups]);

  const totalProductsCount = useMemo(
    () =>
      resolvedGroups.reduce((sum, rg) => sum + rg.group.categories.length, 0) +
      extraStockRows.length,
    [resolvedGroups, extraStockRows.length]
  );

  const hasInventory = totalProductsCount > 0 && stallTotals.totalUnits > 0;
  const hasPricing = stallTotals.rev100 > 0;
  const hasEventCosts = stallFee > 0 || eventCostRows.length > 0;
  const hasBudget = overviewTotals.totalAllocatedBudget > 0;

  const budgetRemaining = hasBudget
    ? overviewTotals.totalAllocatedBudget - stallTotals.totalCost
    : 0;
  const budgetUsedPct = hasBudget
    ? Math.min(
        100,
        Math.round(
          (stallTotals.totalCost / Math.max(1, overviewTotals.totalAllocatedBudget)) *
            100
        )
      )
    : 0;

  // Actual sales totals (strictly separate from pre-event estimates)
  const actualTotals = useMemo(() => {
    const units = actualSales.reduce((s, r) => s + r.qtySold, 0);
    const revenue = actualSales.reduce(
      (s, r) => s + r.qtySold * r.actualPricePerUnit,
      0
    );
    const cogs = actualSales.reduce((s, r) => s + r.qtySold * r.unitCost, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - stallTotals.totalEventCosts;
    return { units, revenue, cogs, grossProfit, netProfit };
  }, [actualSales, stallTotals.totalEventCosts]);

  // Donut chart slices for category allocation
  const categorySlices = useMemo(() => {
    const total = Math.max(1, overviewTotals.totalInvestment);
    let cumulative = 0;
    return resolvedGroups.map((rg, idx) => {
      const spend = rg.activeCombo?.cost || 0;
      const pct = overviewTotals.totalInvestment > 0 ? Math.round((spend / total) * 100) : 0;
      const frac = overviewTotals.totalInvestment > 0 ? spend / total : 0;
      const start = cumulative;
      cumulative += frac;
      return {
        id: rg.group.id,
        name: rg.group.name,
        spend,
        pct,
        pieces: rg.activeCombo?.pieces || 0,
        color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
        start,
        frac,
      };
    });
  }, [resolvedGroups, overviewTotals.totalInvestment]);

  // Break-even vs Expected Sales visual ratio
  const breakEvenSalesNeeded = stallTotals.totalOutlay;
  const salesBarMax = Math.max(1, stallTotals.rev100, breakEvenSalesNeeded * 1.15);
  const expectedSalesPct = hasPricing
    ? Math.min(100, Math.round((stallTotals.revRealistic / salesBarMax) * 100))
    : 0;
  const breakEvenMarkerPct = hasPricing
    ? Math.min(98, Math.round((breakEvenSalesNeeded / salesBarMax) * 100))
    : 50;

  // Money flow step bars
  const flowScale = Math.max(1, stallTotals.revRealistic, stallTotals.totalCost, stallTotals.totalEventCosts);
  const moneyFlowSteps = [
    {
      label: 'Stock',
      value: stallTotals.totalCost,
      pct: Math.round((stallTotals.totalCost / flowScale) * 100),
      barClass: 'bg-[#8B5CF6]',
      textClass: 'text-[#F5F3FA]',
    },
    {
      label: 'Est. Sales',
      value: stallTotals.revRealistic,
      pct: Math.round((stallTotals.revRealistic / flowScale) * 100),
      barClass: 'bg-[#A78BFA]',
      textClass: 'text-[#C4B5FD]',
    },
    {
      label: 'Gross profit',
      value: stallTotals.grossProfitReal,
      pct: Math.round((Math.max(0, stallTotals.grossProfitReal) / flowScale) * 100),
      barClass: 'bg-[#34D399]/80',
      textClass: 'text-[#34D399]',
    },
    {
      label: 'Expenses',
      value: stallTotals.totalEventCosts,
      pct: Math.round((stallTotals.totalEventCosts / flowScale) * 100),
      barClass: 'bg-[#F59E0B]',
      textClass: 'text-[#FBBF24]',
    },
    {
      label: 'Final profit',
      value: stallTotals.netAfterStallReal,
      pct: Math.round(
        (Math.max(0, Math.abs(stallTotals.netAfterStallReal)) / flowScale) * 100
      ),
      barClass:
        stallTotals.netAfterStallReal >= 0 ? 'bg-[#34D399]' : 'bg-[#FB7185]',
      textClass:
        stallTotals.netAfterStallReal >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]',
    },
  ];

  // Supplier-safe wholesale buying list CSV (NO selling prices or expected profits)
  const handleExportSupplierCsv = () => {
    const rows: string[][] = [
      ['Category', 'Product', 'Qty', 'Purchase Cost (INR)', 'Line Total (INR)'],
    ];
    resolvedGroups.forEach(({ group, activeCombo }) => {
      if (!activeCombo) return;
      group.categories.forEach((cat, idx) => {
        const qty = activeCombo.counts[idx] || 0;
        if (qty <= 0) return;
        rows.push([
          group.name,
          cat.name,
          String(qty),
          String(cat.cost),
          String(qty * cat.cost),
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stalliq-supplier-order.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCustomExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newExpenseName.trim();
    const amount = Math.max(0, Number(newExpenseCost) || 0);
    if (!cleanName || amount <= 0) return;
    onAddEventCost(cleanName, amount);
    setNewExpenseName('');
    setNewExpenseCost('');
  };

  const handleSubmitActualSale = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Math.round(Number(saleQty) || 0));
    const selected = allProductOptions.find((p) => p.key === saleProductKey);
    const price = Math.max(
      0,
      Number(salePrice) || (selected ? selected.defaultPrice : 0)
    );
    const name = selected ? selected.productName : saleCustomName.trim();
    if (!name || price <= 0) return;
    onRecordActualSale({
      groupId: selected?.groupId || 'custom',
      categoryName: selected?.categoryName || 'General',
      productId: selected?.productId || `custom_${Date.now()}`,
      productName: name,
      qtySold: qty,
      actualPricePerUnit: price,
      unitCost: selected?.unitCost || 0,
    });
    setSaleQty('1');
    setSalePrice('');
    setSaleCustomName('');
  };

  const displayTitle = projectName.trim() || eventName.trim() || 'My Project';
  const showEventSubline =
    eventName.trim() &&
    eventName.trim().toLowerCase() !== displayTitle.toLowerCase();

  const isHighlighted =
    highlightedSection === 'overview_totals' ||
    highlightedSection === 'overview_costs' ||
    highlightedSection === 'cfo_summary';

  return (
    <div className="space-y-5">
      {/* 1. Concise Command Header Strip */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F5F3FA] truncate">
              {displayTitle}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#A29BB8]">
            {showEventSubline && (
              <span className="font-medium text-[#C4B5FD]">{eventName}</span>
            )}
            {eventLocation && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#A78BFA]" />
                {eventLocation}
              </span>
            )}
            {eventDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#A78BFA]" />
                {eventDate}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Users className="w-3 h-3 text-[#A78BFA]" />
              {expectedFootfall > 0
                ? `${expectedFootfall.toLocaleString('en-IN')} expected visitors`
                : 'Footfall: Not added yet'}
            </span>
            <span className="font-mono tabular-nums text-[#A29BB8]">
              {hasEventCosts
                ? `Expenses: ${fmt(stallTotals.totalEventCosts)}`
                : 'Rent / expenses: Not added yet'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasBudget && (
            <div className="surface-card rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10px] font-sans text-[#A29BB8]">Budget</div>
                <div className="font-bold text-[#F5F3FA]">
                  {fmt(overviewTotals.totalAllocatedBudget)}
                </div>
              </div>
              <div className="w-px h-6 bg-[#252136]" />
              <div>
                <div className="text-[10px] font-sans text-[#A29BB8]">Remaining</div>
                <div
                  className={`font-bold ${
                    budgetRemaining < 0 ? 'text-[#FB7185]' : 'text-[#34D399]'
                  }`}
                >
                  {budgetRemaining >= 0
                    ? fmt(budgetRemaining)
                    : `-${fmt(Math.abs(budgetRemaining))}`}
                </div>
              </div>
            </div>
          )}

          {hasInventory && (
            <button
              type="button"
              onClick={onCopyFullOrder}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#F5F3FA] transition-colors"
            >
              {fullOrderCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#34D399]" />
                  <span className="text-[#34D399]">Order copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Copy Full Order</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEventEditor((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
              showEventEditor
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/45 text-[#C4B5FD]'
                : 'bg-[#13111C] hover:bg-[#1A1726] border-[#252136] text-[#F5F3FA]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Event details</span>
          </button>
        </div>
      </section>

      {/* Expandable Event Details Editor */}
      {showEventEditor && (
        <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="block">
              <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                Event / Business name
              </span>
              <input
                type="text"
                value={eventName}
                onChange={(e) => onEventNameChange(e.target.value)}
                placeholder="e.g., Festive Craft Fair"
                className="w-full surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                City / Venue
              </span>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => onEventLocationChange(e.target.value)}
                placeholder="Optional city or venue"
                className="w-full surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                Event date
              </span>
              <input
                type="text"
                value={eventDate}
                onChange={(e) => onEventDateChange(e.target.value)}
                placeholder="Optional dates"
                className="w-full surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                Expected footfall
              </span>
              <input
                type="number"
                min={0}
                step={100}
                value={expectedFootfall || ''}
                placeholder="Not added yet"
                onChange={(e) =>
                  onExpectedFootfallChange(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full surface-inset rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                Stall rent (₹)
              </span>
              <input
                type="number"
                min={0}
                step={500}
                value={stallFee || ''}
                placeholder="Not added yet"
                onChange={(e) =>
                  onStallFeeChange(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full surface-inset rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </label>
          </div>
        </section>
      )}

      {/* Clean Empty-Inventory State when no products added yet */}
      {totalProductsCount === 0 && (
        <section className="surface-card rounded-2xl p-6 sm:p-8 border-[#8B5CF6]/35 bg-gradient-to-br from-[#171327] to-[#13111C] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C4B5FD]">
              <Layers className="w-4 h-4 text-[#A78BFA]" />
              <span>Your stock plan is empty</span>
            </div>
            <h2 className="font-display text-lg font-bold text-[#F5F3FA]">
              Add your categories &amp; products to see live financial numbers
            </h2>
            <p className="text-xs text-[#A29BB8] leading-relaxed">
              StallIQ calculates stock investment, expected sales, break-even targets, and supplier orders strictly from the products you enter.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStockPlanner}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_12px_28px_-8px_rgba(139,92,246,0.6)] shrink-0"
          >
            <span>Add categories &amp; products</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* 2. Four Prominent Metric Areas */}
      <section
        data-ai-section="overview_totals"
        className={`grid grid-cols-2 lg:grid-cols-4 gap-3.5 ${
          isHighlighted ? 'ai-highlight-pulse rounded-2xl' : ''
        }`}
      >
        {/* Stock Investment */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A29BB8]">
            <span>Stock Investment</span>
            {hasBudget && (
              <span className="font-mono tabular-nums text-[#C4B5FD] font-semibold">
                {budgetUsedPct}%
              </span>
            )}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#F5F3FA]">
            {fmt(stallTotals.totalCost)}
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  hasBudget && budgetRemaining < 0
                    ? 'bg-[#FB7185]'
                    : 'bg-gradient-to-r from-[#8B5CF6] to-[#C4B5FD]'
                }`}
                style={{ width: `${hasBudget ? budgetUsedPct : stallTotals.totalCost > 0 ? 100 : 0}%` }}
              />
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
              {totalProductsCount} products · {stallTotals.totalUnits} pcs
            </div>
          </div>
        </div>

        {/* Expected Sales */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A29BB8]">
            <span>Expected Sales</span>
            {hasPricing && (
              <span className="font-mono tabular-nums text-[#C4B5FD] font-semibold">
                {stallTotals.weightedSellThroughPct}% sold
              </span>
            )}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#F5F3FA]">
            {hasPricing ? fmt(stallTotals.revRealistic) : 'Not set'}
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#A78BFA]"
                style={{ width: `${hasPricing ? stallTotals.weightedSellThroughPct : 0}%` }}
              />
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
              {hasPricing
                ? `100% sold: ${fmt(stallTotals.rev100)}`
                : 'Add selling prices to estimate'}
            </div>
          </div>
        </div>

        {/* Expected Profit (Before Expenses) */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A29BB8]">
            <span>Expected Profit</span>
            {hasPricing && (
              <span className="font-mono tabular-nums text-[#34D399] font-semibold">
                {stallTotals.blendedMarginPct}% margin
              </span>
            )}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#34D399]">
            {hasPricing
              ? stallTotals.grossProfitReal >= 0
                ? `+${fmt(stallTotals.grossProfitReal)}`
                : `-${fmt(Math.abs(stallTotals.grossProfitReal))}`
              : '—'}
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34D399]/80"
                style={{
                  width: `${
                    hasPricing ? Math.min(100, Math.max(8, stallTotals.blendedMarginPct)) : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
              {hasInventory
                ? `Unsold stock value: ${fmt(stallTotals.unsoldInventoryCost)}`
                : 'No stock planned yet'}
            </div>
          </div>
        </div>

        {/* Profit After Expenses (Hero Gradient Highlight) */}
        <div
          className={`rounded-2xl p-4 sm:p-5 space-y-3 border ${
            !hasPricing || stallTotals.netAfterStallReal >= 0
              ? 'bg-gradient-to-br from-[#1C1630] via-[#151224] to-[#11191D] border-[#8B5CF6]/45 shadow-[0_12px_36px_-12px_rgba(139,92,246,0.3)]'
              : 'bg-gradient-to-br from-[#23141E] to-[#14111B] border-[#FB7185]/45'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-[#C4B5FD]">
            <span>Profit After Expenses</span>
            <span className="font-mono tabular-nums text-[#FBBF24] font-semibold">
              {hasEventCosts ? `-${fmt(stallTotals.totalEventCosts)}` : '₹0 exp'}
            </span>
          </div>
          <div
            className={`font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              !hasPricing
                ? 'text-[#A29BB8]'
                : stallTotals.netAfterStallReal >= 0
                ? 'text-[#34D399]'
                : 'text-[#FB7185]'
            }`}
          >
            {!hasPricing
              ? '—'
              : stallTotals.netAfterStallReal >= 0
              ? `+${fmt(stallTotals.netAfterStallReal)}`
              : `-${fmt(Math.abs(stallTotals.netAfterStallReal))}`}
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  !hasPricing || stallTotals.netAfterStallReal >= 0
                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#34D399]'
                    : 'bg-[#FB7185]'
                }`}
                style={{
                  width: `${
                    hasPricing
                      ? Math.min(100, Math.max(10, stallTotals.breakEvenCoveragePct))
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
              {hasPricing
                ? `Break-even: ${stallTotals.breakEvenSellThroughPct}% (${stallTotals.unitsToBreakEven} pcs)`
                : 'Set selling prices to calculate'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Visual Money Flow Strip (shown when inventory exists) */}
      {hasInventory && (
        <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Money Flow (Estimated)
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#A29BB8]">Sell-through</span>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={globalSellThrough}
                onChange={(e) => onApplyGlobalSellThrough(Number(e.target.value))}
                aria-label="Expected sell-through percentage"
                className="w-24 sm:w-32 accent-[#8B5CF6] cursor-pointer"
              />
              <span className="font-mono tabular-nums font-bold text-[#C4B5FD] w-9 text-right">
                {globalSellThrough}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {moneyFlowSteps.map((step, i) => (
              <div
                key={step.label}
                className="surface-inset rounded-xl p-3 flex flex-col justify-between gap-2 relative"
              >
                <div className="flex items-center justify-between text-[11px] text-[#A29BB8]">
                  <span>{step.label}</span>
                  {i < moneyFlowSteps.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-[#4C4369] hidden sm:block" />
                  )}
                </div>
                <div
                  className={`font-mono tabular-nums text-base font-bold ${step.textClass}`}
                >
                  {step.value < 0
                    ? `-${fmt(Math.abs(step.value))}`
                    : fmt(step.value)}
                </div>
                <div className="h-1.5 rounded-full bg-[#191526] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${step.barClass}`}
                    style={{ width: `${Math.max(6, Math.min(100, step.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Clickable Sell-Through Scenarios Comparison (100% / 90% / 75% / 50%) */}
          {hasPricing && (
            <div className="pt-3 border-t border-[#252136] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#C4B5FD]">
                  What-If Sales Scenarios (click to apply)
                </span>
                <span className="text-[#A29BB8]">
                  Unsold stock stays in inventory — it ties up cash rather than becoming a cash loss.
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {scenarios.map((sc) => {
                  const isActive = globalSellThrough === sc.pct;
                  return (
                    <button
                      key={sc.pct}
                      type="button"
                      onClick={() => onApplyGlobalSellThrough(sc.pct)}
                      className={`text-left rounded-xl p-3 border transition-all ${
                        isActive
                          ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/60 shadow-[0_0_18px_-6px_rgba(139,92,246,0.45)]'
                          : 'surface-inset hover:border-[#3B3357]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#F5F3FA]">{sc.label}</span>
                        <span
                          className={`font-mono text-[10px] font-semibold ${
                            sc.coversBreakEven ? 'text-[#34D399]' : 'text-[#FBBF24]'
                          }`}
                        >
                          {sc.coversBreakEven ? 'Covers costs' : 'Below BE'}
                        </span>
                      </div>
                      <div
                        className={`font-mono tabular-nums text-base font-bold mt-1 ${
                          sc.finalProfit >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
                        }`}
                      >
                        {sc.finalProfit >= 0
                          ? `+${fmt(sc.finalProfit)}`
                          : `-${fmt(Math.abs(sc.finalProfit))}`}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#A29BB8] mt-1">
                        <span>Sales {fmt(sc.revenue)}</span>
                        <span>Unsold {fmt(sc.unsoldInventoryValue)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Visual Analytics Row: Category Allocation Donut + Sales vs Break-Even */}
      {resolvedGroups.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Category Allocation Donut Chart + Segmented Budget Bar */}
          <div className="lg:col-span-6 surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Category Allocation
              </h2>
              <button
                type="button"
                onClick={onOpenStockPlanner}
                className="text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] inline-flex items-center gap-1"
              >
                <span>Edit stock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Segmented Budget Usage Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 rounded-full bg-[#0E0C15] overflow-hidden flex border border-[#252136]">
                {categorySlices.map((slice) => (
                  <div
                    key={slice.id}
                    title={`${slice.name}: ${fmt(slice.spend)}`}
                    style={{
                      width: `${
                        slice.spend > 0
                          ? Math.max(
                              3,
                              (slice.spend /
                                Math.max(
                                  1,
                                  overviewTotals.totalAllocatedBudget ||
                                    overviewTotals.totalInvestment
                                )) *
                                100
                            )
                          : 0
                      }%`,
                      backgroundColor: slice.color,
                    }}
                    className="h-full transition-all duration-300"
                  />
                ))}
              </div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#A29BB8]">
                <span>Planned stock {fmt(overviewTotals.totalInvestment)}</span>
                <span>
                  {hasBudget
                    ? `Budget ${fmt(overviewTotals.totalAllocatedBudget)}`
                    : 'No budget cap set'}
                </span>
              </div>
            </div>

            {/* Donut + Compact Legend */}
            <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
              <div className="relative w-36 h-36 shrink-0">
                <svg
                  viewBox="0 0 120 120"
                  className="w-full h-full -rotate-90"
                  role="img"
                  aria-label="Category investment distribution"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke="#1C1829"
                    strokeWidth="14"
                  />
                  {categorySlices.map((slice) => {
                    const circumference = 2 * Math.PI * 44;
                    const dash = slice.frac * circumference;
                    const offset = -slice.start * circumference;
                    if (dash <= 0) return null;
                    return (
                      <circle
                        key={slice.id}
                        cx="60"
                        cy="60"
                        r="44"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="14"
                        strokeDasharray={`${Math.max(0, dash - 2)} ${circumference}`}
                        strokeDashoffset={offset}
                        strokeLinecap="butt"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                    {resolvedGroups.length}
                  </span>
                  <span className="text-[10px] text-[#A29BB8]">categories</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                {categorySlices.map((slice) => (
                  <button
                    key={slice.id}
                    type="button"
                    onClick={() => onEditCategoryGroup(slice.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0E0C15] hover:bg-[#1A1726] border border-[#211D30] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs font-medium text-[#F5F3FA] truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 font-mono tabular-nums text-xs shrink-0">
                      <span className="text-[#F5F3FA] font-semibold">
                        {fmt(slice.spend)}
                      </span>
                      <span className="text-[#A29BB8] w-8 text-right">{slice.pct}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Sales vs Break-Even Visual & Next Actions */}
          <div className="lg:col-span-6 surface-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                    Sales vs Break-Even
                  </h2>
                  <span className="font-mono tabular-nums text-xs text-[#A29BB8]">
                    Target: {fmt(breakEvenSalesNeeded)}
                  </span>
                </div>
                <p className="text-[11px] text-[#A29BB8]">
                  {hasPricing && stallTotals.totalUnits > 0
                    ? `You need ${fmt(breakEvenSalesNeeded)} in sales to recover ${fmt(stallTotals.totalCost)} stock + ${fmt(stallTotals.totalEventCosts)} expenses.`
                    : 'Add expected selling prices and quantities in Categories & Products to calculate break-even.'}
                </p>
              </div>

              {/* Visual Break-Even Comparison Bar */}
              <div className="surface-inset rounded-xl p-4 space-y-3">
                <div className="relative pt-5 pb-1">
                  {hasPricing && (
                    <div
                      style={{ left: `${breakEvenMarkerPct}%` }}
                      className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                    >
                      <span className="text-[10px] font-mono font-semibold text-[#FBBF24] whitespace-nowrap">
                        Break-even
                      </span>
                      <div className="w-0.5 h-6 bg-[#FBBF24]" />
                    </div>
                  )}

                  <div className="h-4 rounded-full bg-[#1C1829] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        stallTotals.revRealistic >= breakEvenSalesNeeded
                          ? 'bg-gradient-to-r from-[#8B5CF6] to-[#34D399]'
                          : 'bg-gradient-to-r from-[#8B5CF6] to-[#FB7185]'
                      }`}
                      style={{ width: `${expectedSalesPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-[#C4B5FD] font-semibold">
                    Expected: {hasPricing ? fmt(stallTotals.revRealistic) : 'Not set'}
                  </span>
                  {hasPricing && (
                    <span
                      className={
                        stallTotals.netAfterStallReal >= 0
                          ? 'text-[#34D399] font-semibold'
                          : 'text-[#FB7185] font-semibold'
                      }
                    >
                      {stallTotals.netAfterStallReal >= 0
                        ? `+${fmt(stallTotals.netAfterStallReal)} cushion`
                        : `${fmt(Math.abs(stallTotals.netAfterStallReal))} short`}
                    </span>
                  )}
                </div>
              </div>

              {/* Compact Metrics */}
              <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Break-even</div>
                  <div className="text-base font-bold text-[#F5F3FA] mt-0.5">
                    {hasPricing ? `${stallTotals.unitsToBreakEven} pcs` : '—'}
                  </div>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Buyers needed</div>
                  <div className="text-base font-bold text-[#C4B5FD] mt-0.5">
                    {expectedFootfall > 0 && hasPricing
                      ? `${stallTotals.footfallConversionNeeded}%`
                      : 'Not set'}
                  </div>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Avg appeal</div>
                  <div className="text-base font-bold text-[#FBBF24] mt-0.5">
                    {overviewTotals.weightedBeauty > 0
                      ? `${beautyToFiveScale(overviewTotals.weightedBeauty)}/5 ★`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#252136]">
              <button
                type="button"
                onClick={onOpenStockPlanner}
                className="py-2 px-3 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/40 text-xs font-semibold text-[#F5F3FA] transition-colors"
              >
                Categories
              </button>
              <button
                type="button"
                onClick={onOpenStallSetup}
                className="py-2 px-3 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/40 text-xs font-semibold text-[#F5F3FA] transition-colors"
              >
                Stall setup
              </button>
              <button
                type="button"
                onClick={onOpenResearch}
                className="py-2 px-3 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/40 text-xs font-semibold text-[#F5F3FA] transition-colors"
              >
                Research
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 5. Expandable Secondary Details (Clean & On-Demand) */}
      <section className="space-y-3" data-ai-section="overview_costs">
        {/* Expenses Drawer */}
        <div className="surface-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExpensesPanel((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-display text-sm font-bold text-[#F5F3FA]">
                Event Expenses
              </span>
              <span className="font-mono tabular-nums text-xs text-[#FBBF24] font-semibold">
                {hasEventCosts ? fmt(stallTotals.totalEventCosts) : 'Not added yet'}
              </span>
            </div>
            {showExpensesPanel ? (
              <ChevronUp className="w-4 h-4 text-[#A29BB8]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#A29BB8]" />
            )}
          </button>

          {showExpensesPanel && (
            <div className="px-5 pb-4 pt-2 border-t border-[#252136] space-y-3">
              <div className="flex items-center justify-between gap-3 surface-inset rounded-xl px-3.5 py-2.5">
                <span className="text-xs font-medium text-[#F5F3FA]">Stall rent</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={stallFee || ''}
                  placeholder="0"
                  onChange={(e) =>
                    onStallFeeChange(Math.max(0, Number(e.target.value) || 0))
                  }
                  aria-label="Stall rent"
                  className="w-28 bg-[#13111C] border border-[#2E2942] rounded-lg px-2.5 py-1 text-right font-mono tabular-nums text-xs text-[#F5F3FA]"
                />
              </div>

              {eventCostRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 surface-inset rounded-xl px-3.5 py-2"
                >
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => onUpdateEventCost(row.id, 'name', e.target.value)}
                    aria-label="Expense name"
                    className="flex-1 bg-transparent text-xs text-[#F5F3FA] focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.cost}
                    onChange={(e) => onUpdateEventCost(row.id, 'cost', e.target.value)}
                    aria-label="Expense cost"
                    className="w-24 bg-[#13111C] border border-[#2E2942] rounded-lg px-2 py-1 text-right font-mono tabular-nums text-xs text-[#F5F3FA]"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveEventCost(row.id)}
                    aria-label={`Remove ${row.name}`}
                    className="p-1 text-[#78718E] hover:text-[#FB7185]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[#A29BB8]">Quick add:</span>
                {QUICK_EXPENSE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onAddEventCost(preset.name, preset.defaultCost)}
                    className="px-2.5 py-1 rounded-lg bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/45 text-[11px] text-[#C4B5FD] transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddCustomExpense} className="flex flex-wrap gap-2 pt-1">
                <input
                  type="text"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  placeholder="Add expense (Transport, Packaging, Helper, Banners)"
                  className="flex-1 min-w-[180px] surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E]"
                />
                <input
                  type="number"
                  min={1}
                  value={newExpenseCost}
                  onChange={(e) => setNewExpenseCost(e.target.value)}
                  placeholder="₹ Amount"
                  className="w-28 surface-inset rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Actual Sales Tracker (Strictly Separate from Pre-Event Estimates) */}
        <div className="surface-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowActualSales((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Receipt className="w-4 h-4 text-[#34D399]" />
              <span className="font-display text-sm font-bold text-[#F5F3FA]">
                Actual Sales Tracker
              </span>
              <span className="font-mono tabular-nums text-xs text-[#34D399] font-semibold">
                {actualSales.length > 0
                  ? `${actualTotals.units} pcs · ${fmt(actualTotals.revenue)}`
                  : 'Log real event sales'}
              </span>
            </div>
            {showActualSales ? (
              <ChevronUp className="w-4 h-4 text-[#A29BB8]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#A29BB8]" />
            )}
          </button>

          {showActualSales && (
            <div className="px-5 pb-4 pt-3 border-t border-[#252136] space-y-4">
              <p className="text-[11px] text-[#A29BB8]">
                Recorded sales are tracked separately from your pre-event estimates so you can compare real results against your plan.
              </p>

              <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums text-xs">
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Actual sales</div>
                  <div className="text-base font-bold text-[#F5F3FA] mt-0.5">
                    {fmt(actualTotals.revenue)}
                  </div>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Actual gross profit</div>
                  <div className="text-base font-bold text-[#34D399] mt-0.5">
                    {actualTotals.grossProfit >= 0
                      ? `+${fmt(actualTotals.grossProfit)}`
                      : `-${fmt(Math.abs(actualTotals.grossProfit))}`}
                  </div>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <div className="text-[10px] font-sans text-[#A29BB8]">Net after expenses</div>
                  <div
                    className={`text-base font-bold mt-0.5 ${
                      actualTotals.netProfit >= 0 ? 'text-[#34D399]' : 'text-[#FBBF24]'
                    }`}
                  >
                    {actualTotals.netProfit >= 0
                      ? `+${fmt(actualTotals.netProfit)}`
                      : `-${fmt(Math.abs(actualTotals.netProfit))}`}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmitActualSale}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                {allProductOptions.length > 0 ? (
                  <select
                    value={saleProductKey}
                    onChange={(e) => {
                      setSaleProductKey(e.target.value);
                      const found = allProductOptions.find(
                        (p) => p.key === e.target.value
                      );
                      if (found && found.defaultPrice > 0) {
                        setSalePrice(String(found.defaultPrice));
                      }
                    }}
                    aria-label="Select product sold"
                    className="sm:col-span-5 surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA]"
                  >
                    <option value="">Custom item...</option>
                    {allProductOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.categoryName}: {p.productName}
                      </option>
                    ))}
                  </select>
                ) : null}

                {!saleProductKey && (
                  <input
                    type="text"
                    value={saleCustomName}
                    onChange={(e) => setSaleCustomName(e.target.value)}
                    placeholder="Product sold"
                    className={`${
                      allProductOptions.length > 0 ? 'sm:col-span-3' : 'sm:col-span-5'
                    } surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E]`}
                  />
                )}

                <input
                  type="number"
                  min={1}
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  placeholder="Qty"
                  aria-label="Quantity sold"
                  className="sm:col-span-2 surface-inset rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#F5F3FA]"
                />
                <input
                  type="number"
                  min={1}
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Sold ₹/pc"
                  aria-label="Actual selling price per piece"
                  className="sm:col-span-3 surface-inset rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#F5F3FA]"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2 px-3 rounded-xl bg-[#34D399] hover:bg-[#10B981] text-[#0B0A10] text-xs font-bold"
                >
                  + Record
                </button>
              </form>

              {actualSales.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {actualSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="surface-inset rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[#F5F3FA]">
                          {sale.productName}
                        </span>
                        <span className="ml-2 font-mono tabular-nums text-[#A29BB8]">
                          {sale.qtySold}× @ {fmt(sale.actualPricePerUnit)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                        <span className="font-semibold text-[#34D399]">
                          {fmt(sale.qtySold * sale.actualPricePerUnit)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveActualSale(sale.id)}
                          aria-label={`Remove sale ${sale.productName}`}
                          className="text-[#78718E] hover:text-[#FB7185]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Mixes & Wholesale Buying List Export Drawer */}
        <div className="surface-card rounded-2xl overflow-hidden" data-ai-section="overview_cards">
          <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowPlanBreakdown((v) => !v)}
              className="flex items-center gap-2 text-left"
            >
              <span className="font-display text-sm font-bold text-[#F5F3FA]">
                Categories &amp; Supplier Order ({resolvedGroups.length})
              </span>
              {showPlanBreakdown ? (
                <ChevronUp className="w-4 h-4 text-[#A29BB8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#A29BB8]" />
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {hasInventory && (
                <button
                  type="button"
                  onClick={handleExportSupplierCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1726] hover:bg-[#231F33] border border-[#2E2942] text-xs font-semibold text-[#F5F3FA]"
                >
                  <Download className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Supplier CSV</span>
                </button>
              )}
              <button
                type="button"
                onClick={onAddCategoryGroup}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/35 text-xs font-semibold text-[#C4B5FD]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Category</span>
              </button>
            </div>
          </div>

          {showPlanBreakdown && (
            <div className="px-5 pb-4 pt-2 border-t border-[#252136] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resolvedGroups.length === 0 ? (
                <p className="text-xs text-[#A29BB8] col-span-full">
                  No categories added yet.
                </p>
              ) : (
                resolvedGroups.map(({ group, combos, activeCombo }) => (
                  <div
                    key={group.id}
                    className="surface-inset rounded-xl p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F5F3FA] truncate">
                        {group.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditCategoryGroup(group.id)}
                        className="text-[11px] font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
                      >
                        Edit →
                      </button>
                    </div>
                    {activeCombo ? (
                      <div className="flex items-baseline justify-between font-mono tabular-nums text-xs">
                        <span className="text-[#F5F3FA] font-semibold">
                          {fmt(activeCombo.cost)}
                        </span>
                        <span className="text-[#34D399] font-semibold">
                          {activeCombo.rev90 > 0 ? `+${fmt(activeCombo.prof90)}` : 'Sell price not set'}
                        </span>
                        <span className="text-[#A29BB8]">{activeCombo.pieces} pcs</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#78718E]">
                        {group.categories.length} products · no quantities set yet
                      </div>
                    )}
                    {combos.length > 0 && (
                      <div className="flex gap-1.5">
                        {combos.slice(0, 3).map((c, idx) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectGroupCombo(group.id, c.id)}
                            className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              activeCombo?.id === c.id
                                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                : 'bg-[#13111C] text-[#A29BB8] border-[#252136] hover:text-[#F5F3FA]'
                            }`}
                          >
                            #{idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Extra Standalone Items + Optional AI Plan Check Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Extra Standalone Items */}
          <div className="surface-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowExtraStock((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-[#F5F3FA]"
              >
                <span>Extra Standalone Stock ({extraStockRows.length})</span>
                {showExtraStock ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#A29BB8]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#A29BB8]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExtraStock(true);
                  onAddStockItem();
                }}
                className="text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add item</span>
              </button>
            </div>

            {showExtraStock && (
              <div className="space-y-2 pt-1">
                {extraStockRows.length === 0 ? (
                  <div className="text-xs text-[#78718E]">No extra standalone items.</div>
                ) : (
                  extraStockRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 gap-1.5 items-center surface-inset rounded-xl px-2.5 py-2 text-xs"
                    >
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => onUpdateStockItem(row.id, 'name', e.target.value)}
                        className="col-span-5 bg-transparent text-[#F5F3FA] focus:outline-none"
                      />
                      <input
                        type="number"
                        value={row.cost}
                        onChange={(e) => onUpdateStockItem(row.id, 'cost', e.target.value)}
                        aria-label="Item buy cost"
                        className="col-span-2 bg-[#13111C] border border-[#252136] rounded px-1.5 py-0.5 font-mono tabular-nums text-right"
                      />
                      <input
                        type="number"
                        value={row.price}
                        onChange={(e) => onUpdateStockItem(row.id, 'price', e.target.value)}
                        aria-label="Item sell price"
                        className="col-span-2 bg-[#13111C] border border-[#252136] rounded px-1.5 py-0.5 font-mono tabular-nums text-right"
                      />
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => onUpdateStockItem(row.id, 'qty', e.target.value)}
                        aria-label="Item quantity"
                        className="col-span-2 bg-[#13111C] border border-[#252136] rounded px-1.5 py-0.5 font-mono tabular-nums text-right"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveStockItem(row.id)}
                        aria-label={`Delete ${row.name}`}
                        className="col-span-1 flex justify-end text-[#78718E] hover:text-[#FB7185]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Quick AI Plan Check */}
          <div className="surface-card rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F5F3FA]">
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>AI Plan Check</span>
              </div>
              <button
                type="button"
                disabled={aiAuditLoading || !hasInventory}
                onClick={onRunPlanReview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/35 text-xs font-semibold text-[#C4B5FD] disabled:opacity-50"
              >
                {aiAuditLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{aiAuditReport ? 'Refresh' : 'Check plan'}</span>
              </button>
            </div>

            {aiAuditError && (
              <p className="text-xs text-[#FB7185]">{aiAuditError}</p>
            )}
            {aiAuditReport ? (
              <div className="surface-inset rounded-xl p-3 text-xs text-[#F5F3FA] whitespace-pre-line leading-relaxed max-h-44 overflow-y-auto">
                {aiAuditReport}
              </div>
            ) : (
              <p className="text-xs text-[#A29BB8]">
                {hasInventory
                  ? 'Run an AI review of your margins, break-even target, and product mix.'
                  : 'Add products first to run an AI check on your plan.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
