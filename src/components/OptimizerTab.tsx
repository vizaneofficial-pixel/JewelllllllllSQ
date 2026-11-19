import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  GitCompareArrows,
  Layers,
  ListPlus,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_SUGGESTIONS, CATEGORY_TEMPLATES } from '../data/defaults';
import type {
  BangleCategory,
  BangleCombo,
  CategoryGroupResolved,
  OptimizationObjective,
  OptimizerRules,
  PriorityWeights,
  ProductDraft,
  PurchaseItemProgress,
  PurchaseStatus,
  SavedStockPlan,
  SearchMetadata,
} from '../types/stall';
import {
  getDefaultPriorityWeights,
  OPTIMIZATION_OBJECTIVES,
  resolveItemPriceBounds,
} from '../utils/optimizer';
import {
  beautyToFiveScale,
  computePurchaseProgressSummary,
  fiveScaleToBeauty,
  makePurchaseItemKey,
} from '../utils/orderAndProjectEngine';

export interface QuickProductInput {
  name: string;
  cost: number;
  price: number;
  plannedQty: number | null;
  appealStars: number;
}

interface OptimizerTabProps {
  projectName: string;
  eventName: string;
  resolvedGroups: CategoryGroupResolved[];
  activeGroupId: string;
  highlightedSection?: string | null;
  onSelectGroup: (groupId: string) => void;
  onCreateEmptyGroup: (customName: string) => void;
  onCreateGroupFromTemplate: (templateId: string, customName?: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, direction: -1 | 1) => void;
  onRemoveGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  categories: BangleCategory[];
  generatedCombos: BangleCombo[];
  activeCombo: BangleCombo | null;
  searchMeta?: SearchMetadata;
  objective: OptimizationObjective;
  onObjectiveChange: (objective: OptimizationObjective) => void;
  priorityWeights?: PriorityWeights;
  onPriorityWeightsChange: (weights: PriorityWeights | undefined) => void;
  savedComboIds: string[];
  onToggleSavedCombo: (comboId: string) => void;
  onDuplicateComboToCustom: (counts: number[]) => void;
  productDrafts: ProductDraft[];
  onAcceptProductDraft: (draft: ProductDraft) => void;
  onDismissProductDraft: (draftId: string) => void;
  rules: OptimizerRules;
  budgetCap: number;
  minProfitFloor: number;
  stallFee: number;
  maxPerCategory: number;
  conservativeSellThroughPct: number;
  copied: boolean;
  fullOrderCopied: boolean;
  savedPlans: SavedStockPlan[];
  purchaseProgress: Record<string, PurchaseItemProgress>;
  onUpdateCatFields: (id: string, patch: Partial<BangleCategory>) => void;
  onQuickAddProduct: (input: QuickProductInput) => void;
  onBulkAddProducts: (items: QuickProductInput[]) => void;
  onDuplicateCat: (id: string) => void;
  onRemoveCat: (id: string) => void;
  onToggleRule: (key: keyof OptimizerRules) => void;
  onBudgetCapChange: (val: number) => void;
  onMinProfitFloorChange: (val: number) => void;
  onMaxPerCategoryChange: (val: number) => void;
  onConservativeSellThroughChange: (pct: number) => void;
  onSelectCombo: (id: string) => void;
  onStepQty: (idx: number, delta: number) => void;
  onSetPlannedQty: (idx: number, qty: number | null) => void;
  onResetCustomQty: () => void;
  onCopyOrder: () => void;
  onCopyFullOrder: () => void;
  onSaveStockPlan: (name: string) => void;
  onLoadSavedStockPlan: (planId: string) => void;
  onDeleteSavedStockPlan: (planId: string) => void;
  onUpdatePurchaseProgress: (
    itemKey: string,
    patch: Partial<PurchaseItemProgress>
  ) => void;
  onOpenCoach: () => void;
  onOpenOverview: () => void;
  onRelaxConstraints: () => void;
}

type SortByKey = 'rank' | 'profit' | 'risk' | 'appeal' | 'cost' | 'pieces';

const QUICK_OBJECTIVES: Array<{ id: OptimizationObjective; label: string }> = [
  { id: 'best_overall', label: 'Best overall' },
  { id: 'highest_profit', label: 'Max profit' },
  { id: 'balanced_variety', label: 'More variety' },
  { id: 'lowest_risk', label: 'Lower risk' },
  { id: 'conservative_sales', label: 'Conservative' },
  { id: 'best_budget_use', label: 'Best budget fit' },
];

const PURCHASE_STATUS_OPTIONS: Array<{
  value: PurchaseStatus;
  label: string;
  style: string;
}> = [
  {
    value: 'not_ordered',
    label: 'Not ordered',
    style: 'bg-[#1A1726] text-[#A29BB8] border-[#2E2942]',
  },
  {
    value: 'ordered',
    label: 'Ordered',
    style: 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/40',
  },
  {
    value: 'received',
    label: 'Received',
    style: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/40',
  },
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function getInitials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function parseBulkLines(raw: string): QuickProductInput[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items: QuickProductInput[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t|]+/).map((p) => p.trim());
    const name = parts[0];
    if (!name) continue;
    const cost = Math.max(0, Number(parts[1]?.replace(/[₹,\s]/g, '')) || 0);
    const price = Math.max(0, Number(parts[2]?.replace(/[₹,\s]/g, '')) || 0);
    const qtyRaw = parts[3]?.replace(/[,\s]/g, '');
    const plannedQty =
      qtyRaw && Number.isFinite(Number(qtyRaw)) && Number(qtyRaw) > 0
        ? Math.round(Number(qtyRaw))
        : null;
    const starsRaw = Number(parts[4]);
    const appealStars =
      Number.isFinite(starsRaw) && starsRaw >= 1 && starsRaw <= 5
        ? Math.round(starsRaw)
        : 3;
    items.push({ name, cost, price, plannedQty, appealStars });
  }
  return items;
}

