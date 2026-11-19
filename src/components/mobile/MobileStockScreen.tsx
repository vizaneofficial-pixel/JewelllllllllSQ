import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Download,
  Layers,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type { QuickProductInput } from '../OptimizerTab';
import { CATEGORY_TEMPLATES } from '../../data/defaults';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type {
  BangleCategory,
  BangleCombo,
  OptimizationObjective,
  PriorityWeights,
  PurchaseStatus,
} from '../../types/stall';
import { triggerHaptic } from '../../utils/experienceMode';
import {
  getDefaultPriorityWeights,
  OPTIMIZATION_OBJECTIVES,
} from '../../utils/optimizer';
import {
  beautyToFiveScale,
  buildSupplierOrderCsv,
  computePurchaseProgressSummary,
  copyTextReliable,
  detectSavedPlanOutdatedPrices,
  fiveScaleToBeauty,
  formatCategoryPurchaseOrder,
} from '../../utils/orderAndProjectEngine';
import { MobileBottomSheet } from './MobileBottomSheet';

export type MobileStockSubMode = 'inventory' | 'combinations' | 'saved';

interface MobileStockScreenProps {
  workspace: StallWorkspaceController;
  subMode: MobileStockSubMode;
  onSubModeChange: (mode: MobileStockSubMode) => void;
  openAddTrigger: number;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function parseBulkLines(raw: string): QuickProductInput[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: QuickProductInput[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t|]/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const name = parts[0];
    const cost = Math.max(0, Number(parts[1]) || 0);
    const price = parts[2] ? Math.max(0, Number(parts[2]) || 0) : 0;
    const qty =
      parts[3] !== undefined && parts[3] !== ''
        ? Math.max(0, Math.round(Number(parts[3]) || 0))
        : null;
    const stars = parts[4]
      ? Math.min(5, Math.max(1, Math.round(Number(parts[4]) || 4)))
      : 4;
    if (name && cost >= 0) {
      out.push({ name, cost, price, plannedQty: qty, appealStars: stars });
    }
  }
  return out;
}

