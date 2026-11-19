import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Mic,
  Plus,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import {
  computeEventReadiness,
  computePurchaseProgressSummary,
} from '../../utils/orderAndProjectEngine';
import { triggerHaptic } from '../../utils/experienceMode';
import { formatInr } from '../../utils/liveSellingEngine';
import type { MobileNavTab } from './MobileBottomNav';

interface MobileHomeScreenProps {
  workspace: StallWorkspaceController;
  onNavigate: (tab: MobileNavTab) => void;
  onOpenStockSubMode: (mode: 'inventory' | 'combinations' | 'saved') => void;
  onOpenAddProduct: () => void;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function MobileHomeScreen({
  workspace,
  onNavigate,
  onOpenStockSubMode,
  onOpenAddProduct,
}: MobileHomeScreenProps) {
  const {
    auth,
    eventName,
    eventLocation,
    eventDate,
    expectedFootfall,
    resolvedGroups,
    overviewTotals,
    stallTotals,
    purchaseProgress,
    orderPreparedAtMs,
    stallSetup,
    effectiveAccountContext,
    currentProjectName,
    totalProductsCount,
  } = workspace;

  const greetingName =
    effectiveAccountContext?.preferredName ||
    auth.user?.displayName?.split(' ')[0] ||
    '';

  const purchaseSummary = useMemo(
    () => computePurchaseProgressSummary(resolvedGroups, purchaseProgress),
    [resolvedGroups, purchaseProgress]
  );

  const readiness = useMemo(
    () =>
      computeEventReadiness({
        eventName: eventName || currentProjectName,
        eventLocation,
        resolvedGroups,
        totalBudget: overviewTotals.totalAllocatedBudget,
        purchaseSummary,
        orderPreparedAtMs,
        stallSetup,
      }),
    [
      eventName,
      currentProjectName,
      eventLocation,
      resolvedGroups,
      overviewTotals.totalAllocatedBudget,
      purchaseSummary,
      orderPreparedAtMs,
      stallSetup,
    ]
  );

  const categoryShares = useMemo(() => {
    const total = Math.max(1, stallTotals.totalCost);
    return resolvedGroups
      .map(({ group, activeCombo }) => {
        const cost = activeCombo?.cost || 0;
        const pieces = activeCombo?.pieces || 0;
        return {
          id: group.id,
          name: group.name,
          color: group.accentColor,
          cost,
          pieces,
          pct: Math.round((cost / total) * 100),
          productCount: group.categories.length,
        };
      })
      .sort((a, b) => b.cost - a.cost);
  }, [resolvedGroups, stallTotals.totalCost]);

  const hasPlanData = totalProductsCount > 0 || stallTotals.totalCost > 0;
  const expectedNetProfit = stallTotals.netAfterStallReal;

  return (
    <div className="space-y-4 step-fade-in">
      {/* Greeting & Active Event Context */}
      <section className="pt-1">
        <p className="text-xs font-medium text-[#A29BB8]">
          {greetingName ? `Welcome back, ${greetingName}` : 'Active stall workspace'}
        </p>
        <h1 className="font-display text-[22px] leading-tight font-bold text-[#F5F3FA] mt-0.5 truncate">
          {currentProjectName}
        </h1>
        {(eventName || eventLocation || eventDate) && (
          <p className="text-xs text-[#9D95B8] mt-1 truncate">
            {[
              eventName && eventName !== currentProjectName ? eventName : null,
              eventLocation || null,
              eventDate || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </section>

      {/* Primary Financial Overview Card */}
      <section className="rounded-3xl bg-gradient-to-br from-[#191529] via-[#14111F] to-[#110F1A] border border-[#2D2744] p-4 shadow-[0_14px_36px_-18px_rgba(0,0,0,0.85)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9D95B8]">
              Planned Stock Investment
            </span>
            <div className="font-mono tabular-nums text-[30px] leading-none font-bold text-[#F5F3FA] mt-1.5">
              {fmt(stallTotals.totalCost)}
            </div>
            <p className="text-xs text-[#A29BB8] mt-1.5 tabular-nums">
              {stallTotals.totalUnits} pcs across {resolvedGroups.length}{' '}
              {resolvedGroups.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onNavigate('insights');
            }}
            className="min-h-[40px] px-3 rounded-xl bg-[#201B33] border border-[#322C47] text-xs font-semibold text-[#C4B5FD] inline-flex items-center gap-1 whitespace-nowrap active:scale-95 transition-transform"
          >
            <span>Finances</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-[#252136]">
          <div className="rounded-2xl bg-[#0E0C15]/90 border border-[#221E33] px-3.5 py-2.5">
            <div className="text-[11px] text-[#9D95B8]">Expected Revenue</div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F5F3FA] mt-0.5">
              {fmt(stallTotals.revRealistic)}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0E0C15]/90 border border-[#221E33] px-3.5 py-2.5">
            <div className="text-[11px] text-[#9D95B8]">Expected Net Profit</div>
            <div
              className={`font-mono tabular-nums text-base font-bold mt-0.5 ${
                expectedNetProfit >= 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
              }`}
            >
              {expectedNetProfit >= 0 ? '+' : ''}
              {fmt(expectedNetProfit)}
            </div>
          </div>
        </div>

        {expectedFootfall > 0 && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#B6AFCC] px-1">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#A78BFA]" />
              Expected footfall
            </span>
            <span className="font-mono tabular-nums font-semibold text-[#F5F3FA]">
              {expectedFootfall.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </section>

      {/* 1-Tap Phone Live Selling Launch Card */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic(12);
          onNavigate('sell');
        }}
        className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-[#8B5CF6]/22 via-[#6D28D9]/18 to-[#13111C] border border-[#8B5CF6]/45 px-4 py-3 flex items-center justify-between gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(139,92,246,0.6)] shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-[#F5F3FA]">
              Open Live Selling
            </div>
            <div className="text-[11px] text-[#C4B5FD] truncate">
              {workspace.liveSelling.currentSessionReport.transactionCount > 0 ? (
                <span className="font-mono tabular-nums">
                  {formatInr(workspace.liveSelling.currentSessionReport.actualRevenue)} today ·{' '}
                  {workspace.liveSelling.currentSessionReport.totalUnitsSold} sold
                </span>
              ) : (
                '1-tap billing · Offline ready'
              )}
            </div>
          </div>
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#C4B5FD] shrink-0" />
      </button>

      {/* Quick Actions 2x2 Grid */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onOpenAddProduct();
          }}
          className="min-h-[68px] p-3.5 rounded-2xl bg-[#8B5CF6]/16 border border-[#8B5CF6]/40 text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-[#F5F3FA] mt-2">
            Add Products
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onNavigate('coach');
          }}
          className="min-h-[68px] p-3.5 rounded-2xl bg-[#161322] border border-[#2D2744] text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#C4B5FD] flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-[#F5F3FA] mt-2">
            Ask AI Coach
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            onOpenStockSubMode('combinations');
          }}
          className="min-h-[68px] p-3.5 rounded-2xl bg-[#161322] border border-[#252136] text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-[#1E1A2E] border border-[#322C47] text-[#A78BFA] flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-[#F5F3FA] mt-2">
            Stock Combinations
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            onNavigate('stall');
          }}
          className="min-h-[68px] p-3.5 rounded-2xl bg-[#161322] border border-[#252136] text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-[#1E1A2E] border border-[#322C47] text-[#34D399] flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-[#F5F3FA] mt-2">
            Stall Setup
          </span>
        </button>
      </section>

