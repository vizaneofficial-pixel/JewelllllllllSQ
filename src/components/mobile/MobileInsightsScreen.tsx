import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type { MarketResearchRecord } from '../../types/stall';
import { triggerHaptic } from '../../utils/experienceMode';
import { evaluateProductOpportunity } from '../../utils/opportunityEngine';
import { computeActualSalesSummary } from '../../utils/orderAndProjectEngine';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileInsightsScreenProps {
  workspace: StallWorkspaceController;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function MobileInsightsScreen({ workspace }: MobileInsightsScreenProps) {
  const {
    eventName,
    setEventName,
    eventLocation,
    setEventLocation,
    eventDate,
    setEventDate,
    expectedFootfall,
    setExpectedFootfall,
    stallFee,
    setStallFee,
    globalSellThrough,
    applyGlobalSellThrough,
    resolvedGroups,
    overviewTotals,
    stallTotals,
    actualSales,
    handleRecordActualSale,
    handleRemoveActualSale,
    addEventCost,
    updateEventCost,
    removeStockItem,
    aiAuditLoading,
    aiAuditReport,
    aiAuditError,
    runAiPlanReview,
    marketResearch,
    setMarketResearch,
    handleSendProductDraft,
    effectiveAccountContext,
    currentProjectName,
    showToast,
  } = workspace;

  const [subTab, setSubTab] = useState<'finances' | 'research'>('finances');

  // Actual Sale Sheet
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [saleProductKey, setSaleProductKey] = useState('');
  const [saleQty, setSaleQty] = useState('1');
  const [salePrice, setSalePrice] = useState('');

  // Event Expense Sheet
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  // Market Research State
  const [researchQuery, setResearchQuery] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Opportunity Draft Evaluator
  const [evalName, setEvalName] = useState('');
  const [evalCost, setEvalCost] = useState('');
  const [evalPrice, setEvalPrice] = useState('');
  const [evalAppeal, setEvalAppeal] = useState(8);

  const allProducts = useMemo(
    () =>
      resolvedGroups.flatMap(({ group }) =>
        group.categories.map((cat) => ({
          key: `${group.id}::${cat.id}`,
          groupId: group.id,
          categoryName: group.name,
          productId: cat.id,
          productName: cat.name,
          cost: cat.cost,
          price: cat.price,
        }))
      ),
    [resolvedGroups]
  );

  const actualSummary = useMemo(
    () =>
      computeActualSalesSummary(
        actualSales,
        resolvedGroups,
        stallTotals.revRealistic
      ),
    [actualSales, resolvedGroups, stallTotals.revRealistic]
  );

  const financeChartData = useMemo(
    () => [
      { name: 'Stock', amount: Math.round(stallTotals.totalCost), color: '#8B5CF6' },
      {
        name: 'Expenses',
        amount: Math.round(stallTotals.totalEventCosts),
        color: '#F59E0B',
      },
      {
        name: 'Revenue',
        amount: Math.round(stallTotals.revRealistic),
        color: '#34D399',
      },
      {
        name: 'Actual',
        amount: Math.round(actualSummary.actualRevenue),
        color: '#C4B5FD',
      },
    ],
    [stallTotals, actualSummary.actualRevenue]
  );

  const opportunityPreview = useMemo(() => {
    if (!evalName.trim()) return null;
    return evaluateProductOpportunity({
      item: {
        id: 'draft_eval',
        name: evalName.trim(),
        cost: Math.max(0, Number(evalCost) || 0),
        price: Math.max(0, Number(evalPrice) || 0),
        beauty: evalAppeal,
      },
      categoryName: resolvedGroups[0]?.group.name || 'Products',
      categoryBudget: overviewTotals.totalAllocatedBudget,
      researchRecords: marketResearch,
    });
  }, [
    evalName,
    evalCost,
    evalPrice,
    evalAppeal,
    resolvedGroups,
    overviewTotals.totalAllocatedBudget,
    marketResearch,
  ]);

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = allProducts.find((p) => p.key === saleProductKey) || allProducts[0];
    if (!chosen) return;
    const qty = Math.max(1, Math.round(Number(saleQty) || 1));
    const unitPrice = Math.max(
      0,
      Number(salePrice !== '' ? salePrice : chosen.price) || 0
    );
    handleRecordActualSale({
      groupId: chosen.groupId,
      categoryName: chosen.categoryName,
      productId: chosen.productId,
      productName: chosen.productName,
      qtySold: qty,
      actualPricePerUnit: unitPrice,
      unitCost: chosen.cost,
    });
    setSaleSheetOpen(false);
    setSaleQty('1');
    setSalePrice('');
    triggerHaptic(10);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = expenseName.trim();
    const amt = Math.max(0, Number(expenseAmt) || 0);
    if (!clean) return;
    addEventCost(clean, amt);
    setExpenseName('');
    setExpenseAmt('');
    setExpenseSheetOpen(false);
    showToast(`Added expense "${clean}"`);
  };

  const runMarketResearch = async (overrideQuery?: string, topicLabel?: string) => {
    const query = (overrideQuery ?? researchQuery).trim();
    if (!query || researchLoading) return;
    setResearchLoading(true);
    setResearchError(null);
    try {
      const res = await fetch('/api/ai/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          topic: topicLabel || 'Market Research',
          eventName: eventName || currentProjectName,
          eventLocation,
          categories: resolvedGroups.map((rg) => rg.group.name),
          budget: overviewTotals.totalAllocatedBudget,
          accountContext: effectiveAccountContext,
        }),
      });
      const data = await res.json();
      const candidate = (data?.record ?? data) as Partial<MarketResearchRecord> | null;
      if (
        !res.ok ||
        !candidate ||
        typeof candidate.id !== 'string' ||
        typeof candidate.summary !== 'string'
      ) {
        throw new Error(data?.error || 'Research request failed.');
      }
      const record = candidate as MarketResearchRecord;
      setMarketResearch((prev) => [record, ...prev].slice(0, 12));
      setSelectedRecordId(record.id);
      setResearchQuery('');
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : 'Unable to run market research.'
      );
    } finally {
      setResearchLoading(false);
    }
  };

  const activeResearch =
    marketResearch.find((r) => r.id === selectedRecordId) ||
    marketResearch[0] ||
    null;

  return (
    <div className="space-y-4 step-fade-in">
      {/* Sub-tab Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#13111C] border border-[#252136]">
        <button
          type="button"
          onClick={() => setSubTab('finances')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold ${
            subTab === 'finances' ? 'bg-[#8B5CF6] text-white' : 'text-[#9D95B8]'
          }`}
        >
          Finances & Sales
        </button>
        <button
          type="button"
          onClick={() => setSubTab('research')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold ${
            subTab === 'research' ? 'bg-[#8B5CF6] text-white' : 'text-[#9D95B8]'
          }`}
        >
          Market Research
        </button>
      </div>

      {subTab === 'finances' ? (
        <>
          {/* Headline Financial Summary */}
          <section className="rounded-3xl bg-gradient-to-br from-[#191529] to-[#12101B] border border-[#2D2744] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#9D95B8]">
                  Projected Net Profit
                </span>
                <div
                  className={`font-mono tabular-nums text-[28px] leading-tight font-bold mt-1 ${
                    stallTotals.netAfterStallReal >= 0
                      ? 'text-[#34D399]'
                      : 'text-[#FB7185]'
                  }`}
                >
                  {stallTotals.netAfterStallReal >= 0 ? '+' : ''}
                  {fmt(stallTotals.netAfterStallReal)}
                </div>
                <p className="text-xs text-[#A29BB8] mt-0.5 tabular-nums">
                  At {globalSellThrough}% sell-through · Break-even {stallTotals.unitsToBreakEven} pcs
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-[#34D399] shrink-0" />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#252136]">
              <div>
                <div className="text-[10px] text-[#9D95B8]">Total Outlay</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                  {fmt(stallTotals.totalOutlay)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#9D95B8]">Stock Cost</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#C4B5FD]">
                  {fmt(stallTotals.totalCost)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#9D95B8]">Event Costs</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#F59E0B]">
                  {fmt(stallTotals.totalEventCosts)}
                </div>
              </div>
            </div>
          </section>

          {/* Compact Visual Bar Chart */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Financial Picture
              </h2>
              <span className="font-mono tabular-nums text-xs text-[#9D95B8]">
                Margin {Math.round(stallTotals.blendedMarginPct)}%
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#9D95B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#8C84A6', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(val) => fmt(Number(val) || 0)}
                    contentStyle={{
                      backgroundColor: '#13111C',
                      border: '1px solid #322C47',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F5F3FA',
                    }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {financeChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sell-Through Slider */}
            <label className="block pt-2 border-t border-[#221E33] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A29BB8]">Expected Sell-Through</span>
                <span className="font-mono tabular-nums font-bold text-[#C4B5FD]">
                  {globalSellThrough}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={globalSellThrough}
                onChange={(e) => applyGlobalSellThrough(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </label>
          </section>

          {/* Expected vs Actual Sales (Strictly Separate) */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                  Actual Sales Tracker
                </h2>
                <p className="text-xs text-[#9D95B8]">
                  Recorded separately from projections
                </p>
              </div>
              <button
                type="button"
                disabled={allProducts.length === 0}
                onClick={() => {
                  if (allProducts[0]) {
                    setSaleProductKey(allProducts[0].key);
                    setSalePrice(
                      allProducts[0].price > 0 ? String(allProducts[0].price) : ''
                    );
                  }
                  setSaleSheetOpen(true);
                }}
                className="min-h-[38px] px-3 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Sale</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3">
                <div className="text-[10px] text-[#9D95B8]">Actual Revenue</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#F5F3FA]">
                  {fmt(actualSummary.actualRevenue)}
                </div>
                <div className="text-[11px] text-[#9D95B8] font-mono tabular-nums">
                  {actualSummary.totalPiecesSold} pcs sold
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3">
                <div className="text-[10px] text-[#9D95B8]">Actual Est. Profit</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#34D399]">
                  {actualSummary.actualEstimatedProfit >= 0 ? '+' : ''}
                  {fmt(actualSummary.actualEstimatedProfit)}
                </div>
                <div className="text-[11px] text-[#9D95B8] font-mono tabular-nums">
                  {actualSummary.remainingStockPieces} pcs left
                </div>
              </div>
            </div>

            {actualSales.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {actualSales.slice(0, 6).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#F5F3FA] truncate block">
                        {sale.qtySold}× {sale.productName}
                      </span>
                      <span className="text-[11px] text-[#9D95B8] font-mono tabular-nums">
                        {fmt(sale.actualPricePerUnit * sale.qtySold)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete sale ${sale.productName}`}
                      onClick={() => handleRemoveActualSale(sale.id)}
                      className="w-8 h-8 rounded-lg text-[#9D95B8] hover:text-[#FB7185] flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Event Details & Expenses */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Event Details & Costs
              </h2>
              <button
                type="button"
                onClick={() => setExpenseSheetOpen(true)}
                className="min-h-[36px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#C4B5FD] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Expense</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9D95B8]">Event Name</span>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Optional"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-xs text-[#F5F3FA]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9D95B8]">Location</span>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="City / Venue"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-xs text-[#F5F3FA]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9D95B8]">Event Date</span>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="e.g. 24 Oct"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-xs text-[#F5F3FA]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-[#9D95B8]">Expected Footfall</span>
                <input
                  type="number"
                  min={0}
                  value={expectedFootfall || ''}
                  onChange={(e) =>
                    setExpectedFootfall(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="Optional"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-xs text-[#F5F3FA]"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 pt-2 border-t border-[#221E33]">
              <span className="text-xs font-medium text-[#DDD7EE]">
                Stall Rent / Booking Fee (₹)
              </span>
              <input
                type="number"
                min={0}
                step={500}
                value={stallFee || ''}
                onChange={(e) =>
                  setStallFee(Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-32 min-h-[40px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-right text-[#F5F3FA]"
              />
            </label>

            {stallTotals.eventCostRows.length > 0 && (
              <div className="space-y-2 pt-1">
                {stallTotals.eventCostRows.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-2 rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2"
                  >
                    <input
                      type="text"
                      value={exp.name}
                      aria-label="Expense name"
                      onChange={(e) => updateEventCost(exp.id, 'name', e.target.value)}
                      className="flex-1 bg-transparent text-xs text-[#F5F3FA] min-w-0 focus:outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={exp.cost}
                      aria-label={`Amount for ${exp.name}`}
                      onChange={(e) => updateEventCost(exp.id, 'cost', e.target.value)}
                      className="w-20 bg-[#13111C] rounded-lg px-2 py-1 font-mono tabular-nums text-xs text-right text-[#F59E0B]"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${exp.name}`}
                      onClick={() => removeStockItem(exp.id)}
                      className="w-8 h-8 rounded-lg text-[#FB7185] flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI Plan Check */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
                <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                  AI Financial Check
                </h2>
              </div>
              <button
                type="button"
                disabled={aiAuditLoading}
                onClick={() => void runAiPlanReview()}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {aiAuditLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{aiAuditReport ? 'Re-check' : 'Run Check'}</span>
              </button>
            </div>
            {aiAuditError && (
              <p className="text-xs text-[#FB7185]">{aiAuditError}</p>
            )}
            {aiAuditReport && (
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3.5 text-xs text-[#DDD7EE] leading-relaxed whitespace-pre-wrap">
                {aiAuditReport}
              </div>
            )}
          </section>
        </>
      ) : (
        /* ==================== MARKET RESEARCH SUB-TAB ==================== */
        <div className="space-y-4">
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#C4B5FD]" />
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Live Web Market Research
              </h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runMarketResearch();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="e.g. Festive bangle prices at Mumbai pop-ups"
                aria-label="Market research query"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
              />
              <button
                type="submit"
                disabled={!researchQuery.trim() || researchLoading}
                aria-label="Run research"
                className="w-12 h-11 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                {researchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </form>

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {[
                `Trending ${resolvedGroups[0]?.group.name || 'exhibition stall'} products`,
                `Typical pricing for ${resolvedGroups[0]?.group.name || 'handcrafted'} stalls`,
                `Wholesale sourcing ideas for ${eventLocation || 'local exhibitions'}`,
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={researchLoading}
                  onClick={() => void runMarketResearch(q)}
                  className="shrink-0 min-h-[36px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-[11px] text-[#DDD7EE] whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>

            {researchError && (
              <p className="text-xs text-[#FB7185]">{researchError}</p>
            )}
          </section>

          {activeResearch && (
            <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                    {activeResearch.topic}
                  </h3>
                  <p className="text-[11px] text-[#9D95B8] truncate">
                    {activeResearch.query}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Delete research record"
                  onClick={() =>
                    setMarketResearch((prev) =>
                      prev.filter((r) => r.id !== activeResearch.id)
                    )
                  }
                  className="w-9 h-9 rounded-xl bg-[#1A1726] text-[#FB7185] flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-[#DDD7EE] leading-relaxed">
                {activeResearch.summary}
              </p>

              {activeResearch.verifiedFacts.length > 0 && (
                <ul className="space-y-1.5 text-xs text-[#C4B5FD]">
                  {activeResearch.verifiedFacts.slice(0, 4).map((fact, i) => (
                    <li key={i} className="leading-relaxed">
                      • {fact.claim}
                    </li>
                  ))}
                </ul>
              )}

              {activeResearch.verifiedFacts.length === 0 &&
                activeResearch.interpretation.length > 0 && (
                  <ul className="space-y-1.5 text-xs text-[#C4B5FD]">
                    {activeResearch.interpretation.slice(0, 4).map((note, i) => (
                      <li key={i} className="leading-relaxed">
                        • {note}
                      </li>
                    ))}
                  </ul>
                )}

              {activeResearch.sources.length > 0 && (
                <div className="pt-2 border-t border-[#221E33] space-y-1.5">
                  <div className="text-[11px] font-semibold text-[#9D95B8]">
                    Grounded Sources ({activeResearch.sources.length})
                  </div>
                  {activeResearch.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 text-xs text-[#C4B5FD]"
                    >
                      <span className="truncate">{src.title || src.uri}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Product Opportunity Evaluator & Send Draft to Inventory */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Evaluate & Stage Product Idea
            </h2>

            <div className="space-y-2.5">
              <input
                type="text"
                value={evalName}
                onChange={(e) => setEvalName(e.target.value)}
                placeholder="Product idea (e.g. Meenakari Jhumkas)"
                aria-label="Product idea name"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={evalCost}
                  onChange={(e) => setEvalCost(e.target.value)}
                  placeholder="Cost (₹)"
                  aria-label="Estimated wholesale cost"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
                />
                <input
                  type="number"
                  min={0}
                  value={evalPrice}
                  onChange={(e) => setEvalPrice(e.target.value)}
                  placeholder="Selling Price (₹)"
                  aria-label="Estimated selling price"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
                />
              </div>
            </div>

            {opportunityPreview && (
              <div className="rounded-2xl bg-[#0E0C15] border border-[#2D2744] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#C4B5FD]">
                    {opportunityPreview.ratingLabel}
                  </span>
                  <span className="font-mono tabular-nums text-[#34D399]">
                    Margin {Math.round(opportunityPreview.marginPct)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSendProductDraft({
                      id: `draft_${Date.now()}`,
                      name: evalName.trim(),
                      cost: Math.max(0, Number(evalCost) || 0),
                      price: Math.max(0, Number(evalPrice) || 0),
                      beauty: evalAppeal,
                      targetCategoryId: resolvedGroups[0]?.group.id,
                      targetCategoryName: resolvedGroups[0]?.group.name,
                      sourceQuery: 'Mobile Opportunity Check',
                    });
                    setEvalName('');
                    setEvalCost('');
                    setEvalPrice('');
                    setEvalAppeal(8);
                  }}
                  className="w-full min-h-[42px] rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
                >
                  Send Draft to Inventory
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Record Actual Sale Sheet */}
      <MobileBottomSheet
        isOpen={saleSheetOpen}
        onClose={() => setSaleSheetOpen(false)}
        title="Record Actual Sale"
        subtitle="Tracked separately from planned projections"
      >
        <form onSubmit={handleSaleSubmit} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Product</span>
            <select
              value={saleProductKey}
              onChange={(e) => {
                setSaleProductKey(e.target.value);
                const found = allProducts.find((p) => p.key === e.target.value);
                if (found) {
                  setSalePrice(found.price > 0 ? String(found.price) : '');
                }
              }}
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
            >
              {allProducts.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.categoryName} — {p.productName}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-[#A29BB8]">Qty Sold</span>
              <input
                type="number"
                min={1}
                value={saleQty}
                onChange={(e) => setSaleQty(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[#A29BB8]">Sale Price / pc (₹)</span>
              <input
                type="number"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-bold"
          >
            Save Actual Sale
          </button>
        </form>
      </MobileBottomSheet>

      {/* Add Event Expense Sheet */}
      <MobileBottomSheet
        isOpen={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        title="Add Event Expense"
        subtitle="Packaging, transport, lighting, table decor"
      >
        <form onSubmit={handleAddExpense} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Expense Name</span>
            <input
              type="text"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="e.g. Display Stands & Lighting"
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[#A29BB8]">Amount (₹)</span>
            <input
              type="number"
              min={0}
              value={expenseAmt}
              onChange={(e) => setExpenseAmt(e.target.value)}
              placeholder="e.g. 1200"
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
            />
          </label>
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-bold"
          >
            Add Expense
          </button>
        </form>
      </MobileBottomSheet>
    </div>
  );
}