export function MobileStockScreen({
  workspace,
  subMode,
  onSubModeChange,
  openAddTrigger,
}: MobileStockScreenProps) {
  const {
    resolvedGroups,
    activeGroup,
    activeResolved,
    activeCombo,
    generatedCombos,
    savedPlans,
    purchaseProgress,
    productDrafts,
    copied,
    fullOrderCopied,
    currentProjectName,
    eventName,
    setActiveGroupId,
    updateActiveGroup,
    createEmptyCategoryGroup,
    createGroupFromTemplate,
    duplicateCategoryGroup,
    moveCategoryGroup,
    removeCategoryGroup,
    renameCategoryGroup,
    setActiveObjective,
    setActivePriorityWeights,
    toggleSavedCombo,
    duplicateComboToCustom,
    updateCatFields,
    quickAddProduct,
    bulkAddProducts,
    duplicateCat,
    removeCat,
    relaxConstraints,
    stepQty,
    copyOrder,
    copyFullOrder,
    handleSaveStockPlan,
    handleLoadSavedStockPlan,
    handleDeleteSavedStockPlan,
    handleUpdatePurchaseProgress,
    handleAcceptProductDraft,
    handleDismissProductDraft,
    showToast,
  } = workspace;

  // Sheets
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [productSheetMode, setProductSheetMode] = useState<'single' | 'bulk'>('single');
  const [editingProduct, setEditingProduct] = useState<BangleCategory | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [weightsSheetOpen, setWeightsSheetOpen] = useState(false);
  const [detailCombo, setDetailCombo] = useState<BangleCombo | null>(null);
  const [compareComboIds, setCompareComboIds] = useState<string[]>([]);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);

  // Single product form
  const [pName, setPName] = useState('');
  const [pCost, setPCost] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pQty, setPQty] = useState('');
  const [pStars, setPStars] = useState(4);
  const [pNotes, setPNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk form
  const [bulkText, setBulkText] = useState('');

  // Category creation / rename
  const [newCatName, setNewCatName] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupDraft, setRenameGroupDraft] = useState('');

  // Save plan input
  const [savePlanName, setSavePlanName] = useState('');

  const lastTriggerRef = React.useRef(openAddTrigger);
  useEffect(() => {
    if (openAddTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = openAddTrigger;
      openNewProductSheet();
    }
  }, [openAddTrigger]);

  const openNewProductSheet = () => {
    setEditingProduct(null);
    setProductSheetMode('single');
    setPName('');
    setPCost('');
    setPPrice('');
    setPQty('');
    setPStars(4);
    setPNotes('');
    setFormError(null);
    setProductSheetOpen(true);
  };

  const openEditProductSheet = (item: BangleCategory) => {
    setEditingProduct(item);
    setProductSheetMode('single');
    setPName(item.name);
    setPCost(String(item.cost));
    setPPrice(item.price > 0 ? String(item.price) : '');
    setPQty(typeof item.plannedQty === 'number' ? String(item.plannedQty) : '');
    setPStars(beautyToFiveScale(item.beauty));
    setPNotes(item.notes || '');
    setFormError(null);
    setProductSheetOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) {
      createEmptyCategoryGroup('Products');
      setFormError('Created "Products" category — tap Save Product again.');
      return;
    }

    if (productSheetMode === 'bulk') {
      const parsed = parseBulkLines(bulkText);
      if (parsed.length === 0) {
        setFormError('Enter one product per line: Name, Cost, Selling Price, Qty');
        return;
      }
      bulkAddProducts(parsed);
      setBulkText('');
      setProductSheetOpen(false);
      triggerHaptic(12);
      return;
    }

    const cleanName = pName.trim();
    if (!cleanName) {
      setFormError('Product name is required.');
      return;
    }
    const costNum = Number(pCost);
    if (!Number.isFinite(costNum) || costNum < 0 || pCost.trim() === '') {
      setFormError('Enter a valid wholesale purchase cost.');
      return;
    }
    const priceNum = pPrice.trim() === '' ? 0 : Math.max(0, Number(pPrice) || 0);
    const qtyNum =
      pQty.trim() === '' ? null : Math.max(0, Math.round(Number(pQty) || 0));

    if (editingProduct) {
      updateCatFields(editingProduct.id, {
        name: cleanName,
        shortName:
          cleanName.split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') || cleanName,
        cost: Math.round(costNum),
        price: Math.round(priceNum),
        beauty: fiveScaleToBeauty(pStars),
        ...(qtyNum !== null ? { plannedQty: qtyNum } : {}),
        notes: pNotes.trim() || undefined,
      });
      if (qtyNum !== null) {
        const idx = activeGroup.categories.findIndex((c) => c.id === editingProduct.id);
        if (idx >= 0) {
          workspace.setPlannedQty(idx, qtyNum);
        }
      }
      showToast(`Updated "${cleanName}"`);
    } else {
      quickAddProduct({
        name: cleanName,
        cost: Math.round(costNum),
        price: Math.round(priceNum),
        plannedQty: qtyNum,
        appealStars: pStars,
      });
      showToast(`Added "${cleanName}"`);
    }

    triggerHaptic(12);
    setProductSheetOpen(false);
  };

  const handleDownloadCsv = () => {
    const csv = buildSupplierOrderCsv(resolvedGroups);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentProjectName || 'stalliq')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-supplier-order.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded wholesale supplier CSV');
  };

  const handleCopyComboOrder = async (combo: BangleCombo) => {
    if (!activeGroup) return;
    const text = formatCategoryPurchaseOrder(
      {
        group: activeGroup,
        combos: generatedCombos,
        activeCombo: combo,
      },
      { projectName: currentProjectName, eventName }
    );
    const ok = await copyTextReliable(text);
    if (ok) {
      triggerHaptic(10);
      showToast('Copied wholesale supplier order');
    }
  };

  const toggleCompareCombo = (comboId: string) => {
    setCompareComboIds((prev) => {
      if (prev.includes(comboId)) return prev.filter((id) => id !== comboId);
      return [...prev.slice(-2), comboId];
    });
  };

  const purchaseSummary = useMemo(
    () => computePurchaseProgressSummary(resolvedGroups, purchaseProgress),
    [resolvedGroups, purchaseProgress]
  );

  const activeWeights: PriorityWeights = useMemo(
    () =>
      activeGroup?.priorityWeights ||
      getDefaultPriorityWeights(activeGroup?.objective || 'best_overall'),
    [activeGroup]
  );

  const categories = activeGroup?.categories || [];
  const activeCounts = activeCombo
    ? activeCombo.counts
    : categories.map((c) => c.plannedQty || 0);

  const categoryPurchaseTotal = categories.reduce(
    (sum, cat, idx) => sum + cat.cost * (activeCounts[idx] || 0),
    0
  );
  const categoryPiecesTotal = activeCounts.reduce((s, n) => s + (n || 0), 0);

  const comparedCombos = generatedCombos.filter((c) => compareComboIds.includes(c.id));

  return (
    <div className="space-y-4 step-fade-in">
      {/* Sub-mode Segmented Switcher */}
      <div
        role="tablist"
        aria-label="Stock sections"
        className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#13111C] border border-[#252136]"
      >
        {(
          [
            { id: 'inventory', label: 'Inventory' },
            { id: 'combinations', label: 'Combinations' },
            { id: 'saved', label: 'Saved & Orders' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subMode === tab.id}
            onClick={() => {
              triggerHaptic(6);
              onSubModeChange(tab.id);
            }}
            className={`min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              subMode === tab.id
                ? 'bg-[#8B5CF6] text-white shadow-sm'
                : 'text-[#9D95B8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Horizontal Strip */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {resolvedGroups.map(({ group, activeCombo: c }) => {
            const isSelected = group.id === activeGroup?.id;
            const totalCost = c?.cost || 0;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setActiveGroupId(group.id);
                }}
                className={`shrink-0 min-h-[44px] px-3.5 py-2 rounded-2xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-[#1D1833] border-[#8B5CF6] text-[#F5F3FA]'
                    : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.accentColor }}
                  />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {group.name}
                  </span>
                </div>
                <div className="font-mono tabular-nums text-[10px] text-[#9D95B8] mt-0.5 whitespace-nowrap">
                  {group.categories.length} items · {fmt(totalCost)}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCategorySheetOpen(true)}
          aria-label="Manage categories"
          className="shrink-0 w-11 h-11 rounded-2xl bg-[#161322] border border-[#2D2744] text-[#C4B5FD] flex items-center justify-center active:scale-95 transition-transform"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Research Drafts Staging Banner */}
      {productDrafts.length > 0 && (
        <div className="rounded-2xl bg-[#1A1530] border border-[#8B5CF6]/45 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#C4B5FD]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Staged Product Drafts ({productDrafts.length})</span>
          </div>
          {productDrafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-xl bg-[#0E0C15] border border-[#252136] p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#F5F3FA] truncate">
                  {draft.name}
                </div>
                <div className="text-[11px] text-[#9D95B8] font-mono tabular-nums">
                  Cost {fmt(draft.cost)} · Sell {fmt(draft.price)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAcceptProductDraft(draft)}
                  className="min-h-[36px] px-3 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissProductDraft(draft.id)}
                  className="min-h-[36px] px-2.5 rounded-xl bg-[#1A1726] text-[#9D95B8] text-xs"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== INVENTORY SUB-MODE ==================== */}
      {subMode === 'inventory' && (
        <div className="space-y-3.5">
          {!activeGroup ? (
            <div className="rounded-3xl bg-[#13111C] border border-dashed border-[#322C47] p-6 text-center space-y-3">
              <p className="font-display text-sm font-bold text-[#F5F3FA]">
                Create your first product category
              </p>
              <p className="text-xs text-[#A29BB8]">
                Organise products by category such as Bangles, Earrings, Candles, or Apparel.
              </p>
              <button
                type="button"
                onClick={() => setCategorySheetOpen(true)}
                className="min-h-[44px] px-5 rounded-2xl bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Create Category
              </button>
            </div>
          ) : (
            <>
              {/* Active Category Summary + Wholesale Export Actions */}
              <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-[#9D95B8]">
                      {activeGroup.name} Purchase Total
                    </div>
                    <div className="font-mono tabular-nums text-2xl font-bold text-[#F5F3FA] mt-0.5">
                      {fmt(categoryPurchaseTotal)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <div className="text-[11px] text-[#9D95B8]">Planned Qty</div>
                      <div className="font-mono tabular-nums text-sm font-bold text-[#C4B5FD]">
                        {categoryPiecesTotal} pcs
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        openNewProductSheet();
                      }}
                      aria-label="Add product"
                      className="min-h-[42px] px-3.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-transform shadow-[0_6px_18px_-4px_rgba(139,92,246,0.6)]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Quick Budget Input */}
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#252136]">
                  <label className="text-xs text-[#A29BB8]" htmlFor="mob-cat-budget">
                    Category Budget (₹)
                  </label>
                  <input
                    id="mob-cat-budget"
                    type="number"
                    min={0}
                    step={500}
                    value={activeGroup.budgetCap || ''}
                    placeholder="Optional cap"
                    onChange={(e) =>
                      updateActiveGroup((g) => ({
                        ...g,
                        budgetCap: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-36 min-h-[40px] px-3 rounded-xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-right text-[#F5F3FA]"
                  />
                </div>

                {/* Wholesale-Only Supplier Order Actions */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      void copyOrder();
                    }}
                    disabled={categoryPiecesTotal === 0}
                    className="min-h-[42px] px-2.5 rounded-xl bg-[#1A1726] border border-[#2D2744] text-[11px] font-semibold text-[#DDD7EE] inline-flex items-center justify-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#34D399]" />
                    ) : (
                      <ClipboardCopy className="w-3.5 h-3.5 text-[#C4B5FD]" />
                    )}
                    <span>{copied ? 'Copied' : 'Cat Order'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      void copyFullOrder();
                    }}
                    disabled={resolvedGroups.every((rg) => !rg.activeCombo?.pieces)}
                    className="min-h-[42px] px-2.5 rounded-xl bg-[#1A1726] border border-[#2D2744] text-[11px] font-semibold text-[#DDD7EE] inline-flex items-center justify-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                  >
                    {fullOrderCopied ? (
                      <Check className="w-3.5 h-3.5 text-[#34D399]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#C4B5FD]" />
                    )}
                    <span>{fullOrderCopied ? 'Copied' : 'Full Order'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={resolvedGroups.every((rg) => !rg.activeCombo?.pieces)}
                    className="min-h-[42px] px-2.5 rounded-xl bg-[#1A1726] border border-[#2D2744] text-[11px] font-semibold text-[#DDD7EE] inline-flex items-center justify-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C4B5FD]" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Product Cards List */}
              {categories.length === 0 ? (
                <div className="rounded-3xl bg-[#13111C] border border-dashed border-[#322C47] p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-[#F5F3FA]">
                    No products in {activeGroup.name} yet
                  </p>
                  <p className="text-xs text-[#9D95B8]">
                    Add products with wholesale cost, optional selling price, and appeal stars.
                  </p>
                  <button
                    type="button"
                    onClick={openNewProductSheet}
                    className="min-h-[44px] px-5 rounded-2xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pb-6">
                  {categories.map((cat, idx) => {
                    const qty = activeCounts[idx] || 0;
                    const subtotal = qty * cat.cost;
                    const stars = beautyToFiveScale(cat.beauty);
                    const margin =
                      cat.price > 0 ? cat.price - cat.cost : null;

                    return (
                      <article
                        key={cat.id}
                        className="rounded-2xl bg-[#13111C] border border-[#252136] p-3.5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-display text-sm font-bold text-[#F5F3FA] truncate">
                              {cat.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9D95B8] font-mono tabular-nums mt-0.5">
                              <span className="whitespace-nowrap">Cost {fmt(cat.cost)}</span>
                              {cat.price > 0 && (
                                <span className="whitespace-nowrap">· Sell {fmt(cat.price)}</span>
                              )}
                              {margin !== null && (
                                <span className="whitespace-nowrap text-[#34D399]">
                                  · +{fmt(margin)}/pc
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Edit ${cat.name}`}
                              onClick={() => openEditProductSheet(cat)}
                              className="w-9 h-9 rounded-xl bg-[#1A1726] border border-[#252136] text-[#A29BB8] flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Duplicate ${cat.name}`}
                              onClick={() => {
                                duplicateCat(cat.id);
                                showToast(`Duplicated "${cat.name}"`);
                              }}
                              className="w-9 h-9 rounded-xl bg-[#1A1726] border border-[#252136] text-[#A29BB8] flex items-center justify-center"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${cat.name}`}
                              onClick={() => removeCat(cat.id)}
                              className="w-9 h-9 rounded-xl bg-[#1A1726] border border-[#252136] text-[#FB7185] flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#221E33]">
                          {/* 1-5 Visual Appeal Stars + Subtotal */}
                          <div>
                            <div
                              className="flex items-center gap-0.5"
                              aria-label={`Visual appeal ${stars} out of 5`}
                            >
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  aria-label={`Set ${cat.name} appeal to ${s} stars`}
                                  onClick={() =>
                                    updateCatFields(cat.id, {
                                      beauty: fiveScaleToBeauty(s),
                                    })
                                  }
                                  className="p-0.5"
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      s <= stars
                                        ? 'fill-[#F59E0B] text-[#F59E0B]'
                                        : 'text-[#3A3352]'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                            <div className="font-mono tabular-nums text-xs text-[#C4B5FD] font-semibold mt-1">
                              Subtotal {fmt(subtotal)}
                            </div>
                          </div>

                          {/* Touch Quantity Stepper */}
                          <div className="inline-flex items-center gap-1 rounded-2xl bg-[#0E0C15] border border-[#2D2744] p-1">
                            <button
                              type="button"
                              aria-label={`Decrease quantity for ${cat.name}`}
                              onClick={() => {
                                triggerHaptic(6);
                                stepQty(idx, -1);
                              }}
                              className="w-10 h-10 rounded-xl bg-[#1A1726] text-[#DDD7EE] flex items-center justify-center active:scale-95"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="min-w-[36px] text-center font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity for ${cat.name}`}
                              onClick={() => {
                                triggerHaptic(6);
                                stepQty(idx, 1);
                              }}
                              className="w-10 h-10 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      openNewProductSheet();
                    }}
                    className="w-full min-h-[46px] rounded-2xl border border-dashed border-[#3B3358] bg-[#13111C]/70 text-xs font-semibold text-[#C4B5FD] inline-flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Product to {activeGroup.name}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================== COMBINATIONS SUB-MODE ==================== */}
      {subMode === 'combinations' && (
        <div className="space-y-4">
          {!activeGroup || categories.length === 0 ? (
            <div className="rounded-3xl bg-[#13111C] border border-dashed border-[#322C47] p-6 text-center space-y-3">
              <Layers className="w-6 h-6 text-[#A78BFA] mx-auto" />
              <p className="text-sm font-semibold text-[#F5F3FA]">
                Add products to generate combinations
              </p>
              <p className="text-xs text-[#9D95B8]">
                Once you add products with wholesale cost and a category budget, StallIQ calculates optimal mixes automatically.
              </p>
              <button
                type="button"
                onClick={() => onSubModeChange('inventory')}
                className="min-h-[44px] px-5 rounded-2xl bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Go to Inventory
              </button>
            </div>
          ) : (
            <>
              {/* Objective Selector + Budget & Weights */}
              <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                      Buying Goal
                    </h2>
                    <p className="text-xs text-[#9D95B8]">
                      Optimised for {activeGroup.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeightsSheetOpen(true)}
                    className="min-h-[38px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#C4B5FD] inline-flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Tune Weights</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {OPTIMIZATION_OBJECTIVES.map((obj) => {
                    const active = (activeGroup.objective || 'best_overall') === obj.id;
                    return (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic(6);
                          setActiveObjective(obj.id as OptimizationObjective);
                        }}
                        className={`shrink-0 min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-[#8B5CF6] border-[#A78BFA] text-white'
                            : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                        }`}
                      >
                        {obj.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <label className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 block">
                    <span className="text-[10px] uppercase tracking-wider text-[#9D95B8]">
                      Budget Cap (₹)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={activeGroup.budgetCap || ''}
                      placeholder="e.g. 10000"
                      onChange={(e) =>
                        updateActiveGroup((g) => ({
                          ...g,
                          budgetCap: Math.max(0, Number(e.target.value) || 0),
                          customQuantities: null,
                        }))
                      }
                      className="w-full bg-transparent font-mono tabular-nums text-base font-bold text-[#F5F3FA] mt-0.5 focus:outline-none"
                    />
                  </label>

                  <label className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 block">
                    <span className="text-[10px] uppercase tracking-wider text-[#9D95B8]">
                      Sell-Through (%)
                    </span>
                    <input
                      type="number"
                      min={30}
                      max={100}
                      step={5}
                      value={activeGroup.conservativeSellThroughPct ?? 90}
                      onChange={(e) =>
                        updateActiveGroup((g) => ({
                          ...g,
                          conservativeSellThroughPct: Math.min(
                            100,
                            Math.max(30, Number(e.target.value) || 90)
                          ),
                        }))
                      }
                      className="w-full bg-transparent font-mono tabular-nums text-base font-bold text-[#F5F3FA] mt-0.5 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              {/* Compare Pill Bar when >= 2 selected */}
              {compareComboIds.length >= 2 && (
                <div className="rounded-2xl bg-[#1C1730] border border-[#8B5CF6]/55 px-4 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#C4B5FD]">
                    {compareComboIds.length} combinations selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCompareComboIds([])}
                      className="text-xs text-[#9D95B8]"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareSheetOpen(true)}
                      className="min-h-[36px] px-3.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
                    >
                      Compare
                    </button>
                  </div>
                </div>
              )}

              {/* Swipeable Combination Cards */}
              {generatedCombos.length === 0 ? (
                <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-5 text-center space-y-3">
                  <p className="text-sm font-semibold text-[#F5F3FA]">
                    {activeGroup.budgetCap <= 0
                      ? 'Enter a budget cap above to generate combinations'
                      : 'No combination fits these strict limits'}
                  </p>
                  {activeGroup.budgetCap > 0 && (
                    <button
                      type="button"
                      onClick={relaxConstraints}
                      className="min-h-[42px] px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Relax Constraints</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-[#A29BB8]">
                      Swipe to explore {generatedCombos.length} mixes
                    </span>
                    {activeGroup.customQuantities && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveGroup((g) => ({ ...g, customQuantities: null }))
                        }
                        className="text-xs font-semibold text-[#C4B5FD]"
                      >
                        Reset custom edits
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 -mx-4 px-4">
                    {generatedCombos.map((combo, index) => {
                      const isSelected =
                        !activeGroup.customQuantities &&
                        activeCombo?.id === combo.id;
                      const isSaved = (activeGroup.savedComboIds || []).includes(combo.id);
                      const isCompared = compareComboIds.includes(combo.id);
                      const riskLabel =
                        combo.breakEvenSellThroughPct <= 55
                          ? 'Low'
                          : combo.breakEvenSellThroughPct >= 78
                          ? 'High'
                          : 'Medium';
                      const riskColor =
                        riskLabel === 'Low'
                          ? 'text-[#34D399]'
                          : riskLabel === 'High'
                          ? 'text-[#FB7185]'
                          : 'text-[#F59E0B]';
                      const itemsUsed =
                        combo.distinctItemsCount ??
                        combo.counts.filter((n) => n > 0).length;

                      return (
                        <article
                          key={combo.id}
                          className={`snap-center shrink-0 w-[86%] max-w-[340px] rounded-3xl p-4 border flex flex-col justify-between space-y-3.5 ${
                            isSelected
                              ? 'bg-[#19142B] border-[#8B5CF6] shadow-[0_12px_32px_-12px_rgba(139,92,246,0.45)]'
                              : 'bg-[#13111C] border-[#252136]'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-[#C4B5FD]">
                                  #{index + 1} · {combo.badge || 'Recommended Mix'}
                                </span>
                                <div className="font-mono tabular-nums text-2xl font-bold text-[#F5F3FA] mt-0.5">
                                  {fmt(combo.cost)}
                                </div>
                                <p className="text-[11px] text-[#9D95B8] tabular-nums">
                                  {combo.pieces} pcs · {itemsUsed} of{' '}
                                  {categories.length} products
                                </p>
                              </div>

                              <button
                                type="button"
                                aria-label={isSaved ? 'Unsave mix' : 'Save mix'}
                                onClick={() => {
                                  triggerHaptic(8);
                                  toggleSavedCombo(combo.id);
                                }}
                                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                                  isSaved
                                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                                    : 'bg-[#0E0C15] border-[#252136] text-[#8C84A6]'
                                }`}
                              >
                                <Bookmark
                                  className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
                                />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2">
                                <div className="text-[10px] text-[#9D95B8]">
                                  Expected Revenue
                                </div>
                                <div className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                                  {fmt(combo.rev90)}
                                </div>
                              </div>
                              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2">
                                <div className="text-[10px] text-[#9D95B8]">
                                  Expected Profit
                                </div>
                                <div className="font-mono tabular-nums text-sm font-bold text-[#34D399]">
                                  +{fmt(combo.prof90)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs px-0.5">
                              <span className="text-[#9D95B8]">
                                Sell-through{' '}
                                <strong className="text-[#DDD7EE] font-mono tabular-nums">
                                  {combo.sellThroughPct ?? 90}%
                                </strong>
                              </span>
                              <span className={`font-semibold ${riskColor}`}>
                                {riskLabel} Risk · Unsold {fmt(combo.unsoldRiskCost)}
                              </span>
                            </div>

                            {/* Compact Product Breakdown Preview */}
                            <div className="space-y-1 pt-2 border-t border-[#221E33]">
                              {categories.slice(0, 4).map((cat, cIdx) => {
                                const q = combo.counts[cIdx] || 0;
                                if (q <= 0) return null;
                                return (
                                  <div
                                    key={cat.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="text-[#DDD7EE] truncate pr-2">
                                      {cat.name}
                                    </span>
                                    <span className="font-mono tabular-nums text-[#A29BB8] shrink-0">
                                      {q}× · {fmt(q * cat.cost)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="space-y-2 pt-2 border-t border-[#252136]">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic(10);
                                updateActiveGroup((g) => ({
                                  ...g,
                                  selectedComboId: combo.id,
                                  customQuantities: null,
                                }));
                                showToast(`Selected ${combo.badge || 'stock mix'}`);
                              }}
                              className={`w-full min-h-[44px] rounded-2xl text-xs font-bold transition-colors ${
                                isSelected
                                  ? 'bg-[#34D399]/18 border border-[#34D399]/50 text-[#34D399]'
                                  : 'bg-[#8B5CF6] text-white'
                              }`}
                            >
                              {isSelected ? 'Active Combination' : 'Select Combination'}
                            </button>

                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailCombo(combo)}
                                className="min-h-[38px] rounded-xl bg-[#1A1726] border border-[#252136] text-[11px] font-semibold text-[#DDD7EE]"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCompareCombo(combo.id)}
                                className={`min-h-[38px] rounded-xl border text-[11px] font-semibold ${
                                  isCompared
                                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                                    : 'bg-[#1A1726] border-[#252136] text-[#DDD7EE]'
                                }`}
                              >
                                {isCompared ? 'Comparing' : 'Compare'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyComboOrder(combo)}
                                className="min-h-[38px] rounded-xl bg-[#1A1726] border border-[#252136] text-[11px] font-semibold text-[#DDD7EE]"
                              >
                                Order
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================== SAVED & ORDERS SUB-MODE ==================== */}
      {subMode === 'saved' && (
        <div className="space-y-4">
          {/* Save Current Plan */}
          <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
              Saved Stock Plans
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={savePlanName}
                onChange={(e) => setSavePlanName(e.target.value)}
                placeholder="Name this plan (e.g. Safe ₹15k Mix)"
                aria-label="Stock plan name"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
              />
              <button
                type="button"
                onClick={() => {
                  handleSaveStockPlan(
                    savePlanName.trim() || `Plan ${savedPlans.length + 1}`
                  );
                  setSavePlanName('');
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold shrink-0"
              >
                Save
              </button>
            </div>

            {savedPlans.length === 0 ? (
              <p className="text-xs text-[#9D95B8]">
                Save snapshots of your planned stock quantities so you can compare or restore them later.
              </p>
            ) : (
              <div className="space-y-2">
                {savedPlans.map((plan) => {
                  const drift = detectSavedPlanOutdatedPrices(
                    plan,
                    workspace.categoryGroups
                  );
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#F5F3FA] truncate">
                            {plan.name}
                          </div>
                          <div className="text-xs text-[#9D95B8] font-mono tabular-nums mt-0.5">
                            {plan.overallPieces} pcs · Cost {fmt(plan.overallWholesaleTotal)}
                          </div>
                          {drift.hasOutdatedPrices && (
                            <p className="text-[11px] text-[#F59E0B] mt-1">
                              {drift.driftedProducts.length} product price(s) updated since saved
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete saved plan ${plan.name}`}
                          onClick={() => handleDeleteSavedStockPlan(plan.id)}
                          className="w-9 h-9 rounded-xl bg-[#1A1726] text-[#FB7185] flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLoadSavedStockPlan(plan.id)}
                        className="w-full min-h-[40px] rounded-xl bg-[#1A1726] border border-[#322C47] text-xs font-semibold text-[#C4B5FD]"
                      >
                        Load Plan Quantities
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Purchase Progress Checklist */}
          <div className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                  Purchase Checklist
                </h2>
                <p className="text-xs text-[#9D95B8] font-mono tabular-nums mt-0.5">
                  {purchaseSummary.receivedPieces}/{purchaseSummary.totalPlannedPieces} pcs received ·{' '}
                  {purchaseSummary.completionPct}%
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
            </div>

            {purchaseSummary.lines.length === 0 ? (
              <p className="text-xs text-[#9D95B8]">
                Set quantities for your products to track ordering and delivery progress.
              </p>
            ) : (
              <div className="space-y-2">
                {purchaseSummary.lines.map((line) => (
                  <div
                    key={line.key}
                    className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#F5F3FA] truncate">
                        {line.productName}
                      </div>
                      <div className="text-[11px] text-[#9D95B8] font-mono tabular-nums">
                        {line.groupName} · {line.plannedQty} pcs · {fmt(line.subtotalCost)}
                      </div>
                    </div>

                    <select
                      aria-label={`Purchase status for ${line.productName}`}
                      value={line.status}
                      onChange={(e) => {
                        const status = e.target.value as PurchaseStatus;
                        handleUpdatePurchaseProgress(line.key, {
                          status,
                          checked: status === 'received',
                          receivedQty: status === 'received' ? line.plannedQty : 0,
                        });
                      }}
                      className="min-h-[38px] px-2.5 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#DDD7EE] shrink-0"
                    >
                      <option value="not_ordered">Not ordered</option>
                      <option value="ordered">Ordered</option>
                      <option value="received">Received</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== ADD / EDIT PRODUCT BOTTOM SHEET ==================== */}
      <MobileBottomSheet
        isOpen={productSheetOpen}
        onClose={() => setProductSheetOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        subtitle={activeGroup ? `Category: ${activeGroup.name}` : 'Create category first'}
      >
        {!editingProduct && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#0E0C15] border border-[#252136]">
            <button
              type="button"
              onClick={() => setProductSheetMode('single')}
              className={`min-h-[38px] rounded-xl text-xs font-semibold ${
                productSheetMode === 'single'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#9D95B8]'
              }`}
            >
              Single Product
            </button>
            <button
              type="button"
              onClick={() => setProductSheetMode('bulk')}
              className={`min-h-[38px] rounded-xl text-xs font-semibold ${
                productSheetMode === 'bulk'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#9D95B8]'
              }`}
            >
              Bulk Paste
            </button>
          </div>
        )}

        <form onSubmit={handleProductSubmit} className="space-y-3.5">
          {productSheetMode === 'bulk' && !editingProduct ? (
            <label className="block space-y-1.5">
              <span className="text-xs text-[#A29BB8]">
                One product per line: Name, Cost, Selling Price, Qty, Appeal (1–5)
              </span>
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Oxidised Bangles, 45, 120, 20, 4\nKundan Studs, 60, 150, 15, 5'}
                className="w-full p-3 rounded-2xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA] font-mono"
              />
            </label>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-[#A29BB8]">Product Name *</span>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="e.g. Oxidised Mirror Bangles"
                  className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
                  autoFocus
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-[#A29BB8]">Wholesale Cost (₹) *</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={pCost}
                    onChange={(e) => setPCost(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A29BB8]">Selling Price (₹)</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="block space-y-1">
                  <span className="text-xs text-[#A29BB8]">Planned Quantity</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={pQty}
                    onChange={(e) => setPQty(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#0E0C15] border border-[#2A253D] font-mono tabular-nums text-sm text-[#F5F3FA]"
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-xs text-[#A29BB8] block">Visual Appeal</span>
                  <div className="min-h-[46px] px-3 rounded-2xl bg-[#0E0C15] border border-[#2A253D] flex items-center justify-between">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} stars`}
                        onClick={() => setPStars(star)}
                        className="p-1"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= pStars
                              ? 'fill-[#F59E0B] text-[#F59E0B]'
                              : 'text-[#3A3352]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {formError && (
            <p className="text-xs text-[#FB7185] font-medium">{formError}</p>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-bold active:scale-[0.98] transition-transform"
          >
            {editingProduct
              ? 'Save Product Changes'
              : productSheetMode === 'bulk'
              ? 'Add All Products'
              : 'Add Product'}
          </button>
        </form>
      </MobileBottomSheet>

      {/* ==================== MANAGE CATEGORIES SHEET ==================== */}
      <MobileBottomSheet
        isOpen={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        title="Categories"
        subtitle="Create, reorder, rename, or remove categories"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name"
            aria-label="New category name"
            className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
          />
          <button
            type="button"
            onClick={() => {
              if (!newCatName.trim()) return;
              createEmptyCategoryGroup(newCatName.trim());
              setNewCatName('');
              showToast('Created category');
            }}
            className="min-h-[44px] px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold shrink-0"
          >
            Create
          </button>
        </div>

        <div className="space-y-2">
          {resolvedGroups.map(({ group }, idx) => (
            <div
              key={group.id}
              className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3 space-y-2"
            >
              {renamingGroupId === group.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={renameGroupDraft}
                    onChange={(e) => setRenameGroupDraft(e.target.value)}
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#13111C] border border-[#8B5CF6] text-sm text-[#F5F3FA]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameGroupDraft.trim()) {
                        renameCategoryGroup(group.id, renameGroupDraft.trim());
                      }
                      setRenamingGroupId(null);
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor }}
                    />
                    <span className="text-sm font-semibold text-[#F5F3FA] truncate">
                      {group.name}
                    </span>
                    <span className="text-xs text-[#9D95B8]">
                      ({group.categories.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ${group.name} left`}
                      disabled={idx === 0}
                      onClick={() => moveCategoryGroup(group.id, -1)}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] text-[#A29BB8] flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${group.name} right`}
                      disabled={idx === resolvedGroups.length - 1}
                      onClick={() => moveCategoryGroup(group.id, 1)}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] text-[#A29BB8] flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename ${group.name}`}
                      onClick={() => {
                        setRenamingGroupId(group.id);
                        setRenameGroupDraft(group.name);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] text-[#A29BB8] flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${group.name}`}
                      onClick={() => duplicateCategoryGroup(group.id)}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] text-[#A29BB8] flex items-center justify-center"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${group.name}`}
                      onClick={() => removeCategoryGroup(group.id)}
                      className="w-8 h-8 rounded-lg bg-[#1A1726] text-[#FB7185] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Optional Sample Templates */}
        <div className="pt-2 border-t border-[#252136] space-y-2">
          <p className="text-xs font-semibold text-[#9D95B8]">
            Optional Starter Templates
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  createGroupFromTemplate(tpl.id);
                  setCategorySheetOpen(false);
                }}
                className="min-h-[38px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-medium text-[#DDD7EE]"
              >
                + {tpl.name}
              </button>
            ))}
          </div>
        </div>
      </MobileBottomSheet>

      {/* ==================== PRIORITY WEIGHTS SHEET ==================== */}
      <MobileBottomSheet
        isOpen={weightsSheetOpen}
        onClose={() => setWeightsSheetOpen(false)}
        title="Priority Weights"
        subtitle="Adjust how combinations are ranked"
        footer={
          <button
            type="button"
            onClick={() => setWeightsSheetOpen(false)}
            className="w-full min-h-[46px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-semibold"
          >
            Done
          </button>
        }
      >
        {(
          [
            { key: 'profit', label: 'Profit Potential' },
            { key: 'variety', label: 'Product Variety' },
            { key: 'appeal', label: 'Visual Appeal' },
            { key: 'budgetUsage', label: 'Budget Usage' },
            { key: 'lowRisk', label: 'Lower Unsold Risk' },
          ] as const
        ).map(({ key, label }) => (
          <label key={key} className="block space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F5F3FA]">{label}</span>
              <span className="font-mono tabular-nums text-[#C4B5FD]">
                {activeWeights[key]}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={activeWeights[key]}
              onChange={(e) =>
                setActivePriorityWeights({
                  ...activeWeights,
                  [key]: Number(e.target.value),
                })
              }
              className="w-full accent-[#8B5CF6]"
            />
          </label>
        ))}

        <button
          type="button"
          onClick={() => setActivePriorityWeights(undefined)}
          className="w-full min-h-[40px] rounded-xl bg-[#1A1726] border border-[#252136] text-xs font-semibold text-[#A29BB8]"
        >
          Reset to Goal Defaults
        </button>
      </MobileBottomSheet>

      {/* ==================== COMBINATION DETAIL SHEET ==================== */}
      <MobileBottomSheet
        isOpen={Boolean(detailCombo)}
        onClose={() => setDetailCombo(null)}
        title={detailCombo?.badge || 'Combination Details'}
        subtitle={
          detailCombo
            ? `${detailCombo.pieces} pcs · Purchase ${fmt(detailCombo.cost)}`
            : undefined
        }
        footer={
          detailCombo && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  duplicateComboToCustom(detailCombo.counts);
                  setDetailCombo(null);
                  onSubModeChange('inventory');
                }}
                className="min-h-[46px] rounded-2xl bg-[#1A1726] border border-[#322C47] text-xs font-semibold text-[#C4B5FD]"
              >
                Edit Quantities
              </button>
              <button
                type="button"
                onClick={() => void handleCopyComboOrder(detailCombo)}
                className="min-h-[46px] rounded-2xl bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Copy Supplier Order
              </button>
            </div>
          )
        }
      >
        {detailCombo && (
          <div className="space-y-3">
            {detailCombo.reason && (
              <p className="text-xs text-[#DDD7EE] leading-relaxed bg-[#1A1726] border border-[#252136] rounded-2xl p-3">
                {detailCombo.reason}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3">
                <div className="text-[10px] text-[#9D95B8]">Cost</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                  {fmt(detailCombo.cost)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3">
                <div className="text-[10px] text-[#9D95B8]">Revenue</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#F5F3FA]">
                  {fmt(detailCombo.rev90)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3">
                <div className="text-[10px] text-[#9D95B8]">Profit</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#34D399]">
                  +{fmt(detailCombo.prof90)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#A29BB8]">
                Product Quantities
              </h3>
              {categories.map((cat, idx) => {
                const qty = detailCombo.counts[idx] || 0;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl bg-[#0E0C15] border border-[#221E33] px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-medium text-[#F5F3FA] truncate pr-2">
                      {cat.name}
                    </span>
                    <span className="font-mono tabular-nums text-[#C4B5FD] shrink-0">
                      {qty} pcs · {fmt(qty * cat.cost)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* ==================== COMPARE COMBINATIONS SHEET ==================== */}
      <MobileBottomSheet
        isOpen={compareSheetOpen}
        onClose={() => setCompareSheetOpen(false)}
        title="Compare Combinations"
        subtitle={`${comparedCombos.length} selected mixes`}
      >
        <div className="space-y-3">
          {comparedCombos.map((combo) => (
            <div
              key={combo.id}
              className="rounded-2xl bg-[#0E0C15] border border-[#252136] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#C4B5FD]">
                  {combo.badge || 'Stock Mix'}
                </span>
                <span className="font-mono tabular-nums text-xs text-[#9D95B8]">
                  {combo.pieces} pcs · Unsold {fmt(combo.unsoldRiskCost)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-[#9D95B8] block text-[10px]">Cost</span>
                  <span className="font-bold text-[#F5F3FA]">{fmt(combo.cost)}</span>
                </div>
                <div>
                  <span className="text-[#9D95B8] block text-[10px]">Revenue</span>
                  <span className="font-bold text-[#F5F3FA]">
                    {fmt(combo.rev90)}
                  </span>
                </div>
                <div>
                  <span className="text-[#9D95B8] block text-[10px]">Profit</span>
                  <span className="font-bold text-[#34D399]">
                    +{fmt(combo.prof90)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateActiveGroup((g) => ({
                    ...g,
                    selectedComboId: combo.id,
                    customQuantities: null,
                  }));
                  setCompareSheetOpen(false);
                  showToast(`Selected ${combo.badge || 'mix'}`);
                }}
                className="w-full min-h-[40px] rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
              >
                Use This Mix
              </button>
            </div>
          ))}
        </div>
      </MobileBottomSheet>
    </div>
  );
}