export function OptimizerTab({
  resolvedGroups,
  activeGroupId,
  highlightedSection,
  onSelectGroup,
  onCreateEmptyGroup,
  onCreateGroupFromTemplate,
  onDuplicateGroup,
  onMoveGroup,
  onRemoveGroup,
  onRenameGroup,
  categories,
  generatedCombos,
  activeCombo,
  searchMeta,
  objective,
  onObjectiveChange,
  priorityWeights,
  onPriorityWeightsChange,
  savedComboIds,
  onToggleSavedCombo,
  onDuplicateComboToCustom,
  productDrafts,
  onAcceptProductDraft,
  onDismissProductDraft,
  rules,
  budgetCap,
  minProfitFloor,
  maxPerCategory,
  conservativeSellThroughPct,
  copied,
  fullOrderCopied,
  savedPlans,
  purchaseProgress,
  onUpdateCatFields,
  onQuickAddProduct,
  onBulkAddProducts,
  onDuplicateCat,
  onRemoveCat,
  onToggleRule,
  onBudgetCapChange,
  onMinProfitFloorChange,
  onMaxPerCategoryChange,
  onConservativeSellThroughChange,
  onSelectCombo,
  onStepQty,
  onSetPlannedQty,
  onResetCustomQty,
  onCopyOrder,
  onCopyFullOrder,
  onSaveStockPlan,
  onLoadSavedStockPlan,
  onDeleteSavedStockPlan,
  onUpdatePurchaseProgress,
  onOpenCoach,
  onOpenOverview,
  onRelaxConstraints,
}: OptimizerTabProps) {
  // Category creation state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  // Fast manual product add form
  const [prodName, setProdName] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodQty, setProdQty] = useState('');
  const [prodStars, setProdStars] = useState(3);
  const [prodFormError, setProdFormError] = useState<string | null>(null);

  // Bulk add panel
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Product edit + optimizer UI state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showLimits, setShowLimits] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [expandedComboId, setExpandedComboId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(6);
  const [comboQuery, setComboQuery] = useState('');
  const [onlySavedCombos, setOnlySavedCombos] = useState(false);
  const [sortBy, setSortBy] = useState<SortByKey>('rank');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Collapsible Saved Stock Plans & Purchase Progress
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [planNameInput, setPlanNameInput] = useState('');
  const [showPurchaseChecklist, setShowPurchaseChecklist] = useState(false);

  const activeGroupIndex = useMemo(
    () => resolvedGroups.findIndex((rg) => rg.group.id === activeGroupId),
    [resolvedGroups, activeGroupId]
  );

  const activeResolved =
    (activeGroupIndex >= 0 ? resolvedGroups[activeGroupIndex] : resolvedGroups[0]) ||
    null;
  const activeGroup = activeResolved?.group || null;

  // Non-blocking project-wide summary strip
  const summaryStats = useMemo(() => {
    let totalProducts = 0;
    let totalPlannedCost = 0;
    let totalPlannedPieces = 0;
    resolvedGroups.forEach(({ group, activeCombo: combo }) => {
      totalProducts += group.categories.length;
      if (combo) {
        totalPlannedCost += combo.cost;
        totalPlannedPieces += combo.pieces;
      } else {
        group.categories.forEach((c) => {
          const q = typeof c.plannedQty === 'number' && c.plannedQty > 0 ? c.plannedQty : 0;
          totalPlannedCost += q * c.cost;
          totalPlannedPieces += q;
        });
      }
    });
    return {
      categoriesCount: resolvedGroups.length,
      productsCount: totalProducts,
      totalPlannedCost,
      totalPlannedPieces,
    };
  }, [resolvedGroups]);

  // Active category planned subtotal
  const activeCategorySubtotal = useMemo(() => {
    if (!activeGroup) return { cost: 0, pieces: 0 };
    if (activeCombo) return { cost: activeCombo.cost, pieces: activeCombo.pieces };
    return activeGroup.categories.reduce(
      (acc, c) => {
        const q = typeof c.plannedQty === 'number' && c.plannedQty > 0 ? c.plannedQty : 0;
        return { cost: acc.cost + q * c.cost, pieces: acc.pieces + q };
      },
      { cost: 0, pieces: 0 }
    );
  }, [activeGroup, activeCombo]);

  const effectiveWeights = useMemo(
    () => priorityWeights || getDefaultPriorityWeights(objective),
    [priorityWeights, objective]
  );

  const sortedCombos = useMemo(() => {
    const qLower = comboQuery.trim().toLowerCase();
    let list = [...generatedCombos];

    if (onlySavedCombos) {
      list = list.filter((c) => savedComboIds.includes(c.id));
    }

    if (qLower) {
      list = list.filter((c) => {
        const hay = [
          c.badge,
          c.reason,
          ...c.keywords,
          ...categories
            .filter((_, idx) => (c.counts[idx] || 0) > 0)
            .map((cat) => `${cat.name} ${cat.shortName}`),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(qLower);
      });
    }

    if (sortBy === 'profit') {
      list.sort((a, b) => b.prof90 - a.prof90 || b.prof100 - a.prof100);
    } else if (sortBy === 'risk') {
      list.sort(
        (a, b) =>
          a.breakEvenSellThroughPct - b.breakEvenSellThroughPct ||
          a.unsoldRiskCost - b.unsoldRiskCost
      );
    } else if (sortBy === 'appeal') {
      list.sort((a, b) => b.avgBeauty - a.avgBeauty || b.prof90 - a.prof90);
    } else if (sortBy === 'cost') {
      list.sort((a, b) => a.cost - b.cost || b.prof90 - a.prof90);
    } else if (sortBy === 'pieces') {
      list.sort((a, b) => b.pieces - a.pieces || b.prof90 - a.prof90);
    }
    return list;
  }, [generatedCombos, sortBy, comboQuery, onlySavedCombos, savedComboIds, categories]);

  const maxComboProfit = useMemo(
    () => Math.max(1, ...generatedCombos.map((c) => c.prof90)),
    [generatedCombos]
  );

  const visibleCombos = sortedCombos.slice(0, visibleLimit);

  const comparedCombos = useMemo(
    () =>
      compareIds
        .map((id) => generatedCombos.find((c) => c.id === id))
        .filter((c): c is BangleCombo => Boolean(c)),
    [compareIds, generatedCombos]
  );

  const purchaseSummary = useMemo(
    () => computePurchaseProgressSummary(resolvedGroups, purchaseProgress),
    [resolvedGroups, purchaseProgress]
  );

  const hasPricedProducts = useMemo(
    () => categories.some((c) => c.price > 0 && c.cost > 0),
    [categories]
  );

  const toggleCompare = (comboId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(comboId)) return prev.filter((id) => id !== comboId);
      if (prev.length >= 3) return [...prev.slice(1), comboId];
      return [...prev, comboId];
    });
  };

  const handleCompareTop = () => {
    const topIds = sortedCombos.slice(0, 3).map((c) => c.id);
    if (
      topIds.length >= 2 &&
      compareIds.length === topIds.length &&
      topIds.every((id) => compareIds.includes(id))
    ) {
      setCompareIds([]);
    } else {
      setCompareIds(topIds);
    }
  };

  const handleCreateCustomCategory = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    onCreateEmptyGroup(clean);
    setNewCategoryName('');
    setConfirmDeleteGroup(false);
  };

  const handleSubmitQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = prodName.trim();
    const costNum = Number(prodCost);
    if (!cleanName) {
      setProdFormError('Enter a product name.');
      return;
    }
    if (prodCost === '' || !Number.isFinite(costNum) || costNum < 0) {
      setProdFormError('Enter the purchase cost per piece (₹).');
      return;
    }
    const priceNum = prodPrice === '' ? 0 : Math.max(0, Number(prodPrice) || 0);
    const qtyNum =
      prodQty !== '' && Number.isFinite(Number(prodQty)) && Number(prodQty) > 0
        ? Math.round(Number(prodQty))
        : null;

    onQuickAddProduct({
      name: cleanName,
      cost: Math.round(costNum),
      price: Math.round(priceNum),
      plannedQty: qtyNum,
      appealStars: prodStars,
    });
    setProdName('');
    setProdCost('');
    setProdPrice('');
    setProdQty('');
    setProdStars(3);
    setProdFormError(null);
  };

  const handleSubmitBulkAdd = () => {
    const parsed = parseBulkLines(bulkText);
    if (parsed.length === 0) return;
    onBulkAddProducts(parsed);
    setBulkText('');
    setShowBulkAdd(false);
  };

  const handleSavePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = planNameInput.trim() || `Plan ${savedPlans.length + 1}`;
    onSaveStockPlan(label);
    setPlanNameInput('');
  };

  const budgetPulse = highlightedSection === 'budget' || highlightedSection === 'categories';
  const comboPulse = highlightedSection === 'combos';

  return (
    <div className="space-y-6">
      {/* 1. Product-First Intro Header + AI Coach Shortcut + Non-Blocking Summary Strip */}
      <section className="surface-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F5F3FA]">
              Categories &amp; Products
            </h1>
            <p className="text-xs sm:text-sm text-[#A29BB8] leading-relaxed">
              Let&apos;s build your stock. Add the products you plan to purchase or sell. You can do this manually or simply tell your AI Coach what you need.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCoach}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_10px_28px_-8px_rgba(139,92,246,0.6)] shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask AI Coach</span>
          </button>
        </div>

        {/* Subtle Non-Blocking Summary Strip */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="surface-inset rounded-xl px-3.5 py-2.5">
            <div className="text-[11px] text-[#A29BB8]">Categories created</div>
            <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-[#F5F3FA] mt-0.5">
              {summaryStats.categoriesCount}
            </div>
          </div>
          <div className="surface-inset rounded-xl px-3.5 py-2.5">
            <div className="text-[11px] text-[#A29BB8]">Products added</div>
            <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-[#C4B5FD] mt-0.5">
              {summaryStats.productsCount}
            </div>
          </div>
          <div className="surface-inset rounded-xl px-3.5 py-2.5">
            <div className="text-[11px] text-[#A29BB8]">Total planned stock cost</div>
            <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-[#34D399] mt-0.5">
              {fmt(summaryStats.totalPlannedCost)}
            </div>
          </div>
        </div>
      </section>

      {/* Staged Research Drafts Banner (explicit user approval required) */}
      {productDrafts.length > 0 && (
        <section className="surface-card rounded-2xl p-4 border-[#8B5CF6]/55 bg-gradient-to-r from-[#1D1633] to-[#13111C] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C4B5FD]">
              <Sparkles className="w-4 h-4 text-[#A78BFA]" />
              <span>Product drafts from Market Research ({productDrafts.length})</span>
            </div>
            <span className="text-[11px] text-[#A29BB8]">
              Review before adding to active inventory
            </span>
          </div>
          <div className="space-y-2">
            {productDrafts.map((draft) => (
              <div
                key={draft.id}
                className="surface-inset rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[#F5F3FA]">
                    {draft.name}
                    {draft.targetCategoryName && (
                      <span className="ml-2 text-[11px] font-normal text-[#A29BB8]">
                        → {draft.targetCategoryName}
                      </span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-[11px] text-[#A29BB8]">
                    Buy {fmt(draft.cost)} · Sell {fmt(draft.price)} · Appeal{' '}
                    {beautyToFiveScale(draft.beauty)}/5 ★
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAcceptProductDraft(draft)}
                    className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
                  >
                    Add to inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissProductDraft(draft.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1A1726] border border-[#2E2942] text-xs text-[#A29BB8] hover:text-[#F5F3FA]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Category Management Section */}
      <section
        data-ai-section="categories"
        className={`surface-card rounded-2xl p-4 sm:p-5 space-y-4 ${
          budgetPulse ? 'ai-highlight-pulse' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#A78BFA]" />
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Your Categories
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="text-[11px] font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
          >
            {showTemplates ? 'Hide sample templates' : 'Need inspiration? Sample templates'}
          </button>
        </div>

        {/* Create Custom Category Form + Suggestion Chips (Never Forced) */}
        <div className="space-y-2.5">
          <form
            onSubmit={handleCreateCustomCategory}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Create a category (e.g., Bangles, Earrings, Candles, Kurtis)"
              aria-label="New category name"
              className="flex-1 min-w-[200px] surface-inset rounded-xl px-3.5 py-2.5 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
            />
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-40 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add category</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#78718E]">Quick suggestions:</span>
            {CATEGORY_SUGGESTIONS.map((label) => {
              const alreadyAdded = resolvedGroups.some(
                (rg) => rg.group.name.trim().toLowerCase() === label.toLowerCase()
              );
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onCreateEmptyGroup(label)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                    alreadyAdded
                      ? 'bg-[#1A1726]/60 border-[#252136] text-[#78718E] hover:text-[#C4B5FD]'
                      : 'bg-[#1A1726] hover:bg-[#8B5CF6]/20 border-[#2E2942] hover:border-[#8B5CF6]/45 text-[#C4B5FD]'
                  }`}
                >
                  + {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Sample Templates Drawer */}
        {showTemplates && (
          <div className="surface-inset rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#A29BB8]">
              <span>Optional starting templates (you can edit or delete any item)</span>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                aria-label="Close templates"
                className="text-[#A29BB8] hover:text-[#F5F3FA]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onCreateGroupFromTemplate(tpl.id, newCategoryName.trim() || undefined);
                    setNewCategoryName('');
                    setShowTemplates(false);
                  }}
                  className="text-left p-2.5 rounded-xl bg-[#13111C] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/50 transition-colors"
                >
                  <div className="text-xs font-semibold text-[#F5F3FA]">{tpl.name}</div>
                  <div className="text-[11px] font-mono tabular-nums text-[#A29BB8] mt-0.5">
                    {tpl.items.length} sample items
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Category Tabs Row */}
        {resolvedGroups.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
            {resolvedGroups.map(({ group, activeCombo: grpCombo }) => {
              const isSelected = group.id === activeGroup?.id;
              const grpCost = grpCombo
                ? grpCombo.cost
                : group.categories.reduce(
                    (s, c) => s + (c.plannedQty || 0) * c.cost,
                    0
                  );
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    onSelectGroup(group.id);
                    setCompareIds([]);
                    setEditingCatId(null);
                    setConfirmDeleteGroup(false);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all shrink-0 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#8B5CF6]/25 to-[#6D28D9]/15 border-[#8B5CF6]/60 text-[#F5F3FA] shadow-[0_0_20px_-6px_rgba(139,92,246,0.5)]'
                      : 'bg-[#0E0C15] hover:bg-[#1A1726] border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.accentColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate max-w-[140px] text-[#F5F3FA]">
                      {group.name}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
                      {group.categories.length} items · {fmt(grpCost)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Category Rename / Reorder / Budget / Delete Strip */}
        {activeGroup && (
          <div
            data-ai-section="budget"
            className="surface-inset rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] text-[#A29BB8] mb-1">
                Active category name
              </label>
              <input
                type="text"
                value={activeGroup.name}
                onChange={(e) => onRenameGroup(activeGroup.id, e.target.value)}
                aria-label="Category name"
                className="w-full bg-[#13111C] border border-[#252136] rounded-xl px-3 py-2 text-xs font-semibold text-[#F5F3FA] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] text-[#A29BB8] mb-1">
                Optional budget cap (₹)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={budgetCap || ''}
                placeholder="Not set"
                onChange={(e) =>
                  onBudgetCapChange(Math.max(0, Number(e.target.value) || 0))
                }
                aria-label="Category stock budget"
                className="w-full bg-[#13111C] border border-[#252136] rounded-xl px-3 py-2 text-xs font-mono tabular-nums font-semibold text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="md:col-span-5 flex flex-wrap items-center justify-end gap-1.5">
              {resolvedGroups.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={activeGroupIndex <= 0}
                    onClick={() => onMoveGroup(activeGroup.id, -1)}
                    aria-label="Move category left"
                    title="Move left"
                    className="p-2 rounded-xl bg-[#13111C] hover:bg-[#1A1726] disabled:opacity-35 border border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activeGroupIndex >= resolvedGroups.length - 1}
                    onClick={() => onMoveGroup(activeGroup.id, 1)}
                    aria-label="Move category right"
                    title="Move right"
                    className="p-2 rounded-xl bg-[#13111C] hover:bg-[#1A1726] disabled:opacity-35 border border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onDuplicateGroup(activeGroup.id)}
                title="Duplicate category"
                className="px-2.5 py-2 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#A29BB8] hover:text-[#F5F3FA]"
              >
                Duplicate
              </button>
              {confirmDeleteGroup ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveGroup(activeGroup.id);
                      setConfirmDeleteGroup(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FB7185] text-[#0B0A10] text-[11px] font-bold"
                  >
                    Delete?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteGroup(false)}
                    className="px-2 py-1.5 rounded-lg bg-[#1A1726] text-[11px] text-[#A29BB8]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGroup(true)}
                  aria-label="Delete category"
                  className="p-2 rounded-xl bg-[#13111C] hover:bg-[#FB7185]/15 border border-[#252136] hover:border-[#FB7185]/40 text-[#A29BB8] hover:text-[#FB7185]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. PRODUCT-FIRST ENTRY & CATALOGUE (Inside Active Category) */}
      {activeGroup ? (
        <section className="space-y-4">
          {/* Fast Inline Add Product Card */}
          <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-[#F5F3FA]">
                  Add a product to {activeGroup.name}
                </h2>
                <p className="text-[11px] text-[#A29BB8] mt-0.5">
                  Only product name and purchase cost are required. You can add selling price and quantity now or later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAdd((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#231F33] border border-[#2E2942] text-xs font-semibold text-[#C4B5FD]"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>{showBulkAdd ? 'Single entry' : 'Bulk add'}</span>
              </button>
            </div>

            {!showBulkAdd ? (
              <form onSubmit={handleSubmitQuickProduct} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                  <label className="lg:col-span-4 block">
                    <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                      Product name *
                    </span>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => {
                        setProdName(e.target.value);
                        setProdFormError(null);
                      }}
                      placeholder="e.g., Oxidised Mirror Bangles"
                      className="w-full surface-inset rounded-xl px-3 py-2.5 text-xs text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </label>

                  <label className="lg:col-span-3 block">
                    <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                      Purchase cost / pc (₹) *
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={prodCost}
                      onChange={(e) => {
                        setProdCost(e.target.value);
                        setProdFormError(null);
                      }}
                      placeholder="e.g., 45"
                      className="w-full surface-inset rounded-xl px-3 py-2.5 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </label>

                  <label className="lg:col-span-3 block">
                    <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                      Expected selling price (₹, optional)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="Optional"
                      className="w-full surface-inset rounded-xl px-3 py-2.5 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </label>

                  <label className="lg:col-span-2 block">
                    <span className="block text-[11px] font-medium text-[#A29BB8] mb-1">
                      Qty planned (opt.)
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={prodQty}
                      onChange={(e) => setProdQty(e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full surface-inset rounded-xl px-3 py-2.5 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </label>
                </div>

                {/* 1–5 Visual Appeal Rating + Submit */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#F5F3FA]">
                        Visual appeal
                      </span>
                      <div className="flex items-center gap-1" role="radiogroup" aria-label="Visual appeal rating out of 5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setProdStars(star)}
                            aria-label={`Rate appeal ${star} out of 5`}
                            aria-checked={prodStars === star}
                            role="radio"
                            className="p-0.5 rounded hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                star <= prodStars
                                  ? 'text-[#FBBF24] fill-[#FBBF24]'
                                  : 'text-[#3A3357]'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] font-mono text-[#FBBF24] font-semibold">
                        {prodStars}/5
                      </span>
                    </div>
                    <p className="text-[11px] text-[#78718E]">
                      How attractive do you think this product will look to customers?
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_8px_22px_-6px_rgba(139,92,246,0.55)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add product</span>
                  </button>
                </div>

                {prodFormError && (
                  <p className="text-xs text-[#FB7185]">{prodFormError}</p>
                )}
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[#A29BB8]">
                  Enter one product per line:{' '}
                  <span className="font-mono text-[#C4B5FD]">
                    Name, Purchase Cost, Selling Price (optional), Qty (optional), Appeal 1-5 (optional)
                  </span>
                </p>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Oxidised Bangles, 45, 120, 20, 4\nSilk Thread Bangles, 60, 150, 15, 5\nKundan Kada, 120, 299, 10, 5`}
                  className="w-full surface-inset rounded-xl p-3 text-xs font-mono text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(false)}
                    className="px-3 py-2 rounded-xl bg-[#1A1726] text-xs text-[#A29BB8] hover:text-[#F5F3FA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!bulkText.trim()}
                    onClick={handleSubmitBulkAdd}
                    className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    Add all lines
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Product List + Category Subtotal + Supplier Order Copy Actions */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  {activeGroup.name} Products ({categories.length})
                </h2>
                <span className="font-mono tabular-nums text-xs text-[#A29BB8]">
                  {activeCategorySubtotal.pieces} pcs · {fmt(activeCategorySubtotal.cost)} wholesale
                </span>
                {activeCombo?.isCustom && (
                  <span className="px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 text-[11px] font-semibold text-[#C4B5FD]">
                    Custom quantities
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeCombo?.isCustom && (
                  <button
                    type="button"
                    onClick={onResetCustomQty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#A29BB8] hover:text-[#F5F3FA]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset qty</span>
                  </button>
                )}
                {categories.length > 0 && (
                  <button
                    type="button"
                    onClick={onCopyOrder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#F5F3FA]"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#34D399]" />
                        <span className="text-[#34D399]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
                        <span>Copy Category Order</span>
                      </>
                    )}
                  </button>
                )}
                {summaryStats.productsCount > 0 && (
                  <button
                    type="button"
                    onClick={onCopyFullOrder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/40 text-xs font-semibold text-[#C4B5FD]"
                  >
                    {fullOrderCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#34D399]" />
                        <span className="text-[#34D399]">Full Order Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
                        <span>Copy Full Order</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="surface-card rounded-2xl p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-[#F5F3FA]">
                  No products in {activeGroup.name} yet
                </p>
                <p className="text-xs text-[#A29BB8]">
                  Use the form above or tell your AI Coach — for example: &ldquo;Add 20 oxidised bangles at ₹45 each, appeal 4/5&rdquo;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {categories.map((cat, idx) => {
                  const qty = activeCombo?.counts[idx] ?? (cat.plannedQty || 0);
                  const bounds = resolveItemPriceBounds(cat);
                  const hasSellPrice = cat.price > 0;
                  const profitPerPiece = hasSellPrice
                    ? Math.round(bounds.target - cat.cost)
                    : null;
                  const stars = beautyToFiveScale(cat.beauty);
                  const isEditing = editingCatId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`surface-card rounded-2xl p-4 space-y-3.5 transition-all ${
                        isEditing ? 'border-[#8B5CF6]/60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="w-11 h-11 rounded-xl object-cover border border-[#2E2942] shrink-0"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-xs text-white shrink-0 border border-white/10"
                            style={{
                              background: `linear-gradient(135deg, ${cat.barColor}55, #1A1726)`,
                            }}
                          >
                            {getInitials(cat.name)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#F5F3FA] truncate">
                                {cat.name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      onUpdateCatFields(cat.id, {
                                        beauty: fiveScaleToBeauty(s),
                                      })
                                    }
                                    aria-label={`Set ${cat.name} appeal to ${s} of 5`}
                                    className="p-0"
                                  >
                                    <Star
                                      className={`w-3 h-3 ${
                                        s <= stars
                                          ? 'text-[#FBBF24] fill-[#FBBF24]'
                                          : 'text-[#342E4B]'
                                      }`}
                                    />
                                  </button>
                                ))}
                                <span className="text-[10px] font-mono text-[#A29BB8] ml-1">
                                  {stars}/5
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCatId(isEditing ? null : cat.id)
                              }
                              aria-label={`Edit ${cat.name}`}
                              className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                                isEditing
                                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#C4B5FD]'
                                  : 'bg-[#1A1726] border-[#2E2942] text-[#A29BB8] hover:text-[#F5F3FA]'
                              }`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Buy / Sell / Profit */}
                      <div className="grid grid-cols-3 gap-2 surface-inset rounded-xl p-2.5 font-mono tabular-nums text-xs">
                        <div>
                          <div className="text-[10px] font-sans text-[#A29BB8]">Buy</div>
                          <div className="font-semibold text-[#F5F3FA]">
                            {fmt(cat.cost)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-sans text-[#A29BB8]">Sell</div>
                          <div className="font-semibold text-[#C4B5FD]">
                            {hasSellPrice ? fmt(cat.price) : 'Not set'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-sans text-[#A29BB8]">Profit/pc</div>
                          <div
                            className={`font-bold ${
                              profitPerPiece === null
                                ? 'text-[#78718E]'
                                : profitPerPiece >= 0
                                ? 'text-[#34D399]'
                                : 'text-[#FB7185]'
                            }`}
                          >
                            {profitPerPiece === null
                              ? '—'
                              : profitPerPiece >= 0
                              ? `+₹${profitPerPiece}`
                              : `-₹${Math.abs(profitPerPiece)}`}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Stepper + Line Subtotal */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="text-xs font-mono tabular-nums text-[#A29BB8]">
                          Subtotal{' '}
                          <span className="text-[#F5F3FA] font-semibold">
                            {fmt(qty * cat.cost)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStepQty(idx, -1)}
                            aria-label={`Decrease ${cat.name} quantity`}
                            className="w-7 h-7 rounded-lg bg-[#1A1726] hover:bg-[#252038] border border-[#2E2942] flex items-center justify-center text-[#F5F3FA]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                              onSetPlannedQty(idx, v);
                            }}
                            aria-label={`${cat.name} planned quantity`}
                            className="w-11 text-center bg-[#0E0C15] border border-[#252136] rounded-lg py-1 font-mono tabular-nums text-xs font-bold text-[#F5F3FA]"
                          />
                          <button
                            type="button"
                            onClick={() => onStepQty(idx, 1)}
                            aria-label={`Increase ${cat.name} quantity`}
                            className="w-7 h-7 rounded-lg bg-[#1A1726] hover:bg-[#252038] border border-[#2E2942] flex items-center justify-center text-[#F5F3FA]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Quick Editor */}
                      {isEditing && (
                        <div className="pt-3 border-t border-[#252136] space-y-2.5 text-xs">
                          <input
                            type="text"
                            value={cat.name}
                            onChange={(e) =>
                              onUpdateCatFields(cat.id, {
                                name: e.target.value,
                                shortName:
                                  e.target.value
                                    .split(/[\s/]+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join(' ') || e.target.value,
                              })
                            }
                            aria-label="Edit product name"
                            className="w-full surface-inset rounded-xl px-3 py-1.5 text-[#F5F3FA]"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <label>
                              <span className="block text-[10px] text-[#A29BB8] mb-0.5">
                                Buy (₹)
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={cat.cost}
                                onChange={(e) =>
                                  onUpdateCatFields(cat.id, {
                                    cost: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full surface-inset rounded-lg px-2 py-1 font-mono tabular-nums text-[#F5F3FA]"
                              />
                            </label>
                            <label>
                              <span className="block text-[10px] text-[#A29BB8] mb-0.5">
                                Sell (₹, 0 = not set)
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={cat.price}
                                onChange={(e) =>
                                  onUpdateCatFields(cat.id, {
                                    price: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full surface-inset rounded-lg px-2 py-1 font-mono tabular-nums text-[#F5F3FA]"
                              />
                            </label>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onDuplicateCat(cat.id)}
                                className="text-[11px] font-semibold text-[#C4B5FD] hover:text-white"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveCat(cat.id);
                                  setEditingCatId(null);
                                }}
                                className="text-[11px] font-semibold text-[#FB7185] hover:text-[#FDA4AF]"
                              >
                                Remove
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="px-2.5 py-1 rounded-lg bg-[#8B5CF6] text-white text-[11px] font-semibold"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. STOCK COMBINATION EXPLORER (Below Products, Ready When Budget & Selling Prices Set) */}
          {categories.length > 0 && (
            <section
              data-ai-section="combos"
              className={`space-y-4 pt-2 ${comboPulse ? 'ai-highlight-pulse rounded-2xl' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                    Smart Stock Combinations
                  </h2>
                  <p className="text-[11px] text-[#A29BB8]">
                    Automatically test hundreds of quantity mixes within your category budget.
                  </p>
                </div>
                {budgetCap > 0 && hasPricedProducts && (
                  <button
                    type="button"
                    onClick={() => setShowLimits((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      showLimits
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#C4B5FD]'
                        : 'bg-[#13111C] hover:bg-[#1A1726] border-[#252136] text-[#F5F3FA]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Rules &amp; sell-through ({conservativeSellThroughPct}%)</span>
                  </button>
                )}
              </div>

              {budgetCap <= 0 || !hasPricedProducts ? (
                <div className="surface-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[#A29BB8] max-w-xl">
                    {!hasPricedProducts
                      ? 'Add expected selling prices to your products and set a category budget cap to explore optimized stock combinations.'
                      : 'Set a category budget cap (e.g., ₹5,000) to automatically generate the best stock combinations for your products.'}
                  </div>
                  {hasPricedProducts && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onBudgetCapChange(5000)}
                        className="px-3 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] text-xs font-mono font-semibold text-[#C4B5FD]"
                      >
                        Try ₹5,000 budget
                      </button>
                      <button
                        type="button"
                        onClick={() => onBudgetCapChange(10000)}
                        className="px-3 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] text-xs font-mono font-semibold text-[#C4B5FD]"
                      >
                        Try ₹10,000
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {showLimits && (
                    <div className="surface-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                      <label className="block">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-[#A29BB8]">Sell-through</span>
                          <span className="font-mono font-bold text-[#C4B5FD]">
                            {conservativeSellThroughPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={100}
                          step={5}
                          value={conservativeSellThroughPct}
                          onChange={(e) =>
                            onConservativeSellThroughChange(Number(e.target.value))
                          }
                          className="w-full accent-[#8B5CF6] cursor-pointer"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-[#A29BB8] mb-1">
                          Min profit target (₹)
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={minProfitFloor}
                          onChange={(e) =>
                            onMinProfitFloorChange(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-full surface-inset rounded-xl px-3 py-2 font-mono tabular-nums text-[#F5F3FA]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-[#A29BB8] mb-1">
                          Max pieces / product
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={maxPerCategory}
                          onChange={(e) =>
                            onMaxPerCategoryChange(
                              Math.min(60, Math.max(1, Number(e.target.value) || 1))
                            )
                          }
                          className="w-full surface-inset rounded-xl px-3 py-2 font-mono tabular-nums text-[#F5F3FA]"
                        />
                      </label>
                      <div className="space-y-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-[#F5F3FA]">
                          <input
                            type="checkbox"
                            checked={rules.allAtLeastOne}
                            onChange={() => onToggleRule('allAtLeastOne')}
                            className="accent-[#8B5CF6] rounded"
                          />
                          <span>Include every product</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[#F5F3FA]">
                          <input
                            type="checkbox"
                            checked={rules.evenDistribution}
                            onChange={() => onToggleRule('evenDistribution')}
                            className="accent-[#8B5CF6] rounded"
                          />
                          <span>Spread evenly</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Goal Selector + Sort + Compare Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {QUICK_OBJECTIVES.map((q) => {
                        const active = objective === q.id;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => onObjectiveChange(q.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                              active
                                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-[0_6px_18px_-4px_rgba(139,92,246,0.55)]'
                                : 'bg-[#13111C] hover:bg-[#1A1726] text-[#A29BB8] hover:text-[#F5F3FA] border-[#252136]'
                            }`}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                      <select
                        value={objective}
                        onChange={(e) =>
                          onObjectiveChange(e.target.value as OptimizationObjective)
                        }
                        aria-label="More optimization goals"
                        className="bg-[#13111C] border border-[#252136] rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#C4B5FD]"
                      >
                        {OPTIMIZATION_OBJECTIVES.map((obj) => (
                          <option key={obj.id} value={obj.id}>
                            {obj.shortLabel}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowWeights((v) => !v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          showWeights || priorityWeights
                            ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/55 text-[#C4B5FD]'
                            : 'bg-[#13111C] hover:bg-[#1A1726] border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Priorities</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {searchMeta && (
                        <span className="text-[11px] font-mono tabular-nums text-[#78718E]">
                          {searchMeta.statesEvaluated.toLocaleString('en-IN')} checked
                        </span>
                      )}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#78718E] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={comboQuery}
                          onChange={(e) => setComboQuery(e.target.value)}
                          placeholder="Filter mixes..."
                          aria-label="Filter combinations"
                          className="w-32 sm:w-36 bg-[#13111C] border border-[#252136] rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-[#F5F3FA] placeholder-[#78718E]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnlySavedCombos((v) => !v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          onlySavedCombos
                            ? 'bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#FBBF24]'
                            : 'bg-[#13111C] hover:bg-[#1A1726] border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${onlySavedCombos ? 'fill-[#FBBF24]' : ''}`} />
                        <span>Saved{savedComboIds.length > 0 ? ` (${savedComboIds.length})` : ''}</span>
                      </button>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortByKey)}
                        aria-label="Sort combinations"
                        className="bg-[#13111C] border border-[#252136] rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#F5F3FA]"
                      >
                        <option value="rank">Goal rank</option>
                        <option value="profit">Profit</option>
                        <option value="risk">Lowest risk</option>
                        <option value="appeal">Appeal</option>
                        <option value="cost">Lowest cost</option>
                        <option value="pieces">Pieces</option>
                      </select>
                      {sortedCombos.length >= 2 && (
                        <button
                          type="button"
                          onClick={handleCompareTop}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                            comparedCombos.length >= 2
                              ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#C4B5FD]'
                              : 'bg-[#13111C] hover:bg-[#1A1726] border-[#252136] text-[#F5F3FA]'
                          }`}
                        >
                          <GitCompareArrows className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span>{comparedCombos.length >= 2 ? 'Clear' : 'Compare'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {showWeights && (
                    <div className="surface-card rounded-2xl p-4 space-y-3 border-[#8B5CF6]/35">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F5F3FA]">
                          What matters most to you?
                        </span>
                        {priorityWeights && (
                          <button
                            type="button"
                            onClick={() => onPriorityWeightsChange(undefined)}
                            className="text-[11px] font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
                          >
                            Reset to goal preset
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                        {(
                          [
                            { key: 'profit', label: 'Profit' },
                            { key: 'variety', label: 'Product variety' },
                            { key: 'appeal', label: 'Customer appeal' },
                            { key: 'budgetUsage', label: 'Budget usage' },
                            { key: 'lowRisk', label: 'Lower unsold risk' },
                          ] as const
                        ).map(({ key, label }) => (
                          <label key={key} className="surface-inset rounded-xl p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#A29BB8]">{label}</span>
                              <span className="font-mono font-bold text-[#C4B5FD]">
                                {effectiveWeights[key]}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={effectiveWeights[key]}
                              onChange={(e) =>
                                onPriorityWeightsChange({
                                  ...effectiveWeights,
                                  [key]: Number(e.target.value),
                                })
                              }
                              aria-label={`${label} importance`}
                              className="w-full accent-[#8B5CF6] cursor-pointer"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedCombos.length === 0 ? (
                    <div className="surface-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 border-[#F59E0B]/40">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-[#FBBF24] shrink-0" />
                        <div className="text-xs text-[#F5F3FA] font-medium">
                          No combination fits this budget &amp; rules yet. Increase the budget cap or relax rules.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onRelaxConstraints}
                        className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0A10] text-xs font-bold"
                      >
                        Relax limits
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {visibleCombos.map((combo, idx) => {
                          const isSelected = activeCombo?.id === combo.id;
                          const isCompared = compareIds.includes(combo.id);
                          const isBreakdownOpen = expandedComboId === combo.id;
                          const remaining = budgetCap - combo.cost;
                          const distinctCount =
                            combo.distinctItemsCount ??
                            combo.counts.filter((q) => q > 0).length;

                          const profitBarPct = Math.min(
                            100,
                            Math.max(12, Math.round((combo.prof90 / maxComboProfit) * 100))
                          );
                          const varietyBarPct = Math.min(
                            100,
                            Math.max(
                              15,
                              Math.round(
                                (distinctCount / Math.max(1, categories.length)) * 100
                              )
                            )
                          );

                          return (
                            <div
                              key={combo.id}
                              className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all border ${
                                isSelected
                                  ? 'bg-gradient-to-b from-[#1E1833] to-[#13111C] violet-glow-selected'
                                  : 'surface-card hover:border-[#3A3357]'
                              }`}
                            >
                              <div className="space-y-3.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-mono font-bold text-[#A78BFA]">
                                        #{idx + 1}
                                      </span>
                                      <span className="text-xs font-semibold text-[#C4B5FD]">
                                        {combo.badge}
                                      </span>
                                    </div>
                                    <div className="font-display text-2xl font-bold font-mono tabular-nums text-[#34D399] mt-1">
                                      +{fmt(combo.prof90)}
                                    </div>
                                    <div className="text-[11px] text-[#A29BB8]">
                                      Expected profit · {combo.sellThroughPct}% sold
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => onToggleSavedCombo(combo.id)}
                                      aria-label="Save mix"
                                      className={`p-1.5 rounded-lg border transition-colors ${
                                        savedComboIds.includes(combo.id)
                                          ? 'bg-[#F59E0B]/15 border-[#F59E0B]/45 text-[#FBBF24]'
                                          : 'bg-[#1A1726] border-[#2E2942] text-[#78718E] hover:text-[#FBBF24]'
                                      }`}
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${
                                          savedComboIds.includes(combo.id)
                                            ? 'fill-[#FBBF24]'
                                            : ''
                                        }`}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleCompare(combo.id)}
                                      className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                                        isCompared
                                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                          : 'bg-[#1A1726] text-[#A29BB8] border-[#2E2942] hover:text-[#F5F3FA]'
                                      }`}
                                    >
                                      {isCompared ? 'Compared' : 'Compare'}
                                    </button>
                                  </div>
                                </div>

                                {combo.reason && (
                                  <p className="text-[11px] text-[#C4B5FD]/90 leading-snug">
                                    {combo.reason}
                                  </p>
                                )}

                                <div className="grid grid-cols-3 gap-2 surface-inset rounded-xl p-2.5 font-mono tabular-nums text-xs">
                                  <div>
                                    <div className="text-[10px] font-sans text-[#A29BB8]">Cost</div>
                                    <div className="font-semibold text-[#F5F3FA]">
                                      {fmt(combo.cost)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-sans text-[#A29BB8]">Sales</div>
                                    <div className="font-semibold text-[#C4B5FD]">
                                      {fmt(combo.rev90)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-sans text-[#A29BB8]">Left</div>
                                    <div className="font-semibold text-[#34D399]">
                                      {fmt(Math.max(0, remaining))}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5 text-[11px]">
                                  <div className="grid grid-cols-12 items-center gap-2">
                                    <span className="col-span-4 text-[#A29BB8]">Profit</span>
                                    <div className="col-span-6 h-1.5 rounded-full bg-[#1D192C] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[#34D399]"
                                        style={{ width: `${profitBarPct}%` }}
                                      />
                                    </div>
                                    <span className="col-span-2 text-right font-mono tabular-nums text-[#F5F3FA]">
                                      {combo.marginPct}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-12 items-center gap-2">
                                    <span className="col-span-4 text-[#A29BB8]">Variety</span>
                                    <div className="col-span-6 h-1.5 rounded-full bg-[#1D192C] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[#8B5CF6]"
                                        style={{ width: `${varietyBarPct}%` }}
                                      />
                                    </div>
                                    <span className="col-span-2 text-right font-mono tabular-nums text-[#F5F3FA]">
                                      {distinctCount}/{categories.length}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-[#A29BB8] pt-1 border-t border-[#252136]/80">
                                  <span className="font-mono tabular-nums">
                                    {combo.pieces} pcs · {beautyToFiveScale(combo.avgBeauty)}/5 ★
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedComboId(isBreakdownOpen ? null : combo.id)
                                    }
                                    className="inline-flex items-center gap-1 text-[#C4B5FD] hover:text-white font-medium"
                                  >
                                    <span>Items</span>
                                    {isBreakdownOpen ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                {isBreakdownOpen && (
                                  <div className="surface-inset rounded-xl p-2.5 space-y-1.5 text-xs">
                                    {categories.map((cat, cIdx) => {
                                      const qty = combo.counts[cIdx] || 0;
                                      if (qty <= 0) return null;
                                      return (
                                        <div
                                          key={cat.id}
                                          className="flex items-center justify-between gap-2"
                                        >
                                          <span className="text-[#F5F3FA] truncate">
                                            {cat.shortName || cat.name}
                                          </span>
                                          <span className="font-mono tabular-nums text-[#C4B5FD] shrink-0">
                                            {qty}× · {fmt(qty * cat.cost)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectCombo(combo.id)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white'
                                      : 'bg-[#1A1726] hover:bg-[#8B5CF6] text-[#F5F3FA] border border-[#2E2942] hover:border-[#8B5CF6]'
                                  }`}
                                >
                                  {isSelected ? 'Selected mix' : 'Select'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDuplicateComboToCustom(combo.counts)}
                                  className="px-3 py-2 rounded-xl bg-[#1A1726] hover:bg-[#231F33] border border-[#2E2942] text-xs font-semibold text-[#C4B5FD] hover:text-white"
                                >
                                  Edit copy
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {sortedCombos.length > 6 && (
                        <div className="flex justify-center gap-2">
                          {visibleLimit < sortedCombos.length && (
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleLimit((prev) =>
                                  Math.min(sortedCombos.length, prev + 6)
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#C4B5FD]"
                            >
                              <span>
                                Load more ({sortedCombos.length - visibleLimit} remaining)
                              </span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {visibleLimit > 6 && (
                            <button
                              type="button"
                              onClick={() => setVisibleLimit(6)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-xs text-[#A29BB8]"
                            >
                              <span>Show less</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {comparedCombos.length >= 2 && (
                        <div className="surface-card rounded-2xl p-5 space-y-4 border-[#8B5CF6]/40">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GitCompareArrows className="w-4 h-4 text-[#A78BFA]" />
                              <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                                Combination Comparison
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCompareIds([])}
                              className="text-xs text-[#A29BB8] hover:text-[#F5F3FA]"
                            >
                              Close
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {comparedCombos.map((c) => {
                              const maxScale = Math.max(
                                1,
                                ...comparedCombos.map((x) =>
                                  Math.max(x.cost, x.prof90, x.rev90)
                                )
                              );
                              return (
                                <div key={c.id} className="surface-inset rounded-xl p-3.5 space-y-2.5 text-[11px] font-mono tabular-nums">
                                  <div className="flex items-center justify-between text-xs font-sans">
                                    <span className="font-bold text-[#F5F3FA]">{c.badge}</span>
                                    <span className="font-mono text-[#A29BB8]">{c.pieces} pcs</span>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[#A29BB8]">
                                      <span>Cost</span>
                                      <span className="text-[#F5F3FA]">{fmt(c.cost)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden mt-0.5">
                                      <div
                                        className="h-full rounded-full bg-[#8B5CF6]"
                                        style={{ width: `${Math.round((c.cost / maxScale) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[#A29BB8]">
                                      <span>Expected profit</span>
                                      <span className="text-[#34D399]">+{fmt(c.prof90)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden mt-0.5">
                                      <div
                                        className="h-full rounded-full bg-[#34D399]"
                                        style={{
                                          width: `${Math.round((Math.max(0, c.prof90) / maxScale) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </section>
      ) : (
        <section className="surface-card rounded-2xl p-6 sm:p-8 text-center space-y-3 border-dashed border-[#342E4B]">
          <Layers className="w-7 h-7 text-[#A78BFA] mx-auto" />
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-[#F5F3FA]">
              Create your first product category above
            </h2>
            <p className="text-xs text-[#A29BB8] max-w-md mx-auto">
              Type any category name (like Bangles, Earrings, Candles, Clothing), tap a quick suggestion, or ask your AI Coach to create categories and add products for you.
            </p>
          </div>
        </section>
      )}

      {/* 5. Collapsible Saved Stock Plans & Purchase Progress Checklist */}
      {resolvedGroups.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Saved Stock Plans */}
          <div className="surface-card rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSavedPlans((v) => !v)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 text-[#A78BFA]" />
                <span className="font-display text-sm font-bold text-[#F5F3FA]">
                  Saved Stock Plans ({savedPlans.length})
                </span>
              </div>
              {showSavedPlans ? (
                <ChevronUp className="w-4 h-4 text-[#A29BB8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#A29BB8]" />
              )}
            </button>
            {showSavedPlans && (
              <div className="px-5 pb-4 pt-2 border-t border-[#252136] space-y-3">
                <form onSubmit={handleSavePlanSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={planNameInput}
                    onChange={(e) => setPlanNameInput(e.target.value)}
                    placeholder="Plan name (e.g., Festive Option A)"
                    className="flex-1 surface-inset rounded-xl px-3 py-2 text-xs text-[#F5F3FA] placeholder-[#78718E]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold"
                  >
                    Save current
                  </button>
                </form>
                {savedPlans.length === 0 ? (
                  <p className="text-xs text-[#78718E]">
                    Save snapshots of your stock plan to compare alternatives later.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {savedPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="surface-inset rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#F5F3FA] truncate">
                            {plan.name}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
                            {plan.overallPieces} pcs · {fmt(plan.overallWholesaleTotal)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLoadSavedStockPlan(plan.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#C4B5FD] text-[11px] font-semibold"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedStockPlan(plan.id)}
                            aria-label={`Delete ${plan.name}`}
                            className="p-1 text-[#78718E] hover:text-[#FB7185]"
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

          {/* Purchase Progress Checklist */}
          <div className="surface-card rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPurchaseChecklist((v) => !v)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
                <span className="font-display text-sm font-bold text-[#F5F3FA]">
                  Purchase Progress
                </span>
                <span className="text-xs font-mono tabular-nums text-[#A29BB8]">
                  {purchaseSummary.receivedPieces}/{purchaseSummary.totalPlannedPieces} pcs received
                </span>
              </div>
              {showPurchaseChecklist ? (
                <ChevronUp className="w-4 h-4 text-[#A29BB8]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#A29BB8]" />
              )}
            </button>
            {showPurchaseChecklist && (
              <div className="px-5 pb-4 pt-2 border-t border-[#252136] space-y-2 max-h-64 overflow-y-auto">
                {resolvedGroups.every((rg) => rg.group.categories.length === 0) ? (
                  <p className="text-xs text-[#78718E]">
                    Add products to track supplier orders and delivery status.
                  </p>
                ) : (
                  resolvedGroups.map(({ group, activeCombo: combo }) =>
                    group.categories.map((cat, idx) => {
                      const qty = combo?.counts[idx] ?? (cat.plannedQty || 0);
                      const key = makePurchaseItemKey(group.id, cat.id);
                      const entry = purchaseProgress[key];
                      const currentStatus: PurchaseStatus =
                        entry?.status || 'not_ordered';
                      return (
                        <div
                          key={key}
                          className="surface-inset rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#F5F3FA] truncate">
                              {cat.name}
                            </div>
                            <div className="text-[10px] font-mono text-[#A29BB8]">
                              {group.name} · {qty} pcs · {fmt(qty * cat.cost)}
                            </div>
                          </div>
                          <select
                            value={currentStatus}
                            onChange={(e) => {
                              const nextStatus = e.target.value as PurchaseStatus;
                              onUpdatePurchaseProgress(key, {
                                status: nextStatus,
                                checked: nextStatus === 'received',
                                receivedQty: nextStatus === 'received' ? qty : 0,
                              });
                            }}
                            aria-label={`Purchase status for ${cat.name}`}
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold border ${
                              PURCHASE_STATUS_OPTIONS.find(
                                (o) => o.value === currentStatus
                              )?.style || ''
                            }`}
                          >
                            {PURCHASE_STATUS_OPTIONS.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-[#13111C] text-[#F5F3FA]"
                              >
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. Prominent Always-Accessible Continue to Overview CTA */}
      <section className="surface-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[#8B5CF6]/40 bg-gradient-to-r from-[#171327] via-[#13111C] to-[#13111C]">
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-[#F5F3FA]">
            Ready to review your full financial dashboard?
          </div>
          <p className="text-xs text-[#A29BB8]">
            You can always return here to add more products or adjust quantities.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenOverview}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-sm font-semibold shadow-[0_12px_32px_-8px_rgba(139,92,246,0.65)] shrink-0"
        >
          <span>Continue to Overview</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