      {/* Stock Preparation Progress */}
      <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Preparation Progress
            </h2>
            <p className="text-xs text-[#9D95B8] mt-0.5 tabular-nums">
              {readiness.completedCount} of {readiness.totalCount} milestones ready
              {purchaseSummary.totalPlannedPieces > 0
                ? ` · ${purchaseSummary.receivedPieces}/${purchaseSummary.totalPlannedPieces} pcs received`
                : ''}
            </p>
          </div>
          <span className="font-mono tabular-nums text-lg font-bold text-[#C4B5FD]">
            {readiness.pct}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-[#1E1A2E] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#34D399] transition-all duration-300"
            style={{ width: `${Math.max(4, readiness.pct)}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
          {readiness.items.slice(0, 4).map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 text-[11px] ${
                item.done ? 'text-[#34D399]' : 'text-[#8C84A6]'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Category Investment Breakdown or Clean First-Product Prompt */}
      {hasPlanData ? (
        <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Category Breakdown
            </h2>
            <button
              type="button"
              onClick={() => onOpenStockSubMode('inventory')}
              className="text-xs font-semibold text-[#C4B5FD] min-h-[36px] px-2 flex items-center"
            >
              Manage Stock
            </button>
          </div>

          <div className="space-y-2.5">
            {categoryShares.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  workspace.setActiveGroupId(cat.id);
                  onOpenStockSubMode('inventory');
                }}
                className="w-full text-left space-y-1.5 py-1 active:opacity-80"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#F5F3FA] truncate">
                    {cat.name}
                  </span>
                  <span className="font-mono tabular-nums text-[#DDD7EE] shrink-0">
                    {fmt(cat.cost)} · {cat.pieces} pcs
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#1E1A2E] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(cat.cost > 0 ? 6 : 2, cat.pct)}%`,
                      backgroundColor: cat.color || '#8B5CF6',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl bg-[#13111C] border border-dashed border-[#322C47] p-5 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/18 border border-[#8B5CF6]/35 text-[#C4B5FD] flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Add your first products
            </h2>
            <p className="text-xs text-[#A29BB8] mt-1">
              Add items manually or speak them to AI Coach to build your real stock plan and supplier order.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="min-h-[44px] rounded-2xl bg-[#8B5CF6] text-white text-xs font-semibold"
            >
              Add Product
            </button>
            <button
              type="button"
              onClick={() => onNavigate('coach')}
              className="min-h-[44px] rounded-2xl bg-[#1A1726] border border-[#322C47] text-[#C4B5FD] text-xs font-semibold"
            >
              Speak to Coach
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
