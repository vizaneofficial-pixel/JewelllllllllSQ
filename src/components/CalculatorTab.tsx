import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { StallStockItem, StallTotals } from '../types/stall';

interface CalculatorTabProps {
  eventName: string;
  expectedFootfall: number;
  stallTotals: StallTotals;
  stallFee: number;
  globalSellThrough: number;
  onStallFeeChange: (val: number) => void;
  onAddEventCost: (name?: string, amount?: number) => void;
  onUpdateEventCost: (id: string, field: 'name' | 'cost', val: string) => void;
  onRemoveEventCost: (id: string) => void;
  onApplyGlobalSellThrough: (pct: number) => void;
  onUpdateStockItem: (id: string, field: keyof StallStockItem, val: string) => void;
  onAddStockItem: () => void;
  onAddParsedStockItems: (items: StallStockItem[]) => void;
  onRemoveStockItem: (id: string) => void;
  onResetSyncedBundles: () => void;
  aiAuditLoading: boolean;
  aiAuditReport: string | null;
  aiAuditError: string | null;
  onRunAiCfoAudit: () => void;
}

export function CalculatorTab({
  eventName,
  expectedFootfall,
  stallTotals,
  stallFee,
  globalSellThrough,
  onStallFeeChange,
  onAddEventCost,
  onUpdateEventCost,
  onRemoveEventCost,
  onApplyGlobalSellThrough,
  onUpdateStockItem,
  onAddStockItem,
  onAddParsedStockItems,
  onRemoveStockItem,
  onResetSyncedBundles,
  aiAuditLoading,
  aiAuditReport,
  aiAuditError,
  onRunAiCfoAudit,
}: CalculatorTabProps) {
  const [conservativeView, setConservativeView] = useState(true);
  const [showDetailedLedger, setShowDetailedLedger] = useState(false);
  const [showNotesImporter, setShowNotesImporter] = useState(false);
  const [rawNotes, setRawNotes] = useState('');
  const [rawParsing, setRawParsing] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);
  const [rawSuccess, setRawSuccess] = useState<string | null>(null);

  const hasEventCosts = stallTotals.totalEventCosts > 0;
  const displayRev = conservativeView ? stallTotals.revRealistic : stallTotals.rev100;
  const displayGrossProfit = conservativeView
    ? stallTotals.grossProfitReal
    : stallTotals.grossProfit100;
  const displayNetProfit = conservativeView
    ? stallTotals.netAfterStallReal
    : stallTotals.netAfterStall100;
  const displaySellPct = conservativeView ? stallTotals.weightedSellThroughPct : 100;
  const displayMarginPct =
    displayRev > 0
      ? Number(((displayGrossProfit / displayRev) * 100).toFixed(1))
      : 0;
  const displayCapitalMultiple =
    stallTotals.totalOutlay > 0
      ? Number((displayRev / stallTotals.totalOutlay).toFixed(2))
      : 0;
  const displayEventCostSharePct =
    displayGrossProfit > 0
      ? Math.min(100, Number(((stallTotals.totalEventCosts / displayGrossProfit) * 100).toFixed(1)))
      : stallTotals.totalEventCosts > 0
        ? 100
        : 0;

  const syncedRows = stallTotals.itemRows.filter((r) => r.isSyncedBundle);
  const manualRows = stallTotals.itemRows.filter((r) => !r.isSyncedBundle);
  const hasLotOrSellOverrides = syncedRows.some(
    (r) => r.qty !== 1 || r.sellThroughManual
  );

  const handleImportRawNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawNotes.trim()) return;
    setRawParsing(true);
    setRawError(null);
    setRawSuccess(null);

    try {
      const res = await fetch('/api/ai/parse-raw-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawNotes: rawNotes.trim(),
          defaultSellThrough: globalSellThrough,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not parse stock notes');

      const items: StallStockItem[] = (data.items || []).map(
        (
          item: {
            name: string;
            category: string;
            cost: number;
            price: number;
            qty: number;
            sellThrough: number;
          },
          idx: number
        ) => ({
          id: `raw_${Date.now()}_${idx}`,
          name: item.name || 'Imported Item',
          category: item.category || 'Custom',
          cost: Math.max(0, Number(item.cost) || 0),
          price: Math.max(0, Number(item.price) || 0),
          qty: Math.max(1, Number(item.qty) || 1),
          sellThrough: Math.min(
            100,
            Math.max(10, Number(item.sellThrough) || globalSellThrough)
          ),
          isSyncedBundle: false,
          itemType: 'stock',
        })
      );

      if (items.length === 0) {
        setRawError(
          'No inventory items detected. Try including item name, cost, sell price, and quantity.'
        );
      } else {
        onAddParsedStockItems(items);
        setRawSuccess(`Added ${items.length} stock item(s) to your stall ledger.`);
        setRawNotes('');
        setShowDetailedLedger(true);
      }
    } catch (err) {
      setRawError(
        err instanceof Error ? err.message : 'Failed to parse rough stock notes.'
      );
    } finally {
      setRawParsing(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Item',
      'Category',
      'Type',
      'Unit Cost (INR)',
      'Sell Price (INR)',
      'Qty',
      'Sell-Through %',
      'Total Cost',
      'Est. Revenue',
      'Est. Profit',
      'ROI %',
    ];
    const stockLines = stallTotals.itemRows.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.category}"`,
      r.isSyncedBundle ? 'Synced Category Mix' : 'Manual Item',
      r.cost,
      r.price,
      r.qty,
      r.sellThrough,
      r.lineCost,
      r.lineRevReal,
      r.lineProfitReal,
      r.roiPct,
    ]);
    const expenseLines = [
      [
        '"Stall / Booth Rent"',
        '"Event Cost"',
        'Fixed Cost',
        stallFee,
        0,
        1,
        0,
        stallFee,
        0,
        -stallFee,
        0,
      ],
      ...stallTotals.eventCostRows.map((e) => [
        `"${e.name.replace(/"/g, '""')}"`,
        '"Event Cost"',
        'Event Expense',
        e.cost,
        0,
        1,
        0,
        e.lineCost,
        0,
        -e.lineCost,
        0,
      ]),
    ];
    const csv = [
      header.join(','),
      ...stockLines.map((r) => r.join(',')),
      ...expenseLines.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (eventName || 'stalliq-stock')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    a.download = `${slug}-cfo.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 1. Master CFO Summary */}
      <section
        data-ai-section="cfo_summary"
        aria-label="Master CFO Summary"
        className="bg-white border border-[#D9E2DC] rounded-2xl p-4 sm:p-5 space-y-4 shadow-[0_1px_2px_rgba(19,32,30,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-bold text-[#13201E]">
              Total Stall CFO
            </h1>
            <p className="text-xs text-[#465853]">
              Synced with {syncedRows.length} category mix{syncedRows.length === 1 ? '' : 'es'}
              {manualRows.length > 0
                ? ` + ${manualRows.length} extra item${manualRows.length === 1 ? '' : 's'}`
                : ' · Matches Stock Overview 1:1'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="CFO sell-through scenario"
              className="flex items-center bg-[#F1F5F2] p-1 rounded-xl border border-[#D0DDD5]"
            >
              <button
                type="button"
                aria-pressed={!conservativeView}
                onClick={() => setConservativeView(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  !conservativeView
                    ? 'bg-white text-[#13201E] shadow-xs'
                    : 'text-[#465853] hover:text-[#13201E]'
                }`}
              >
                100% Sold
              </button>
              <button
                type="button"
                aria-pressed={conservativeView}
                onClick={() => setConservativeView(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  conservativeView
                    ? 'bg-[#0F5E54] text-white shadow-xs'
                    : 'text-[#465853] hover:text-[#13201E]'
                }`}
              >
                Conservative (~{stallTotals.weightedSellThroughPct}% est.)
              </button>
            </div>

            {hasLotOrSellOverrides && (
              <button
                type="button"
                onClick={onResetSyncedBundles}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFFBEB] hover:bg-[#FEF3C7] text-xs font-semibold text-[#92400E] border border-[#F59E0B]/35 whitespace-nowrap"
                title="Reset synced category lot quantities and sell-through rates to match Stock Overview 1:1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Sync 1:1</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRunAiCfoAudit}
              disabled={aiAuditLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F5E54] hover:bg-[#0B4B43] disabled:opacity-60 text-white font-semibold text-xs whitespace-nowrap transition-colors"
            >
              {aiAuditLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{aiAuditLoading ? 'Auditing...' : 'Deep CFO Audit'}</span>
            </button>
          </div>
        </div>

        {/* 4 Core CFO KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#FAF8F3] border border-[#D9E2DC] rounded-xl p-3.5 space-y-1">
            <div className="text-xs text-[#465853]">Total Capital Outlay</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-[#13201E] tabular-nums">
              ₹{stallTotals.totalOutlay.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-mono text-[#465853] tabular-nums">
              ₹{stallTotals.totalCost.toLocaleString('en-IN')} Stock + ₹
              {stallTotals.totalEventCosts.toLocaleString('en-IN')} Event Costs
            </div>
          </div>

          <div className="bg-[#FAF8F3] border border-[#D9E2DC] rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#465853]">Projected Revenue</span>
              <span className="font-mono font-semibold text-[#0F5E54] tabular-nums">
                {displaySellPct}% est.
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-[#13201E] tabular-nums">
              ₹{displayRev.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="range"
                aria-label="Global sell-through percentage"
                min={50}
                max={100}
                step={5}
                value={globalSellThrough}
                onChange={(e) =>
                  onApplyGlobalSellThrough(Number(e.target.value))
                }
                className="w-20 h-1 bg-[#D9E2DC] rounded-lg accent-[#0F5E54] cursor-pointer"
              />
              <span className="text-[11px] font-mono text-[#465853] tabular-nums">
                {conservativeView
                  ? `100%: ₹${stallTotals.rev100.toLocaleString('en-IN')}`
                  : `${stallTotals.weightedSellThroughPct}%: ₹${stallTotals.revRealistic.toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          <div
            className={`rounded-xl p-3.5 space-y-1 border ${
              hasEventCosts
                ? displayNetProfit >= 0
                  ? 'bg-[#E7F3EF] border-[#0F5E54]/35'
                  : 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-[#FAF8F3] border-[#D9E2DC]'
            }`}
          >
            <div className="text-xs text-[#0F5E54] font-semibold">
              {hasEventCosts
                ? 'Est. Net Profit'
                : 'Est. Profit (before event costs)'}
            </div>
            <div
              className={`text-2xl sm:text-3xl font-mono font-bold tabular-nums ${
                displayNetProfit >= 0 ? 'text-[#0F5E54]' : 'text-[#B91C1C]'
              }`}
            >
              {displayNetProfit >= 0 ? '+' : ''}₹
              {displayNetProfit.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#465853]">
              {hasEventCosts
                ? `Gross +₹${displayGrossProfit.toLocaleString('en-IN')} − ₹${stallTotals.totalEventCosts.toLocaleString('en-IN')} fees`
                : 'Add stall rent or event costs below for net profit'}
            </div>
          </div>

          <div className="bg-[#FFFBEB] border border-[#F59E0B]/30 rounded-xl p-3.5 space-y-1">
            <div className="text-xs text-[#92400E] font-medium">Break-Even & Stock</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-[#13201E] tabular-nums">
              {stallTotals.breakEvenSellThroughPct}%{' '}
              <span className="text-xs font-normal text-[#465853]">
                ({stallTotals.unitsToBreakEven}/{stallTotals.totalUnits} pcs)
              </span>
            </div>
            <div className="text-[11px] text-[#465853] font-mono tabular-nums">
              {stallTotals.footfallConversionNeeded}% of{' '}
              {expectedFootfall.toLocaleString('en-IN')} crowd
              {conservativeView && stallTotals.unsoldInventoryCost > 0
                ? ` · ₹${stallTotals.unsoldInventoryCost.toLocaleString('en-IN')} kept`
                : ''}
            </div>
          </div>
        </div>

        {/* Compact Ratios Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-[#E5ECE7] text-xs">
          <div>
            <span className="block text-[11px] text-[#465853]">
              Blended Gross Margin
            </span>
            <span className="font-mono font-bold text-[#13201E] tabular-nums">
              {displayMarginPct}%
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#465853]">
              Capital Return Multiple
            </span>
            <span className="font-mono font-bold text-[#B45309] tabular-nums">
              {displayCapitalMultiple}x
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#465853]">
              Event Cost Share
            </span>
            <span className="font-mono font-bold text-[#13201E] tabular-nums">
              {displayEventCostSharePct}% of Gross Profit
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#465853]">Top ROI Driver</span>
            <span className="font-semibold text-[#0F5E54] truncate block tabular-nums">
              {stallTotals.topRoiItemName} · {stallTotals.topRoiPct}% ROI
            </span>
          </div>
        </div>
      </section>

      {aiAuditError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 text-xs text-[#991B1B] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aiAuditError}</span>
        </div>
      )}

      {aiAuditReport && (
        <div className="bg-white border border-[#0F5E54]/30 rounded-2xl p-4 text-xs text-[#13201E] whitespace-pre-line leading-relaxed space-y-1.5 shadow-[0_1px_2px_rgba(19,32,30,0.04)]">
          <div className="font-semibold text-[#0F5E54] flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            <span>AI Stall CFO Audit</span>
          </div>
          <div>{aiAuditReport}</div>
        </div>
      )}

      {/* 2. Capital Breakdown & Stall/Event Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section
          aria-label="Category Cost vs Revenue Summary"
          className="bg-white border border-[#D9E2DC] rounded-2xl p-4 space-y-3 shadow-[0_1px_2px_rgba(19,32,30,0.04)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-[#13201E]">
              Capital & Profit Breakdown
            </h2>
            <span className="text-[11px] text-[#465853] font-mono tabular-nums">
              Unsold goods stay inventory
            </span>
          </div>

          <div className="space-y-2.5">
            {stallTotals.itemRows.map((row) => {
              const costShare =
                stallTotals.totalOutlay > 0
                  ? Math.round((row.lineCost / stallTotals.totalOutlay) * 100)
                  : 0;
              const revVal = conservativeView ? row.lineRevReal : row.lineRev100;
              const profVal = conservativeView
                ? row.lineProfitReal
                : row.lineProfit100;
              return (
                <div key={row.id} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#13201E] truncate">
                      {row.name}
                    </span>
                    <span className="font-mono text-[#465853] tabular-nums shrink-0">
                      ₹{row.lineCost.toLocaleString('en-IN')} ({costShare}%) → Rev ₹
                      {revVal.toLocaleString('en-IN')} (
                      <span
                        className={
                          profVal >= 0 ? 'text-[#0F5E54] font-semibold' : 'text-[#B91C1C] font-semibold'
                        }
                      >
                        {profVal >= 0 ? '+' : ''}₹
                        {profVal.toLocaleString('en-IN')}
                      </span>
                      )
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#E5ECE7] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(2, costShare))}%` }}
                      className={`h-full rounded-full ${
                        row.isSyncedBundle ? 'bg-[#0F5E54]' : 'bg-[#D97706]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          data-ai-section="cfo_costs"
          aria-label="Stall and Event Costs"
          className="bg-white border border-[#D9E2DC] rounded-2xl p-4 space-y-3 shadow-[0_1px_2px_rgba(19,32,30,0.04)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-[#13201E]">
                Stall & Exhibition Costs
              </h2>
              <p className="text-xs text-[#465853]">
                Included in total outlay & net profit
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddEventCost('Display / Travel / Packaging', 500)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F1F5F2] hover:bg-[#E7EEEA] border border-[#D0DDD5] text-xs font-semibold text-[#0F5E54]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event Cost</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2 bg-[#FAF8F3] border border-[#D9E2DC] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#13201E] font-semibold">
                Stall / Booth Rent
              </span>
              <span className="flex items-center gap-1 font-mono text-[#B45309]">
                ₹
                <input
                  type="number"
                  min={0}
                  aria-label="CFO stall rent"
                  value={stallFee}
                  onChange={(e) =>
                    onStallFeeChange(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-24 bg-transparent text-right font-bold text-[#13201E] focus:outline-none tabular-nums"
                />
              </span>
            </label>

            {stallTotals.eventCostRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 bg-[#FAF8F3] border border-[#D9E2DC] rounded-xl px-3 py-2 text-xs"
              >
                <input
                  type="text"
                  aria-label={`Event expense name for ${row.name}`}
                  value={row.name}
                  onChange={(e) =>
                    onUpdateEventCost(row.id, 'name', e.target.value)
                  }
                  className="min-w-0 flex-1 bg-transparent text-[#13201E] font-medium focus:outline-none"
                />
                <span className="flex items-center gap-1 font-mono text-[#B45309] shrink-0">
                  ₹
                  <input
                    type="number"
                    min={0}
                    aria-label={`Event expense cost for ${row.name}`}
                    value={row.cost}
                    onChange={(e) =>
                      onUpdateEventCost(row.id, 'cost', e.target.value)
                    }
                    className="w-20 bg-transparent text-right font-bold text-[#13201E] focus:outline-none tabular-nums"
                  />
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${row.name} cost`}
                  onClick={() => onRemoveEventCost(row.id)}
                  className="text-[#5B6D68] hover:text-[#B91C1C] p-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 3. Expandable Detailed Inventory Ledger & Actions */}
      <section
        data-ai-section="cfo_ledger"
        aria-label="Detailed Inventory Ledger"
        className="bg-white border border-[#D9E2DC] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(19,32,30,0.04)]"
      >
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            aria-expanded={showDetailedLedger}
            onClick={() => setShowDetailedLedger((prev) => !prev)}
            className="flex items-center gap-2 text-left text-xs font-bold text-[#13201E] hover:text-[#0F5E54] transition-colors"
          >
            {showDetailedLedger ? (
              <ChevronUp className="w-4 h-4 text-[#0F5E54]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#0F5E54]" />
            )}
            <span>
              Detailed Inventory Ledger ({stallTotals.itemRows.length} rows ·{' '}
              {stallTotals.totalUnits} pcs)
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={showNotesImporter}
              onClick={() => setShowNotesImporter((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F3] hover:bg-[#F1F5F2] text-xs font-semibold text-[#13201E] border border-[#D0DDD5]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F5E54]" />
              <span>Import Notes (AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddStockItem();
                setShowDetailedLedger(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F5E54] hover:bg-[#0B4B43] text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock Row</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F3] hover:bg-[#F1F5F2] text-xs font-semibold text-[#13201E] border border-[#D0DDD5]"
            >
              <Download className="w-3.5 h-3.5 text-[#465853]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {showNotesImporter && (
          <div className="px-4 pb-3 border-t border-[#E5ECE7] pt-3 space-y-2 bg-[#FAF8F3]">
            <form onSubmit={handleImportRawNotes} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Paste rough stock notes to import"
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                placeholder='e.g. "40 ceramic mugs cost 85 sell 249, 15 linen totes cost 120 sell 299"'
                className="flex-1 bg-white border border-[#D0DDD5] focus:border-[#0F5E54] rounded-xl px-3 py-2 text-xs text-[#13201E] placeholder-[#5B6D68] focus:outline-none"
              />
              <button
                type="submit"
                disabled={rawParsing}
                className="px-4 py-2 rounded-xl bg-[#0F5E54] hover:bg-[#0B4B43] text-white text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                {rawParsing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{rawParsing ? 'Extracting...' : 'Import Notes'}</span>
              </button>
            </form>
            {rawSuccess && <div className="text-xs text-[#0F5E54] font-medium">{rawSuccess}</div>}
            {rawError && <div className="text-xs text-[#B91C1C] font-medium">{rawError}</div>}
          </div>
        )}

        {showDetailedLedger && (
          <div className="border-t border-[#E5ECE7] p-4 space-y-3">
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {stallTotals.itemRows.map((row) => (
                <div
                  key={row.id}
                  className={`rounded-xl border p-3 space-y-2.5 text-xs ${
                    row.isSyncedBundle
                      ? 'bg-[#F4F8F6] border-[#0F5E54]/30'
                      : 'bg-[#FAF8F3] border-[#D9E2DC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      aria-label={`Mobile item name for ${row.name}`}
                      value={row.name}
                      disabled={row.isSyncedBundle}
                      onChange={(e) =>
                        onUpdateStockItem(row.id, 'name', e.target.value)
                      }
                      className="bg-transparent font-bold text-[#13201E] flex-1 min-w-0 focus:outline-none disabled:text-[#0F5E54]"
                    />
                    {!row.isSyncedBundle && (
                      <button
                        type="button"
                        aria-label={`Remove ${row.name} on mobile`}
                        onClick={() => onRemoveStockItem(row.id)}
                        className="text-[#5B6D68] hover:text-[#B91C1C] p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
                    <label className="bg-white border border-[#E5ECE7] rounded-lg px-2 py-1">
                      <span className="block font-sans text-[10px] text-[#465853]">
                        Cost ₹
                      </span>
                      <input
                        type="number"
                        value={row.cost}
                        disabled={row.isSyncedBundle}
                        onChange={(e) =>
                          onUpdateStockItem(row.id, 'cost', e.target.value)
                        }
                        className="w-full bg-transparent text-[#13201E] font-semibold focus:outline-none"
                      />
                    </label>
                    <label className="bg-white border border-[#E5ECE7] rounded-lg px-2 py-1">
                      <span className="block font-sans text-[10px] text-[#465853]">
                        Sell ₹
                      </span>
                      <input
                        type="number"
                        value={row.price}
                        disabled={row.isSyncedBundle}
                        onChange={(e) =>
                          onUpdateStockItem(row.id, 'price', e.target.value)
                        }
                        className="w-full bg-transparent text-[#0F5E54] font-semibold focus:outline-none"
                      />
                    </label>
                    <label className="bg-white border border-[#E5ECE7] rounded-lg px-2 py-1">
                      <span className="block font-sans text-[10px] text-[#465853]">
                        {row.isSyncedBundle ? 'Lots' : 'Qty'}
                      </span>
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) =>
                          onUpdateStockItem(row.id, 'qty', e.target.value)
                        }
                        className="w-full bg-transparent text-[#13201E] font-semibold focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                    <span className="text-[#465853]">
                      {conservativeView
                        ? `Est. ${row.sellThrough}% sold · Rev ₹${row.lineRevReal.toLocaleString('en-IN')}`
                        : `100% sold · Rev ₹${row.lineRev100.toLocaleString('en-IN')}`}
                    </span>
                    <span
                      className={`font-bold ${
                        (conservativeView ? row.lineProfitReal : row.lineProfit100) >= 0
                          ? 'text-[#0F5E54]'
                          : 'text-[#B91C1C]'
                      }`}
                    >
                      {(conservativeView ? row.lineProfitReal : row.lineProfit100) >= 0 ? '+' : ''}₹
                      {(conservativeView ? row.lineProfitReal : row.lineProfit100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E2DC] text-[11px] font-semibold text-[#465853]">
                    <th className="py-2 px-2">Item / Category Mix</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Cost (₹)</th>
                    <th className="py-2 px-2">Sell (₹)</th>
                    <th className="py-2 px-2">Qty / Lots</th>
                    <th className="py-2 px-2">Sell-Through</th>
                    <th className="py-2 px-2 text-right">Total Cost</th>
                    <th className="py-2 px-2 text-right">{conservativeView ? 'Est. Rev' : 'Rev (100%)'}</th>
                    <th className="py-2 px-2 text-right">{conservativeView ? 'Est. Gross' : 'Gross (100%)'}</th>
                    <th className="py-2 px-2 text-right">ROI</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5ECE7] text-xs">
                  {stallTotals.itemRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.isSyncedBundle
                          ? 'bg-[#F4F8F6]'
                          : 'hover:bg-[#FAF8F3]'
                      }
                    >
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          aria-label={`Item name for ${row.name}`}
                          value={row.name}
                          disabled={row.isSyncedBundle}
                          onChange={(e) =>
                            onUpdateStockItem(row.id, 'name', e.target.value)
                          }
                          className="bg-transparent font-semibold text-[#13201E] focus:outline-none w-full min-w-[165px] disabled:text-[#0F5E54]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          aria-label={`Category for ${row.name}`}
                          value={row.category}
                          disabled={row.isSyncedBundle}
                          onChange={(e) =>
                            onUpdateStockItem(row.id, 'category', e.target.value)
                          }
                          className="bg-transparent text-[#465853] focus:outline-none w-24"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          aria-label={`Unit cost for ${row.name}`}
                          value={row.cost}
                          disabled={row.isSyncedBundle}
                          onChange={(e) =>
                            onUpdateStockItem(row.id, 'cost', e.target.value)
                          }
                          className="w-20 bg-white border border-[#D0DDD5] rounded-lg px-2 py-1 font-mono font-semibold text-[#13201E] tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          aria-label={`Selling price for ${row.name}`}
                          value={row.price}
                          disabled={row.isSyncedBundle}
                          onChange={(e) =>
                            onUpdateStockItem(row.id, 'price', e.target.value)
                          }
                          className="w-20 bg-white border border-[#D0DDD5] rounded-lg px-2 py-1 font-mono font-semibold text-[#0F5E54] tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          aria-label={`Quantity for ${row.name}`}
                          value={row.qty}
                          onChange={(e) =>
                            onUpdateStockItem(row.id, 'qty', e.target.value)
                          }
                          className="w-16 bg-white border border-[#D0DDD5] rounded-lg px-2 py-1 font-mono font-semibold text-[#13201E] tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="range"
                            aria-label={`Sell-through percentage for ${row.name}`}
                            min={40}
                            max={100}
                            step={5}
                            value={row.sellThrough}
                            onChange={(e) =>
                              onUpdateStockItem(
                                row.id,
                                'sellThrough',
                                e.target.value
                              )
                            }
                            className="w-16 h-1 bg-[#D9E2DC] rounded-lg accent-[#0F5E54] cursor-pointer"
                          />
                          <span className="font-mono text-[#465853] w-9 tabular-nums">
                            {row.sellThrough}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#465853] tabular-nums">
                        ₹{row.lineCost.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#13201E] tabular-nums">
                        ₹{(conservativeView ? row.lineRevReal : row.lineRev100).toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-mono font-bold tabular-nums ${
                          (conservativeView ? row.lineProfitReal : row.lineProfit100) >= 0
                            ? 'text-[#0F5E54]'
                            : 'text-[#B91C1C]'
                        }`}
                      >
                        {(conservativeView ? row.lineProfitReal : row.lineProfit100) >= 0 ? '+' : ''}₹
                        {(conservativeView ? row.lineProfitReal : row.lineProfit100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#0F5E54] tabular-nums">
                        {row.lineCost > 0
                          ? Number(
                              (
                                ((conservativeView ? row.lineProfitReal : row.lineProfit100) /
                                  row.lineCost) *
                                100
                              ).toFixed(1)
                            )
                          : 0}
                        %
                      </td>
                      <td className="py-2 px-2 text-right">
                        {!row.isSyncedBundle && (
                          <button
                            type="button"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => onRemoveStockItem(row.id)}
                            className="text-[#5B6D68] hover:text-[#B91C1C] p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
