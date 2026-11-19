import {
  EXTRA_CATEGORY_STYLES,
  GROUP_ACCENT_COLORS,
  INITIAL_CATEGORIES,
} from '../data/defaults.js';
import type {
  AccountAiContext,
  AiFocusSection,
  AiMemoryAddition,
  AiMemoryCategory,
  AppTab,
  BangleCategory,
  BangleCombo,
  DiversifiedOverviewTotals,
  LayoutPresetStyle,
  OptimizationObjective,
  PlannerSnapshot,
  StallStockItem,
  StallTotals,
  StallType,
  StockCategoryGroup,
  ZoneId,
} from '../types/stall.js';
import {
  applyCustomQuantities,
  calculateStallTotals,
  computeDiversifiedOverviewTotals,
  evaluatePlanHealth,
  generateStockCombinationsWithMeta,
  parseLocalRawCommand,
  resolveCategoryGroups,
  syncCategoryGroupsToStallStock,
} from './optimizer.js';
import {
  beautyToFiveScale,
  createSavedPlanSnapshot,
  fiveScaleToBeauty,
  formatCategoryPurchaseOrder,
  formatFullPurchaseOrder,
  makePurchaseItemKey,
} from './orderAndProjectEngine.js';

const VALID_MEMORY_CATEGORIES = new Set<AiMemoryCategory>([
  'inventory',
  'pricing',
  'event',
  'preference',
  'strategy',
]);

const VALID_OBJECTIVES = new Set<OptimizationObjective>([
  'best_overall',
  'highest_profit',
  'balanced_variety',
  'lowest_risk',
  'best_appeal',
  'best_budget_use',
  'conservative_sales',
  'high_footfall',
  'small_budget',
]);

const VALID_STALL_TYPES = new Set<StallType>([
  'tabletop',
  'corner_booth',
  'open_canopy',
  'indoor_kiosk',
]);

const VALID_LAYOUT_STYLES = new Set<LayoutPresetStyle>([
  'classic_u',
  'open_gallery',
  'counter_focus',
]);

function buildZonesForLayoutStyle(
  style: LayoutPresetStyle,
  catNames: string[]
): Partial<Record<ZoneId, string[]>> {
  if (catNames.length === 0) return {};
  if (style === 'open_gallery') {
    return {
      front_left: catNames.slice(0, 2),
      center_tray: catNames.slice(-1),
      right_mirror: catNames.slice(1, 2).length ? catNames.slice(1, 2) : catNames.slice(0, 1),
      back_riser: catNames,
    };
  }
  if (style === 'counter_focus') {
    return {
      front_left: catNames.slice(1, 2).length ? catNames.slice(1, 2) : catNames.slice(0, 1),
      center_tray: catNames.slice(0, 2),
      right_mirror: catNames.slice(0, 1),
      back_riser: catNames.slice(-2),
    };
  }
  return {
    front_left: catNames.slice(0, 1),
    center_tray: catNames.slice(1, 2).length ? catNames.slice(1, 2) : catNames.slice(0, 1),
    right_mirror: catNames.slice(2, 3).length ? catNames.slice(2, 3) : catNames.slice(-1),
    back_riser: catNames.slice(0, 2),
  };
}

const VALID_FOCUS_SECTIONS = new Set<AiFocusSection>([
  'categories',
  'budget',
  'combos',
  'overview_totals',
  'overview_cards',
  'overview_costs',
  'cfo_summary',
  'cfo_costs',
  'cfo_ledger',
  'playbook_layout',
  'playbook_approaches',
  'playbook_resources',
  'research_workspace',
]);

function sanitizeMemoryAdditions(raw: unknown): AiMemoryAddition[] {
  if (!Array.isArray(raw)) return [];
  const out: AiMemoryAddition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as { fact?: unknown; category?: unknown };
    const fact = typeof obj.fact === 'string' ? obj.fact.trim().slice(0, 500) : '';
    if (fact.length < 2) continue;
    const catRaw =
      typeof obj.category === 'string' ? obj.category.trim().toLowerCase() : 'preference';
    const category: AiMemoryCategory = VALID_MEMORY_CATEGORIES.has(catRaw as AiMemoryCategory)
      ? (catRaw as AiMemoryCategory)
      : 'preference';
    out.push({ fact, category });
  }
  return out.slice(0, 10);
}

const STYLE_POOL = [
  ...INITIAL_CATEGORIES.map(({ barColor, textClass, bgClass }) => ({
    barColor,
    textClass,
    bgClass,
  })),
  ...EXTRA_CATEGORY_STYLES,
];

function slugifyId(name: string, idx: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base ? `${base}_${idx}` : `cat_${idx}`;
}

export function estimateRetailPrice(cost: number): number {
  const safeCost = Math.max(1, Math.round(cost));
  const raw = safeCost * 2.5;
  if (raw < 100) {
    return Math.max(safeCost + 25, Math.round(raw / 10) * 10 - 1);
  }
  if (raw < 1000) {
    return Math.max(safeCost + 50, Math.round(raw / 50) * 50 - 1);
  }
  return Math.max(safeCost + 150, Math.round(raw / 100) * 100 - 1);
}

function makeShortName(name: string, shortName?: string): string {
  if (shortName && shortName.trim()) return shortName.trim();
  const cleaned = name.replace(/\(.*?\)/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return cleaned.slice(0, 14);
  return `${words[0]} ${words[1]}`.slice(0, 14);
}

export interface AiActionExecutionResult {
  ok: boolean;
  error?: string;
  nextState: PlannerSnapshot;
  changes: string[];
  memoryAdditions: AiMemoryAddition[];
  activeCombo: BangleCombo | null;
  topCombos: BangleCombo[];
  stallTotals: StallTotals;
  overviewTotals?: DiversifiedOverviewTotals;
  focusSection?: AiFocusSection;
  orderCopyText?: string;
  requiresConfirmation?: boolean;
  confirmationReason?: string;
  toolResponse: Record<string, unknown>;
}

export function assessConfirmationRequirement(
  toolName: string,
  args: Record<string, unknown>,
  snapshot: PlannerSnapshot
): { required: boolean; reason?: string } {
  if (toolName === 'configure_planner') {
    if (args.replaceCategories === true && snapshot.categories.length > 0) {
      return {
        required: true,
        reason: `This will replace all ${snapshot.categories.length} existing products in the active category.`,
      };
    }
    if (Array.isArray(args.removeItemNames) && args.removeItemNames.length > 0) {
      return {
        required: true,
        reason: `This will remove ${args.removeItemNames.length} product(s) from your category list.`,
      };
    }
    if (typeof args.budgetCap === 'number' && snapshot.budgetCap > 0) {
      const diff = Math.abs(args.budgetCap - snapshot.budgetCap);
      if (diff >= 5000 && diff / snapshot.budgetCap >= 0.5) {
        return {
          required: true,
          reason: `Major budget change: ₹${snapshot.budgetCap.toLocaleString('en-IN')} → ₹${Math.round(args.budgetCap).toLocaleString('en-IN')}.`,
        };
      }
    }
    if (typeof args.stallFee === 'number' && snapshot.stallFee > 0) {
      const diff = Math.abs(args.stallFee - snapshot.stallFee);
      if (diff >= 5000 && diff / snapshot.stallFee >= 0.5) {
        return {
          required: true,
          reason: `Major stall rent change: ₹${snapshot.stallFee.toLocaleString('en-IN')} → ₹${Math.round(args.stallFee).toLocaleString('en-IN')}.`,
        };
      }
    }
  }

  if (toolName === 'manage_inventory_stock') {
    if (args.replaceStock === true) {
      return {
        required: true,
        reason: 'This will replace your custom stall stock rows.',
      };
    }
    if (Array.isArray(args.removeItemNames) && args.removeItemNames.length > 0) {
      return {
        required: true,
        reason: `This will remove ${args.removeItemNames.length} stock or expense item(s).`,
      };
    }
    if (
      Array.isArray(args.eventCosts) &&
      (args.eventCosts as Array<{ remove?: boolean }>).some((e) => e?.remove === true)
    ) {
      return {
        required: true,
        reason: 'This will remove an event expense from your financial totals.',
      };
    }
  }

  return { required: false };
}

function buildErrorResult(
  originalSnapshot: PlannerSnapshot,
  errorMsg: string,
  accountContext?: AccountAiContext
): AiActionExecutionResult {
  const base = finalizeSnapshot(originalSnapshot, [], undefined, [], accountContext);
  return {
    ...base,
    ok: false,
    error: errorMsg,
    nextState: originalSnapshot,
    changes: [],
    toolResponse: {
      ...base.toolResponse,
      ok: false,
      error: errorMsg,
    },
  };
}

function finalizeSnapshot(
  candidate: PlannerSnapshot,
  changes: string[],
  selectRank?: number,
  memoryAdditions: AiMemoryAddition[] = [],
  accountContext?: AccountAiContext,
  focusSection?: AiFocusSection,
  confirmation?: { required: boolean; reason?: string },
  orderCopyText?: string
): AiActionExecutionResult {
  const hasGroups = Array.isArray(candidate.categoryGroups) && candidate.categoryGroups.length > 0;
  const activeGroupObj = hasGroups
    ? candidate.categoryGroups!.find((g) => g.id === candidate.activeGroupId) || candidate.categoryGroups![0]
    : undefined;
  const activeGroupConservative =
    activeGroupObj?.conservativeSellThroughPct ?? candidate.globalSellThrough ?? 90;
  const activeObjective = activeGroupObj?.objective || 'best_overall';

  const hasPricedProducts = candidate.categories.some((c) => c.price > 0 && c.cost > 0);
  const { combos } =
    candidate.categories.length > 0 && candidate.budgetCap > 0 && hasPricedProducts
      ? generateStockCombinationsWithMeta(
          candidate.categories,
          {
            budgetCap: candidate.budgetCap,
            minProfitFloor: candidate.minProfitFloor,
            maxPerCategory: candidate.maxPerCategory,
            minColoursRule: candidate.minColoursRule,
            conservativeSellThroughPct: activeGroupConservative,
            objective: activeObjective,
            priorityWeights: activeGroupObj?.priorityWeights,
          },
          candidate.rules,
          30
        )
      : { combos: [] as BangleCombo[] };

  let selectedId = candidate.selectedComboId;
  if (typeof selectRank === 'number' && combos.length > 0) {
    const idx = Math.min(combos.length - 1, Math.max(0, Math.round(selectRank) - 1));
    selectedId = combos[idx].id;
  } else if (combos.length > 0 && selectedId && !combos.some((c) => c.id === selectedId)) {
    selectedId = combos[0].id;
  } else if (combos.length === 0) {
    selectedId = null;
  }

  const baseCombo = combos.find((c) => c.id === selectedId) || null;
  const nextSelectedComboId = baseCombo ? baseCombo.id : null;

  let nextCategoryGroups = candidate.categoryGroups;
  let syncedStock = candidate.stallStock;
  let overviewTotals: DiversifiedOverviewTotals | undefined;
  let activeCombo: BangleCombo | null = baseCombo;

  if (hasGroups && activeGroupObj) {
    const targetGroupId = activeGroupObj.id;
    nextCategoryGroups = candidate.categoryGroups!.map((g) =>
      g.id === targetGroupId
        ? {
            ...g,
            budgetCap: candidate.budgetCap,
            minProfitFloor: candidate.minProfitFloor,
            maxPerCategory: candidate.maxPerCategory,
            minColoursRule: candidate.minColoursRule,
            rules: candidate.rules,
            categories: candidate.categories,
            selectedComboId: nextSelectedComboId,
            customQuantities: candidate.customQuantities,
          }
        : g
    );
    const resolved = resolveCategoryGroups(nextCategoryGroups);
    const resolvedActive = resolved.find((r) => r.group.id === targetGroupId) || resolved[0];
    activeCombo = resolvedActive ? resolvedActive.activeCombo : null;
    syncedStock = syncCategoryGroupsToStallStock(
      resolved,
      candidate.stallStock,
      candidate.globalSellThrough
    );
    const extraEventCost = syncedStock.reduce(
      (sum, s) =>
        s.itemType === 'event_cost' ? sum + Math.max(0, s.cost) * Math.max(0, s.qty) : sum,
      0
    );
    overviewTotals = computeDiversifiedOverviewTotals(
      resolved,
      candidate.stallFee + extraEventCost,
      candidate.expectedFootfall
    );
  } else {
    syncedStock = candidate.stallStock.filter((s) => !s.isSyncedBundle || s.itemType === 'event_cost');
    const extraEventCost = syncedStock.reduce(
      (sum, s) =>
        s.itemType === 'event_cost' ? sum + Math.max(0, s.cost) * Math.max(0, s.qty) : sum,
      0
    );
    overviewTotals = computeDiversifiedOverviewTotals(
      [],
      candidate.stallFee + extraEventCost,
      candidate.expectedFootfall
    );
  }

  const nextState: PlannerSnapshot = {
    ...candidate,
    activeGroupId: activeGroupObj ? activeGroupObj.id : '',
    selectedComboId: nextSelectedComboId,
    stallStock: syncedStock,
    ...(nextCategoryGroups ? { categoryGroups: nextCategoryGroups } : {}),
  };

  const stallTotals = calculateStallTotals(
    nextState.stallStock,
    nextState.stallFee,
    nextState.expectedFootfall
  );

  const planHealth = overviewTotals ? evaluatePlanHealth(overviewTotals, stallTotals) : null;

  const activeBreakdown = activeCombo
    ? nextState.categories.map((cat, idx) => ({
        name: cat.name,
        qty: activeCombo!.counts[idx] || 0,
        unitCost: cat.cost,
        sellPrice: cat.price,
        appealOutOf5: beautyToFiveScale(cat.beauty),
        lineCost: (activeCombo!.counts[idx] || 0) * cat.cost,
        lineRev: (activeCombo!.counts[idx] || 0) * cat.price,
      }))
    : [];

  return {
    ok: true,
    nextState,
    changes,
    memoryAdditions,
    activeCombo,
    topCombos: combos.slice(0, 5),
    stallTotals,
    overviewTotals,
    focusSection,
    orderCopyText,
    requiresConfirmation: confirmation?.required || false,
    confirmationReason: confirmation?.reason,
    toolResponse: {
      ok: true,
      appliedChanges: changes,
      requiresConfirmation: confirmation?.required || false,
      confirmationReason: confirmation?.reason || null,
      ...(orderCopyText ? { orderCopyText } : {}),
      savedMemories: memoryAdditions,
      accountProfile: accountContext
        ? {
            preferredName: accountContext.preferredName || accountContext.displayName,
            merchantName: accountContext.displayName,
            businessName: accountContext.businessName,
            rememberedFacts: accountContext.memories.slice(0, 20),
          }
        : null,
      eventName: nextState.eventName,
      eventLocation: nextState.eventLocation || '',
      eventDate: nextState.eventDate || '',
      expectedFootfall: nextState.expectedFootfall,
      budgetCap: nextState.budgetCap,
      minProfitFloor: nextState.minProfitFloor,
      stallFee: nextState.stallFee,
      activeTab: nextState.activeTab,
      focusSection: focusSection || null,
      activeGroupId: nextState.activeGroupId || null,
      stallSetup: nextState.stallSetup || null,
      planHealth,
      categoryGroupsSummary: nextCategoryGroups?.map((g) => ({
        id: g.id,
        name: g.name,
        budgetCap: g.budgetCap,
        objective: g.objective || 'best_overall',
        selectedComboId: g.selectedComboId,
        itemsCount: g.categories.length,
      })),
      categoriesCount: nextState.categories.length,
      combosFound: combos.length,
      activeCombo: activeCombo
        ? {
            label: activeCombo.label,
            badge: activeCombo.badge,
            keywords: activeCombo.keywords,
            cost: activeCombo.cost,
            rev100: activeCombo.rev100,
            prof100: activeCombo.prof100,
            rev90: activeCombo.rev90,
            prof90: activeCombo.prof90,
            unsoldRiskCost: activeCombo.unsoldRiskCost,
            breakEvenSellThroughPct: activeCombo.breakEvenSellThroughPct,
            pieces: activeCombo.pieces,
            avgBeauty: activeCombo.avgBeauty,
            marginPct: activeCombo.marginPct,
            breakdown: activeBreakdown,
          }
        : null,
      topCombosSummary: combos.slice(0, 5).map((c) => ({
        rank: c.rank,
        label: c.label,
        badge: c.badge,
        cost: c.cost,
        rev100: c.rev100,
        prof100: c.prof100,
        prof90: c.prof90,
        pieces: c.pieces,
        avgBeauty: c.avgBeauty,
        breakdownText: nextState.categories
          .map((cat, i) => (c.counts[i] > 0 ? `${c.counts[i]} ${cat.shortName}` : null))
          .filter(Boolean)
          .join(', '),
      })),
      overviewSummary: overviewTotals || null,
      totalStallSummary: {
        totalStockCost: stallTotals.totalCost,
        totalEventCosts: stallTotals.totalEventCosts,
        totalOutlayWithEventCosts: stallTotals.totalOutlay,
        expectedSalesConservative: stallTotals.revRealistic,
        expectedSales100Pct: stallTotals.rev100,
        estimatedFinalProfit: stallTotals.netAfterStallReal,
        totalPieces: stallTotals.totalUnits,
        unitsToBreakEven: stallTotals.unitsToBreakEven,
        breakEvenSellThroughPct: stallTotals.breakEvenSellThroughPct,
        visitorConversionNeededPct: stallTotals.footfallConversionNeeded,
        unsoldStockValueAtConservative: stallTotals.unsoldInventoryCost,
      },
    },
  };
}

function defaultFocusForTab(tab: AppTab): AiFocusSection {
  if (tab === 'overview' || tab === 'calculator') return 'overview_totals';
  if (tab === 'strategies') return 'playbook_layout';
  if (tab === 'research') return 'research_workspace';
  return 'combos';
}

export function applyAiToolAction(
  snapshot: PlannerSnapshot,
  toolName: string,
  rawArgs: Record<string, unknown> | undefined,
  accountContext?: AccountAiContext
): AiActionExecutionResult {
  const args = rawArgs || {};
  const changes: string[] = [];

  if (toolName === 'get_live_plan_summary') {
    return finalizeSnapshot(
      snapshot,
      ['Read current live plan'],
      undefined,
      [],
      accountContext
    );
  }

  if (toolName === 'save_ai_memory') {
    const memoryAdditions = sanitizeMemoryAdditions(args.memories);
    const memChanges = memoryAdditions.map((m) => `Remembered: ${m.fact}`);
    return finalizeSnapshot(
      snapshot,
      memChanges,
      undefined,
      memoryAdditions,
      accountContext
    );
  }

  const confirmation = assessConfirmationRequirement(toolName, args, snapshot);

  let next: PlannerSnapshot = {
    ...snapshot,
    rules: { ...snapshot.rules },
    categories: snapshot.categories.map((c) => ({ ...c })),
    stallStock: snapshot.stallStock.map((s) => ({ ...s })),
    customQuantities: snapshot.customQuantities ? [...snapshot.customQuantities] : null,
    stallSetup: snapshot.stallSetup
      ? { ...snapshot.stallSetup }
      : { widthFt: 8, depthFt: 6, stallType: 'tabletop', layoutNotes: '' },
    categoryGroups: snapshot.categoryGroups
      ? snapshot.categoryGroups.map((g) => ({
          ...g,
          rules: { ...g.rules },
          categories: g.categories.map((c) => ({ ...c })),
          customQuantities: g.customQuantities ? [...g.customQuantities] : null,
        }))
      : undefined,
  };

  const hasExplicitFocus =
    typeof args.focusSection === 'string' &&
    VALID_FOCUS_SECTIONS.has(args.focusSection as AiFocusSection);
  let focusSection: AiFocusSection | undefined = hasExplicitFocus
    ? (args.focusSection as AiFocusSection)
    : undefined;

  if (toolName === 'add_products_to_inventory') {
    const rawItems = Array.isArray(args.items)
      ? (args.items as Array<{
          name?: unknown;
          categoryName?: unknown;
          purchaseCost?: unknown;
          sellingPrice?: unknown;
          quantity?: unknown;
          appealRating?: unknown;
          notes?: unknown;
        }>)
      : [];

    if (rawItems.length === 0) {
      return buildErrorResult(
        snapshot,
        'Tell me the product name and purchase cost per piece so I can add it to your project.',
        accountContext
      );
    }

    const inferCategoryName = (productName: string): string => {
      const n = productName.toLowerCase();
      if (/\b(bangle|bangles|kada|kadas|chudi|chudiyan|bracelet|cuff)\b/.test(n)) return 'Bangles';
      if (/\b(hair|clip|clips|claw|scrunchie|headband|ribbon|pin|tiara)\b/.test(n))
        return 'Hair Accessories';
      if (/\b(necklace|necklaces|ring|rings|earring|earrings|jhumka|pendant|chain|anklet|jewel)\b/.test(n))
        return 'Jewellery';
      if (/\b(kurti|saree|dupatta|scarf|stole|shirt|top|dress|cloth)\b/.test(n)) return 'Clothing';
      if (/\b(candle|mug|cushion|decor|lamp|vase|home)\b/.test(n)) return 'Home & Lifestyle';
      return 'General';
    };

    const groups: StockCategoryGroup[] = Array.isArray(next.categoryGroups)
      ? [...next.categoryGroups]
      : [];
    const defaultCatArg =
      typeof args.defaultCategoryName === 'string' && args.defaultCategoryName.trim()
        ? args.defaultCategoryName.trim().slice(0, 60)
        : '';

    let lastTouchedGroupId = next.activeGroupId || '';

    for (let idx = 0; idx < rawItems.length; idx++) {
      const entry = rawItems[idx];
      const name = typeof entry?.name === 'string' ? entry.name.trim().slice(0, 80) : '';
      const purchaseCost =
        typeof entry?.purchaseCost === 'number' && Number.isFinite(entry.purchaseCost)
          ? entry.purchaseCost
          : Number(entry?.purchaseCost);

      if (!name) {
        return buildErrorResult(
          snapshot,
          'Please share the product name so I can add it.',
          accountContext
        );
      }
      if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
        return buildErrorResult(
          snapshot,
          `What is the purchase cost per piece (in ₹) for "${name}"?`,
          accountContext
        );
      }

      const explicitCat =
        typeof entry?.categoryName === 'string' && entry.categoryName.trim()
          ? entry.categoryName.trim().slice(0, 60)
          : '';
      const activeGroupObj = groups.find((g) => g.id === next.activeGroupId);
      const targetCatName =
        explicitCat || defaultCatArg || activeGroupObj?.name || inferCategoryName(name);

      let targetGroup = groups.find(
        (g) =>
          g.name.toLowerCase() === targetCatName.toLowerCase() ||
          (explicitCat && g.name.toLowerCase().includes(targetCatName.toLowerCase()))
      );

      if (!targetGroup) {
        const newId = `grp_${Date.now()}_${groups.length + 1}`;
        targetGroup = {
          id: newId,
          name: targetCatName,
          accentColor: GROUP_ACCENT_COLORS[groups.length % GROUP_ACCENT_COLORS.length],
          budgetCap: 0,
          minProfitFloor: 0,
          maxPerCategory: 6,
          minColoursRule: 0,
          conservativeSellThroughPct: next.globalSellThrough || 90,
          objective: 'best_overall',
          rules: {
            allAtLeastOne: false,
            evenDistribution: false,
            beautyFirst: false,
            maxProfitFocus: false,
            safe90Mode: false,
          },
          categories: [],
          selectedComboId: null,
          customQuantities: null,
        };
        groups.push(targetGroup);
        changes.push(`Created category "${targetGroup.name}"`);
      }

      const cost = Math.max(0, Math.round(purchaseCost));
      const hasSellingPrice =
        typeof entry?.sellingPrice === 'number' &&
        Number.isFinite(entry.sellingPrice) &&
        entry.sellingPrice > 0;
      const sellingPrice = hasSellingPrice ? Math.round(entry.sellingPrice as number) : 0;
      const hasQuantity =
        typeof entry?.quantity === 'number' &&
        Number.isFinite(entry.quantity) &&
        entry.quantity >= 0;
      const plannedQty = hasQuantity ? Math.round(entry.quantity as number) : null;
      const rawAppeal =
        typeof entry?.appealRating === 'number' &&
        Number.isFinite(entry.appealRating) &&
        entry.appealRating >= 1
          ? entry.appealRating
          : null;
      const hasAppeal = rawAppeal !== null;
      const appealStars =
        rawAppeal !== null
          ? rawAppeal <= 5
            ? Math.min(5, Math.max(1, Math.round(rawAppeal)))
            : beautyToFiveScale(rawAppeal)
          : null;
      const beauty = appealStars !== null ? fiveScaleToBeauty(appealStars) : 6;

      const existingIdx = targetGroup.categories.findIndex(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );

      if (existingIdx >= 0) {
        const prev = targetGroup.categories[existingIdx];
        targetGroup.categories[existingIdx] = {
          ...prev,
          cost,
          price: hasSellingPrice ? sellingPrice : prev.price,
          plannedQty: hasQuantity ? plannedQty : prev.plannedQty,
          beauty: hasAppeal ? beauty : prev.beauty,
          ...(typeof entry?.notes === 'string' && entry.notes.trim()
            ? { notes: entry.notes.trim().slice(0, 200) }
            : {}),
        };
        if (targetGroup.customQuantities && hasQuantity && plannedQty !== null) {
          const updatedCustom = [...targetGroup.customQuantities];
          updatedCustom[existingIdx] = plannedQty;
          targetGroup.customQuantities = updatedCustom;
        }
      } else {
        const style = STYLE_POOL[targetGroup.categories.length % STYLE_POOL.length];
        const newProduct: BangleCategory = {
          id: slugifyId(name, targetGroup.categories.length + 1),
          name,
          shortName: makeShortName(name),
          cost,
          price: sellingPrice,
          beauty,
          ...(plannedQty !== null ? { plannedQty } : {}),
          ...(typeof entry?.notes === 'string' && entry.notes.trim()
            ? { notes: entry.notes.trim().slice(0, 200) }
            : {}),
          ...style,
        };
        targetGroup.categories.push(newProduct);
        if (targetGroup.customQuantities) {
          targetGroup.customQuantities = [...targetGroup.customQuantities, plannedQty ?? 0];
        }
      }

      const detailParts = [`₹${cost}/pc`];
      if (plannedQty !== null) detailParts.unshift(`${plannedQty}x`);
      if (hasSellingPrice) detailParts.push(`sell ₹${sellingPrice}`);
      if (appealStars !== null) detailParts.push(`appeal ${appealStars}/5`);
      changes.push(`Added ${name} (${detailParts.join(', ')}) → ${targetGroup.name}`);
      lastTouchedGroupId = targetGroup.id;
    }

    const activeGrp = groups.find((g) => g.id === lastTouchedGroupId) || groups[0];
    next.categoryGroups = groups;
    next.activeGroupId = activeGrp ? activeGrp.id : '';
    next.categories = activeGrp ? activeGrp.categories.map((c) => ({ ...c })) : [];
    next.budgetCap = activeGrp ? activeGrp.budgetCap : 0;
    next.minProfitFloor = activeGrp ? activeGrp.minProfitFloor : 0;
    next.maxPerCategory = activeGrp ? activeGrp.maxPerCategory : 6;
    next.minColoursRule = activeGrp ? activeGrp.minColoursRule : 0;
    next.rules = activeGrp ? { ...activeGrp.rules } : next.rules;
    next.selectedComboId = activeGrp ? activeGrp.selectedComboId : null;
    next.customQuantities = activeGrp?.customQuantities ? [...activeGrp.customQuantities] : null;
    focusSection = focusSection || 'categories';

    return finalizeSnapshot(next, changes, undefined, [], accountContext, focusSection);
  }

  if (toolName === 'get_supplier_order') {
    const resolved = resolveCategoryGroups(next.categoryGroups || []);
    const scope = typeof args.scope === 'string' ? args.scope : 'full_order';
    const catName = typeof args.categoryName === 'string' ? args.categoryName.trim().toLowerCase() : '';
    const projectLabel = next.projectMeta?.name || next.eventName || 'Project';
    let orderText = '';
    if (scope === 'active_category' || catName) {
      const target =
        (catName
          ? resolved.find((r) => r.group.name.toLowerCase().includes(catName))
          : resolved.find((r) => r.group.id === next.activeGroupId)) || resolved[0];
      if (target) {
        orderText = formatCategoryPurchaseOrder(target, {
          projectName: projectLabel,
          eventName: next.eventName,
        });
      }
    }
    if (!orderText) {
      orderText = formatFullPurchaseOrder(resolved, {
        projectName: projectLabel,
        eventName: next.eventName,
        eventDate: next.eventDate,
      });
    }
    if (!orderText || orderText.includes('No stock quantities selected yet.')) {
      return buildErrorResult(
        snapshot,
        'No planned product quantities are set yet. Add quantities to your products first to generate a supplier order.',
        accountContext
      );
    }
    return finalizeSnapshot(
      next,
      ['Prepared supplier-ready purchase order (wholesale costs only)'],
      undefined,
      [],
      accountContext,
      undefined,
      undefined,
      orderText
    );
  }

  if (toolName === 'save_stock_plan') {
    const planName =
      typeof args.name === 'string' && args.name.trim()
        ? args.name.trim().slice(0, 80)
        : `Saved Plan ${(next.savedPlans?.length || 0) + 1}`;
    const resolved = resolveCategoryGroups(next.categoryGroups || []);
    const hasAnyPieces = resolved.some((r) => r.activeCombo && r.activeCombo.pieces > 0);
    if (!hasAnyPieces) {
      return buildErrorResult(
        snapshot,
        'Select or enter product quantities first before saving a stock plan.',
        accountContext
      );
    }
    const otherEventCosts = (next.stallStock || []).reduce(
      (s, i) => (i.itemType === 'event_cost' ? s + i.cost * i.qty : s),
      0
    );
    const overviewTotals = computeDiversifiedOverviewTotals(
      resolved,
      (next.stallFee || 0) + otherEventCosts,
      next.expectedFootfall || 0
    );
    const saved = createSavedPlanSnapshot(planName, resolved, overviewTotals);
    next.savedPlans = [saved, ...(next.savedPlans || [])].slice(0, 16);
    changes.push(`Saved stock plan "${planName}"`);
    return finalizeSnapshot(next, changes, undefined, [], accountContext, 'combos');
  }

  if (toolName === 'update_purchase_progress') {
    const itemName = typeof args.itemName === 'string' ? args.itemName.trim().toLowerCase() : '';
    const status =
      args.status === 'ordered' || args.status === 'received' || args.status === 'not_ordered'
        ? args.status
        : null;
    if (!itemName || !status) {
      return buildErrorResult(
        snapshot,
        'Specify the product name and status (not_ordered, ordered, or received).',
        accountContext
      );
    }
    let matchedGroup: StockCategoryGroup | undefined;
    let matchedItem: BangleCategory | undefined;
    let matchedQty = 0;
    const resolved = resolveCategoryGroups(next.categoryGroups || []);
    for (const rg of resolved) {
      const idx = rg.group.categories.findIndex(
        (c) =>
          c.name.toLowerCase().includes(itemName) || itemName.includes(c.name.toLowerCase())
      );
      if (idx >= 0) {
        matchedGroup = rg.group;
        matchedItem = rg.group.categories[idx];
        matchedQty = rg.activeCombo?.counts[idx] ?? matchedItem.plannedQty ?? 0;
        break;
      }
    }
    if (!matchedGroup || !matchedItem) {
      return buildErrorResult(
        snapshot,
        `Could not find "${args.itemName}" in your current project products.`,
        accountContext
      );
    }
    const key = makePurchaseItemKey(matchedGroup.id, matchedItem.id);
    const prev = next.purchaseProgress?.[key];
    next.purchaseProgress = {
      ...(next.purchaseProgress || {}),
      [key]: {
        status,
        checked: status === 'received' ? true : prev?.checked ?? false,
        receivedQty: status === 'received' ? Math.max(matchedQty, prev?.receivedQty || 0) : prev?.receivedQty || 0,
        updatedAtMs: Date.now(),
      },
    };
    changes.push(`Marked ${matchedItem.name} as ${status.replace('_', ' ')}`);
    return finalizeSnapshot(next, changes, undefined, [], accountContext, 'categories');
  }

  if (toolName === 'record_actual_sale') {
    const itemName = typeof args.itemName === 'string' ? args.itemName.trim().slice(0, 80) : '';
    const qtySold = Math.max(1, Math.round(Number(args.qtySold) || 1));
    const saleAmount = Math.max(0, Math.round(Number(args.saleAmount) || 0));
    if (!itemName || saleAmount <= 0) {
      return buildErrorResult(
        snapshot,
        'Provide the item name and actual sale amount in ₹ to record a sale.',
        accountContext
      );
    }
    let matchedGroup: StockCategoryGroup | undefined;
    let matchedItem: BangleCategory | undefined;
    for (const g of next.categoryGroups || []) {
      const found = g.categories.find(
        (c) =>
          c.name.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (found) {
        matchedGroup = g;
        matchedItem = found;
        break;
      }
    }
    const record = {
      id: `sale_${Date.now()}`,
      groupId: matchedGroup?.id || 'manual',
      categoryName: matchedGroup?.name || 'General',
      productId: matchedItem?.id || `prod_${Date.now()}`,
      productName: matchedItem?.name || itemName,
      qtySold,
      actualPricePerUnit: Math.round(saleAmount / qtySold),
      unitCost: matchedItem?.cost ?? 0,
      recordedAtMs: Date.now(),
    };
    next.actualSales = [record, ...(next.actualSales || [])].slice(0, 100);
    changes.push(`Recorded actual sale: ${qtySold}x ${record.productName} (₹${saleAmount.toLocaleString('en-IN')})`);
    return finalizeSnapshot(next, changes, undefined, [], accountContext, 'overview_totals');
  }

  if (toolName === 'configure_planner') {
    if (typeof args.budgetCap === 'number' && args.budgetCap < 100) {
      return buildErrorResult(
        snapshot,
        `Budget ₹${args.budgetCap} is too small. Set a category budget of at least ₹100.`,
        accountContext
      );
    }
    if (typeof args.stallFee === 'number' && args.stallFee < 0) {
      return buildErrorResult(snapshot, 'Stall rent cannot be negative.', accountContext);
    }
    if (typeof args.minProfitFloor === 'number' && args.minProfitFloor < 0) {
      return buildErrorResult(snapshot, 'Minimum profit target cannot be negative.', accountContext);
    }

    if (
      typeof args.categoryGroupName === 'string' &&
      args.categoryGroupName.trim() &&
      Array.isArray(next.categoryGroups)
    ) {
      const targetName = args.categoryGroupName.trim();
      const targetLower = targetName.toLowerCase();
      const matched = next.categoryGroups.find(
        (g) =>
          g.name.toLowerCase() === targetLower ||
          g.name.toLowerCase().includes(targetLower) ||
          targetLower.includes(g.name.toLowerCase())
      );

      if (matched) {
        if (matched.id !== next.activeGroupId) {
          next.activeGroupId = matched.id;
          next.budgetCap = matched.budgetCap;
          next.minProfitFloor = matched.minProfitFloor;
          next.maxPerCategory = matched.maxPerCategory;
          next.minColoursRule = matched.minColoursRule;
          next.rules = { ...matched.rules };
          next.categories = matched.categories.map((c) => ({ ...c }));
          next.selectedComboId = matched.selectedComboId;
          next.customQuantities = matched.customQuantities
            ? [...matched.customQuantities]
            : null;
          changes.push(`Category → ${matched.name}`);
        }
      } else if (
        args.createCategoryGroup === true ||
        (Array.isArray(args.categories) && args.categories.length > 0)
      ) {
        const newId = `grp_${Date.now()}`;
        const accent =
          GROUP_ACCENT_COLORS[next.categoryGroups.length % GROUP_ACCENT_COLORS.length];
        const newGroup: StockCategoryGroup = {
          id: newId,
          name: targetName.slice(0, 60),
          accentColor: accent,
          budgetCap:
            typeof args.budgetCap === 'number' && args.budgetCap >= 100
              ? Math.round(args.budgetCap)
              : 3000,
          minProfitFloor:
            typeof args.minProfitFloor === 'number' && args.minProfitFloor >= 0
              ? Math.round(args.minProfitFloor)
              : 2000,
          maxPerCategory:
            typeof args.maxPerCategory === 'number' && args.maxPerCategory >= 1
              ? Math.round(args.maxPerCategory)
              : 6,
          minColoursRule: 0,
          conservativeSellThroughPct: next.globalSellThrough || 90,
          objective: 'best_overall',
          rules: {
            allAtLeastOne: true,
            evenDistribution: false,
            beautyFirst: false,
            maxProfitFocus: false,
            safe90Mode: false,
          },
          categories: [],
          selectedComboId: null,
          customQuantities: null,
        };
        next.categoryGroups.push(newGroup);
        next.activeGroupId = newId;
        next.budgetCap = newGroup.budgetCap;
        next.minProfitFloor = newGroup.minProfitFloor;
        next.maxPerCategory = newGroup.maxPerCategory;
        next.minColoursRule = 0;
        next.rules = { ...newGroup.rules };
        next.categories = [];
        next.selectedComboId = null;
        next.customQuantities = null;
        changes.push(`Created Category → ${newGroup.name}`);
      } else {
        const available = next.categoryGroups.map((g) => g.name).join(', ');
        return buildErrorResult(
          snapshot,
          `Category "${targetName}" was not found (available: ${available}). Ask to create "${targetName}" if you want a new category.`,
          accountContext
        );
      }
    }

    if (typeof args.eventName === 'string' && args.eventName.trim()) {
      next.eventName = args.eventName.trim();
      changes.push(`Event → ${next.eventName}`);
    }
    if (typeof args.eventLocation === 'string' && args.eventLocation.trim()) {
      next.eventLocation = args.eventLocation.trim();
      changes.push(`Location → ${next.eventLocation}`);
    }
    if (typeof args.eventDate === 'string' && args.eventDate.trim()) {
      next.eventDate = args.eventDate.trim();
      changes.push(`Date → ${next.eventDate}`);
    }
    if (typeof args.expectedFootfall === 'number' && args.expectedFootfall >= 10) {
      next.expectedFootfall = Math.round(args.expectedFootfall);
      changes.push(`Expected visitors → ${next.expectedFootfall.toLocaleString('en-IN')}`);
    }

    const budgetChanged = typeof args.budgetCap === 'number' && args.budgetCap >= 100;
    if (budgetChanged) {
      next.budgetCap = Math.round(args.budgetCap as number);
      changes.push(`Budget → ₹${next.budgetCap.toLocaleString('en-IN')}`);
      focusSection = focusSection || 'budget';
    }

    const explicitFloor =
      typeof args.minProfitFloor === 'number' && args.minProfitFloor >= 0;
    if (explicitFloor) {
      next.minProfitFloor = Math.round(args.minProfitFloor as number);
      changes.push(`Min Profit → ₹${next.minProfitFloor.toLocaleString('en-IN')}`);
    }

    if (typeof args.stallFee === 'number' && args.stallFee >= 0) {
      next.stallFee = Math.round(args.stallFee);
      changes.push(`Stall Rent → ₹${next.stallFee.toLocaleString('en-IN')}`);
    }

    if (typeof args.maxPerCategory === 'number' && args.maxPerCategory >= 1) {
      next.maxPerCategory = Math.round(args.maxPerCategory);
      changes.push(`Max/Item → ${next.maxPerCategory}`);
    }

    if (typeof args.minColoursRule === 'number' && args.minColoursRule >= 0) {
      next.minColoursRule = Math.round(args.minColoursRule);
    }

    if (typeof args.objective === 'string' && VALID_OBJECTIVES.has(args.objective as OptimizationObjective)) {
      const obj = args.objective as OptimizationObjective;
      if (Array.isArray(next.categoryGroups)) {
        next.categoryGroups = next.categoryGroups.map((g) =>
          g.id === next.activeGroupId ? { ...g, objective: obj } : g
        );
      }
      next.rules.beautyFirst = obj === 'best_appeal';
      next.rules.maxProfitFocus = obj === 'highest_profit';
      next.rules.safe90Mode = obj === 'conservative_sales';
      changes.push(`Goal → ${obj.replace(/_/g, ' ')}`);
      focusSection = focusSection || 'combos';
    }

    if (typeof args.stallWidthFt === 'number' && args.stallWidthFt >= 2) {
      next.stallSetup = {
        ...(next.stallSetup || { widthFt: 8, depthFt: 6, stallType: 'tabletop' }),
        widthFt: Math.min(60, Math.round(args.stallWidthFt)),
      };
      changes.push(`Stall width → ${next.stallSetup.widthFt} ft`);
    }
    if (typeof args.stallDepthFt === 'number' && args.stallDepthFt >= 2) {
      next.stallSetup = {
        ...(next.stallSetup || { widthFt: 8, depthFt: 6, stallType: 'tabletop' }),
        depthFt: Math.min(60, Math.round(args.stallDepthFt)),
      };
      changes.push(`Stall depth → ${next.stallSetup.depthFt} ft`);
    }
    if (typeof args.stallType === 'string' && VALID_STALL_TYPES.has(args.stallType as StallType)) {
      next.stallSetup = {
        ...(next.stallSetup || { widthFt: 8, depthFt: 6, stallType: 'tabletop' }),
        stallType: args.stallType as StallType,
      };
      changes.push(`Stall type → ${args.stallType.replace(/_/g, ' ')}`);
    }
    if (
      (typeof args.layoutStyle === 'string' &&
        VALID_LAYOUT_STYLES.has(args.layoutStyle as LayoutPresetStyle)) ||
      args.arrangeStallLayout === true
    ) {
      const style: LayoutPresetStyle =
        typeof args.layoutStyle === 'string' &&
        VALID_LAYOUT_STYLES.has(args.layoutStyle as LayoutPresetStyle)
          ? (args.layoutStyle as LayoutPresetStyle)
          : next.stallSetup?.layoutStyle || 'classic_u';
      const catNames = (next.categoryGroups || []).map((g) => g.name);
      next.stallSetup = {
        ...(next.stallSetup || { widthFt: 8, depthFt: 6, stallType: 'tabletop' }),
        layoutStyle: style,
        zoneCategoryOverrides: buildZonesForLayoutStyle(style, catNames),
      };
      changes.push(`Arranged stall layout (${style.replace(/_/g, ' ')})`);
      focusSection = focusSection || 'playbook_layout';
    }

    if (typeof args.globalSellThrough === 'number' && args.globalSellThrough >= 30) {
      const pct = Math.min(100, Math.round(args.globalSellThrough));
      next.globalSellThrough = pct;
      next.stallStock = next.stallStock.map((item) =>
        item.itemType === 'event_cost' ? item : { ...item, sellThrough: pct }
      );
      if (Array.isArray(next.categoryGroups)) {
        next.categoryGroups = next.categoryGroups.map((g) =>
          g.id === next.activeGroupId ? { ...g, conservativeSellThroughPct: pct } : g
        );
      }
      changes.push(`Sell-Through → ${pct}%`);
    }

    if (typeof args.allAtLeastOne === 'boolean') {
      next.rules.allAtLeastOne = args.allAtLeastOne;
    }
    if (typeof args.evenDistribution === 'boolean') {
      next.rules.evenDistribution = args.evenDistribution;
    }
    if (typeof args.beautyFirst === 'boolean') {
      next.rules.beautyFirst = args.beautyFirst;
      if (args.beautyFirst) next.rules.maxProfitFocus = false;
    }
    if (typeof args.maxProfitFocus === 'boolean') {
      next.rules.maxProfitFocus = args.maxProfitFocus;
      if (args.maxProfitFocus) next.rules.beautyFirst = false;
    }
    if (typeof args.safe90Mode === 'boolean') {
      next.rules.safe90Mode = args.safe90Mode;
    }

    if (Array.isArray(args.removeItemNames) && args.removeItemNames.length > 0) {
      const removeKeys = (args.removeItemNames as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().toLowerCase());
      if (removeKeys.length > 0) {
        const remaining = next.categories.filter(
          (c) =>
            !removeKeys.some(
              (k) =>
                c.name.toLowerCase().includes(k) || c.shortName.toLowerCase().includes(k)
            )
        );
        if (remaining.length === 0) {
          return buildErrorResult(
            snapshot,
            'Cannot remove every item from a category. Keep at least 1 product or add replacement products.',
            accountContext
          );
        }
        if (remaining.length < next.categories.length) {
          next.categories = remaining;
          next.customQuantities = null;
          changes.push(`Removed requested product(s)`);
        }
      }
    }

    const incomingCats = Array.isArray(args.categories)
      ? (args.categories as Array<{
          name?: string;
          shortName?: string;
          cost?: number;
          price?: number;
          beauty?: number;
          notes?: string;
        }>)
      : [];

    let categoriesChanged = false;
    if (incomingCats.length > 0) {
      for (const u of incomingCats) {
        if (typeof u.cost === 'number' && u.cost < 0) {
          return buildErrorResult(snapshot, 'Product cost cannot be negative.', accountContext);
        }
        if (typeof u.price === 'number' && u.price < 0) {
          return buildErrorResult(snapshot, 'Selling price cannot be negative.', accountContext);
        }
      }
      categoriesChanged = true;
      if (args.replaceCategories === true || next.categories.length === 0) {
        const built: BangleCategory[] = incomingCats
          .filter((c) => c && typeof c.name === 'string' && c.name.trim())
          .map((c, idx) => {
            const name = c.name!.trim();
            const cost = Math.max(0, Math.round(Number(c.cost) || 0));
            const price =
              typeof c.price === 'number' && c.price > 0 ? Math.round(c.price) : 0;
            const beauty =
              typeof c.beauty === 'number' && c.beauty >= 1
                ? c.beauty <= 5
                  ? fiveScaleToBeauty(c.beauty)
                  : Math.min(10, Math.max(1, Number(c.beauty)))
                : 6;
            const plannedQty =
              typeof (c as { plannedQty?: unknown }).plannedQty === 'number' &&
              Number.isFinite((c as { plannedQty?: number }).plannedQty)
                ? Math.max(0, Math.round((c as { plannedQty: number }).plannedQty))
                : undefined;
            const style = STYLE_POOL[idx % STYLE_POOL.length];
            return {
              id: slugifyId(name, idx + 1),
              name,
              shortName: makeShortName(name, c.shortName),
              cost,
              price,
              beauty,
              ...(plannedQty !== undefined ? { plannedQty } : {}),
              ...(c.notes ? { notes: c.notes.trim().slice(0, 200) } : {}),
              ...style,
            };
          });
        if (built.length >= 1) {
          if (!Array.isArray(next.categoryGroups) || next.categoryGroups.length === 0) {
            const newId = `grp_${Date.now()}`;
            next.categoryGroups = [
              {
                id: newId,
                name:
                  typeof args.categoryGroupName === 'string' && args.categoryGroupName.trim()
                    ? args.categoryGroupName.trim().slice(0, 60)
                    : 'Products',
                accentColor: GROUP_ACCENT_COLORS[0],
                budgetCap: next.budgetCap,
                minProfitFloor: next.minProfitFloor,
                maxPerCategory: next.maxPerCategory,
                minColoursRule: next.minColoursRule,
                conservativeSellThroughPct: next.globalSellThrough || 90,
                objective: 'best_overall',
                rules: { ...next.rules },
                categories: built,
                selectedComboId: null,
                customQuantities: null,
              },
            ];
            next.activeGroupId = newId;
          }
          next.categories = built;
          next.customQuantities = null;
          next.selectedComboId = null;
          changes.push(`Loaded ${built.length} products`);
        }
      } else {
        incomingCats.forEach((u) => {
          if (!u?.name || !u.name.trim()) return;
          const rawName = u.name.trim();
          const key = rawName.toLowerCase();
          const existingIdx = next.categories.findIndex(
            (c) =>
              c.name.toLowerCase() === key ||
              c.shortName.toLowerCase() === key ||
              c.name.toLowerCase().includes(key) ||
              key.includes(c.shortName.toLowerCase())
          );

          if (existingIdx >= 0) {
            const existing = next.categories[existingIdx];
            const cost =
              typeof u.cost === 'number' && u.cost >= 0 ? Math.round(u.cost) : existing.cost;
            const price =
              typeof u.price === 'number' && u.price >= 0 ? Math.round(u.price) : existing.price;
            const beauty =
              typeof u.beauty === 'number' && u.beauty >= 1
                ? u.beauty <= 5
                  ? fiveScaleToBeauty(u.beauty)
                  : Math.min(10, Math.max(1, Number(u.beauty)))
                : existing.beauty;
            const plannedQty =
              typeof (u as { plannedQty?: unknown }).plannedQty === 'number' &&
              Number.isFinite((u as { plannedQty?: number }).plannedQty)
                ? Math.max(0, Math.round((u as { plannedQty: number }).plannedQty))
                : existing.plannedQty;
            next.categories[existingIdx] = {
              ...existing,
              cost,
              price,
              beauty,
              ...(plannedQty !== undefined ? { plannedQty } : {}),
              ...(u.notes ? { notes: u.notes.trim().slice(0, 200) } : {}),
            };
            changes.push(
              `${existing.shortName}: ₹${cost}${price > 0 ? `→₹${price}` : ''}`
            );
          } else {
            const cost = Math.max(0, Math.round(Number(u.cost) || 0));
            const price =
              typeof u.price === 'number' && u.price > 0 ? Math.round(u.price) : 0;
            const beauty =
              typeof u.beauty === 'number' && u.beauty >= 1
                ? u.beauty <= 5
                  ? fiveScaleToBeauty(u.beauty)
                  : Math.min(10, Math.max(1, Number(u.beauty)))
                : 6;
            const plannedQty =
              typeof (u as { plannedQty?: unknown }).plannedQty === 'number' &&
              Number.isFinite((u as { plannedQty?: number }).plannedQty)
                ? Math.max(0, Math.round((u as { plannedQty: number }).plannedQty))
                : undefined;
            const style = STYLE_POOL[next.categories.length % STYLE_POOL.length];
            const added: BangleCategory = {
              id: slugifyId(rawName, next.categories.length + 1),
              name: rawName,
              shortName: makeShortName(rawName, u.shortName),
              cost,
              price,
              beauty,
              ...(plannedQty !== undefined ? { plannedQty } : {}),
              ...(u.notes ? { notes: u.notes.trim().slice(0, 200) } : {}),
              ...style,
            };
            next.categories.push(added);
            next.customQuantities = null;
            changes.push(
              `Added ${added.name} (₹${cost}${price > 0 ? `→₹${price}` : ''})`
            );
          }
        });
      }
      focusSection = focusSection || 'categories';
    }

    if (
      (budgetChanged || categoriesChanged || args.replaceCategories === true) &&
      !explicitFloor &&
      next.categories.length > 0
    ) {
      const avgRoi =
        next.categories.reduce(
          (acc, c) => acc + (c.price - c.cost) / Math.max(1, c.cost),
          0
        ) / Math.max(1, next.categories.length);
      const targetFloor = Math.max(
        100,
        Math.round(next.budgetCap * Math.min(1.05, Math.max(0.35, avgRoi * 0.7)))
      );
      next.minProfitFloor = targetFloor;
      changes.push(`Auto Profit Target → ₹${targetFloor.toLocaleString('en-IN')}`);

      const { combos: testCombos } = generateStockCombinationsWithMeta(
        next.categories,
        {
          budgetCap: next.budgetCap,
          minProfitFloor: next.minProfitFloor,
          maxPerCategory: next.maxPerCategory,
          minColoursRule: next.minColoursRule,
        },
        next.rules,
        5
      );
      if (testCombos.length === 0) {
        next.minProfitFloor = Math.max(50, Math.round(next.budgetCap * 0.25));
      }
    }

    if (Array.isArray(args.customQuantities) && args.customQuantities.length > 0) {
      const baseCounts = new Array(next.categories.length).fill(0);
      (args.customQuantities as Array<{ name?: string; qty?: number }>).forEach((entry) => {
        if (!entry?.name) return;
        const k = entry.name.toLowerCase();
        const idx = next.categories.findIndex(
          (c) =>
            c.name.toLowerCase().includes(k) ||
            c.shortName.toLowerCase().includes(k) ||
            k.includes(c.shortName.toLowerCase())
        );
        if (idx >= 0) {
          baseCounts[idx] = Math.max(0, Math.round(Number(entry.qty) || 0));
        }
      });
      next.customQuantities = baseCounts;
      changes.push('Applied custom quantities');
      focusSection = focusSection || 'combos';
    } else if (typeof args.selectComboRank === 'number') {
      const rank = Math.round(args.selectComboRank);
      if (rank < 1 || rank > 30) {
        return buildErrorResult(
          snapshot,
          `Combination rank #${rank} is out of range. Choose an option between #1 and #30.`,
          accountContext
        );
      }
      next.customQuantities = null;
      changes.push(`Selected combination #${rank}`);
      focusSection = focusSection || 'combos';
    }

    if (
      args.navigateToTab === 'optimizer' ||
      args.navigateToTab === 'overview' ||
      args.navigateToTab === 'calculator' ||
      args.navigateToTab === 'strategies' ||
      args.navigateToTab === 'research'
    ) {
      next.activeTab =
        args.navigateToTab === 'calculator' ? 'overview' : (args.navigateToTab as AppTab);
      changes.push(`Opened ${next.activeTab}`);
      if (!hasExplicitFocus) {
        focusSection = defaultFocusForTab(next.activeTab);
      }
    }

    return finalizeSnapshot(
      next,
      changes,
      typeof args.selectComboRank === 'number' ? args.selectComboRank : undefined,
      [],
      accountContext,
      focusSection,
      confirmation
    );
  }

  if (toolName === 'manage_inventory_stock') {
    if (typeof args.stallFee === 'number' && args.stallFee < 0) {
      return buildErrorResult(snapshot, 'Stall rent cannot be negative.', accountContext);
    }
    if (typeof args.stallFee === 'number' && args.stallFee >= 0) {
      next.stallFee = Math.round(args.stallFee);
      changes.push(`Stall Fee → ₹${next.stallFee.toLocaleString('en-IN')}`);
      focusSection = focusSection || 'overview_costs';
    }
    if (typeof args.expectedFootfall === 'number' && args.expectedFootfall >= 10) {
      next.expectedFootfall = Math.round(args.expectedFootfall);
      changes.push(`Expected visitors → ${next.expectedFootfall.toLocaleString('en-IN')}`);
    }
    if (typeof args.globalSellThrough === 'number' && args.globalSellThrough >= 30) {
      const pct = Math.min(100, Math.round(args.globalSellThrough));
      next.globalSellThrough = pct;
      next.stallStock = next.stallStock.map((item) =>
        item.itemType === 'event_cost' ? item : { ...item, sellThrough: pct }
      );
      changes.push(`Sell-Through → ${pct}%`);
    }

    if (typeof args.activeMixLotQty === 'number' && args.activeMixLotQty >= 0) {
      const lotQty = Math.round(args.activeMixLotQty);
      next.stallStock = next.stallStock.map((item) =>
        item.isSyncedBundle && item.itemType !== 'event_cost'
          ? { ...item, qty: lotQty }
          : item
      );
      changes.push(`Mix Lot Qty → ${lotQty}`);
      focusSection = focusSection || 'overview_totals';
    }

    if (args.replaceStock === true) {
      const keep = next.stallStock.filter(
        (s) => s.isSyncedBundle || s.itemType === 'event_cost'
      );
      next.stallStock = keep;
      changes.push('Replaced manual stall stock rows');
    }

    if (Array.isArray(args.eventCosts)) {
      (
        args.eventCosts as Array<{ name?: string; cost?: number; remove?: boolean }>
      ).forEach((entry, idx) => {
        if (!entry?.name || !entry.name.trim()) return;
        const name = entry.name.trim();
        const key = name.toLowerCase();
        const existingIdx = next.stallStock.findIndex(
          (s) => s.itemType === 'event_cost' && s.name.toLowerCase().includes(key)
        );
        if (entry.remove) {
          if (existingIdx >= 0) {
            const removedName = next.stallStock[existingIdx].name;
            next.stallStock.splice(existingIdx, 1);
            changes.push(`Removed event expense: ${removedName}`);
          }
          return;
        }
        const cost = Math.max(0, Math.round(Number(entry.cost) || 0));
        if (existingIdx >= 0) {
          next.stallStock[existingIdx] = {
            ...next.stallStock[existingIdx],
            cost,
          };
          changes.push(`Updated ${next.stallStock[existingIdx].name} → ₹${cost}`);
        } else {
          next.stallStock.push({
            id: `exp_${Date.now()}_${idx}`,
            name,
            category: 'Event Cost',
            cost,
            price: 0,
            qty: 1,
            sellThrough: 0,
            isSyncedBundle: false,
            itemType: 'event_cost',
          });
          changes.push(`Added event expense: ${name} (₹${cost})`);
        }
      });
      focusSection = focusSection || 'overview_costs';
    }

    if (Array.isArray(args.removeItemNames)) {
      const removeKeys = (args.removeItemNames as unknown[])
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().toLowerCase());
      if (removeKeys.length > 0) {
        const before = next.stallStock.length;
        next.stallStock = next.stallStock.filter(
          (item) =>
            item.isSyncedBundle || !removeKeys.some((k) => item.name.toLowerCase().includes(k))
        );
        if (next.stallStock.length < before) {
          changes.push(`Removed ${before - next.stallStock.length} item(s)`);
        }
      }
    }

    if (Array.isArray(args.items)) {
      (
        args.items as Array<{
          name?: string;
          category?: string;
          cost?: number;
          price?: number;
          qty?: number;
          sellThrough?: number;
        }>
      ).forEach((entry, idx) => {
        if (!entry?.name || !entry.name.trim()) return;
        const name = entry.name.trim();
        const key = name.toLowerCase();
        const existingIdx = next.stallStock.findIndex(
          (s) =>
            !s.isSyncedBundle &&
            s.itemType !== 'event_cost' &&
            s.name.toLowerCase().includes(key)
        );
        const cost = Math.max(0, Math.round(Number(entry.cost) || 60));
        const price =
          typeof entry.price === 'number' && entry.price > 0
            ? Math.round(entry.price)
            : estimateRetailPrice(cost);
        const qty = Math.max(1, Math.round(Number(entry.qty) || 20));
        const sellThrough =
          typeof entry.sellThrough === 'number'
            ? Math.min(100, Math.max(20, Math.round(entry.sellThrough)))
            : next.globalSellThrough;

        if (existingIdx >= 0) {
          const prev = next.stallStock[existingIdx];
          next.stallStock[existingIdx] = {
            ...prev,
            category: entry.category || prev.category,
            cost: typeof entry.cost === 'number' ? cost : prev.cost,
            price: typeof entry.price === 'number' ? price : prev.price,
            qty: typeof entry.qty === 'number' ? qty : prev.qty,
            sellThrough:
              typeof entry.sellThrough === 'number' ? sellThrough : prev.sellThrough,
          };
          changes.push(`Updated ${prev.name}`);
        } else {
          const row: StallStockItem = {
            id: `ai_stock_${Date.now()}_${idx}`,
            name,
            category: entry.category || 'Accessories',
            cost,
            price,
            qty,
            sellThrough,
            isSyncedBundle: false,
            itemType: 'stock',
          };
          next.stallStock.push(row);
          changes.push(`Added ${qty}x ${name} (₹${cost}→₹${price})`);
        }
      });
      focusSection = focusSection || 'overview_totals';
    }

    if (
      args.navigateToTab === 'optimizer' ||
      args.navigateToTab === 'overview' ||
      args.navigateToTab === 'calculator' ||
      args.navigateToTab === 'strategies' ||
      args.navigateToTab === 'research'
    ) {
      next.activeTab =
        args.navigateToTab === 'calculator' ? 'overview' : (args.navigateToTab as AppTab);
      changes.push(`Opened ${next.activeTab}`);
      if (!hasExplicitFocus) {
        focusSection = defaultFocusForTab(next.activeTab);
      }
    }

    return finalizeSnapshot(
      next,
      changes,
      undefined,
      [],
      accountContext,
      focusSection,
      confirmation
    );
  }

  return finalizeSnapshot(next, changes, undefined, [], accountContext, focusSection);
}

export interface LocalAiCommandOutcome {
  ok: boolean;
  updatedState: PlannerSnapshot | null;
  changes: string[];
  focusSection?: AiFocusSection;
  orderCopyText?: string;
  clarification?: string;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationReason?: string;
}

function parseNaturalProductItems(rawText: string): {
  defaultCategoryName?: string;
  items: Array<{
    name: string;
    purchaseCost: number;
    sellingPrice?: number;
    quantity?: number;
    appealRating?: number;
  }>;
} {
  let defaultCategoryName: string | undefined;
  const catWithWord = rawText.match(
    /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?category\s+(?:called|named)?\s*["']?([a-zA-Z0-9\s&/-]{2,40}?)["']?(?=\s+(?:and|with|then|&)\b|[.,;]|$)/i
  );
  const catShort = !catWithWord
    ? rawText.match(
        /^\s*(?:create|make)\s+([a-zA-Z0-9\s/-]{2,40}?)\s*(?:&|and)\s+(?=add|include|put|\d)/i
      )
    : null;
  if (catWithWord) {
    defaultCategoryName = catWithWord[1].trim();
  } else if (catShort) {
    defaultCategoryName = catShort[1].trim();
  }

  const globalAppealMatch = rawText.match(
    /(?:visual\s+appeal|beauty|appeal)(?:\s+rating)?\s*(?:is|of|=|at)?\s*(\d+(?:\.\d+)?)(?:\s*(?:out\s+of|\/)\s*5)?/i
  );
  const globalAppeal = globalAppealMatch ? Number(globalAppealMatch[1]) : undefined;

  const items: Array<{
    name: string;
    purchaseCost: number;
    sellingPrice?: number;
    quantity?: number;
    appealRating?: number;
  }> = [];

  // Strip category prefix and trailing appeal sentence before splitting products
  const bodyText = rawText
    .replace(
      /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?category\s+(?:called|named)?\s*["']?[a-zA-Z0-9\s&/-]{2,40}?["']?\s*(?:(?:and|&|with|then)\s+)?/i,
      ''
    )
    .replace(
      /^\s*(?:create|make)\s+[a-zA-Z0-9\s/-]{2,40}?\s*(?:&|and)\s+/i,
      ''
    )
    .replace(
      /(?:,\s*|\.\s*)(?:i\s+think\s+)?(?:their|its|the)?\s*(?:visual\s+)?(?:appeal|beauty)(?:\s+rating)?\s*(?:is|of|=|at)?\s*\d+(?:\.\d+)?(?:\s*(?:out\s+of|\/)\s*5)?\s*$/i,
      ''
    );

  const segments = bodyText
    .split(/(?:,\s*(?:and\s+)?|\s+(?:and|&)\s+(?=(?:add\s+)?\d+\s+)|;\s*)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const cleaned = seg.replace(/^(?:please\s+)?(?:add|include|put)\s+/i, '').trim();
    const m = cleaned.match(
      /^(\d+)\s+([a-zA-Z0-9\s&-]{2,55}?)\s+(?:at\s+(?:a\s+)?(?:purchase\s+|wholesale\s+)?(?:cost\s+of\s+)?|cost(?:ing)?\s+|for\s+|@\s*)(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|inr)?(?:\s*(?:each|per\s+piece|\/pc))?(.*)$/i
    );
    if (m) {
      const qty = Number(m[1]);
      const name = m[2]
        .trim()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      const purchaseCost = Number(m[3]);
      const rest = m[4] || '';
      const sellM = rest.match(/(?:sell(?:ing)?(?:\s+price)?|retail|price)\s*(?:of|at|is|=)?\s*(?:₹|rs\.?\s*)?(\d+)/i);
      const appM = rest.match(/(?:appeal|beauty)\s*(?:is|of|=|at)?\s*(\d+(?:\.\d+)?)/i);
      items.push({
        name,
        purchaseCost,
        quantity: qty,
        ...(sellM ? { sellingPrice: Number(sellM[1]) } : {}),
        ...(appM
          ? { appealRating: Number(appM[1]) }
          : globalAppeal !== undefined
            ? { appealRating: globalAppeal }
            : {}),
      });
    }
  }

  return { defaultCategoryName, items };
}

export function executeLocalAiCommand(
  rawText: string,
  snapshot: PlannerSnapshot,
  accountContext?: AccountAiContext
): LocalAiCommandOutcome {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: false,
      updatedState: null,
      changes: [],
      clarification: 'What would you like me to add or update?',
    };
  }

  const lower = trimmed.toLowerCase();

  // Check for supplier order copy intent
  if (/\b(copy|prepare|generate|show|export)\b.*\b(supplier\s+order|purchase\s+order|full\s+order|order\s+list|order)\b/.test(lower)) {
    const orderRes = applyAiToolAction(
      snapshot,
      'get_supplier_order',
      { scope: lower.includes('full') || lower.includes('all') ? 'full_order' : 'active_category' },
      accountContext
    );
    return {
      ok: orderRes.ok,
      updatedState: null,
      changes: orderRes.changes,
      orderCopyText: orderRes.orderCopyText,
      error: orderRes.error,
    };
  }

  // Check for natural-language multi-product / category creation intent
  const naturalParsed = parseNaturalProductItems(trimmed);
  if (naturalParsed.items.length > 0) {
    const addRes = applyAiToolAction(
      snapshot,
      'add_products_to_inventory',
      {
        ...(naturalParsed.defaultCategoryName
          ? { defaultCategoryName: naturalParsed.defaultCategoryName }
          : {}),
        items: naturalParsed.items,
      },
      accountContext
    );
    return {
      ok: addRes.ok,
      updatedState: addRes.ok ? addRes.nextState : null,
      changes: addRes.changes,
      focusSection: addRes.focusSection,
      error: addRes.error,
    };
  }

  const matchedGroup = snapshot.categoryGroups?.find((g) => {
    const gLower = g.name.trim().toLowerCase();
    return gLower.length > 0 && lower.includes(gLower);
  });

  const targetCategories = matchedGroup ? matchedGroup.categories : snapshot.categories;
  const parsed = parseLocalRawCommand(trimmed, targetCategories, snapshot.globalSellThrough);

  const negativeStallMatch = lower.match(/(?:stall|event)\s*(?:fee|cost|rent)?\s*(?:is|to|=)?\s*-\s*\d+/);
  if (negativeStallMatch) {
    return {
      ok: false,
      updatedState: null,
      changes: [],
      error: 'Stall rent cannot be negative.',
    };
  }

  const smallBudgetMatch = lower.match(/budget\s*(?:of|is|to|=)?\s*₹?\s*(\d{1,2})\b/);
  if (smallBudgetMatch && Number(smallBudgetMatch[1]) < 100) {
    return {
      ok: false,
      updatedState: null,
      changes: [],
      error: `Budget ₹${smallBudgetMatch[1]} is too small. Set a category budget of at least ₹100.`,
    };
  }

  let current = snapshot;
  const allChanges: string[] = [];
  let focusSection: AiFocusSection | undefined;
  let requiresConfirmation = false;
  let confirmationReason: string | undefined;

  const wantsStallArrange =
    /\b(arrange|layout|display|setup)\b/.test(lower) &&
    /\b(stall|booth|table|zone)\b/.test(lower);

  const hasPlannerUpdates =
    Boolean(matchedGroup && matchedGroup.id !== snapshot.activeGroupId) ||
    typeof parsed.budgetCap === 'number' ||
    typeof parsed.minProfitFloor === 'number' ||
    typeof parsed.stallFee === 'number' ||
    typeof parsed.expectedFootfall === 'number' ||
    typeof parsed.maxPerCategory === 'number' ||
    typeof parsed.minColoursRule === 'number' ||
    Boolean(parsed.objective) ||
    Object.keys(parsed.ruleUpdates).length > 0 ||
    parsed.categoryUpdates.length > 0 ||
    typeof parsed.selectComboRank === 'number' ||
    Boolean(parsed.navigateToTab) ||
    wantsStallArrange;

  if (hasPlannerUpdates) {
    const plannerArgs: Record<string, unknown> = {
      ...(matchedGroup ? { categoryGroupName: matchedGroup.name } : {}),
      ...(typeof parsed.budgetCap === 'number' ? { budgetCap: parsed.budgetCap } : {}),
      ...(typeof parsed.minProfitFloor === 'number'
        ? { minProfitFloor: parsed.minProfitFloor }
        : {}),
      ...(typeof parsed.stallFee === 'number' ? { stallFee: parsed.stallFee } : {}),
      ...(typeof parsed.expectedFootfall === 'number'
        ? { expectedFootfall: parsed.expectedFootfall }
        : {}),
      ...(typeof parsed.maxPerCategory === 'number'
        ? { maxPerCategory: parsed.maxPerCategory }
        : {}),
      ...(typeof parsed.minColoursRule === 'number'
        ? { minColoursRule: parsed.minColoursRule }
        : {}),
      ...(parsed.objective ? { objective: parsed.objective } : {}),
      ...parsed.ruleUpdates,
      ...(typeof parsed.selectComboRank === 'number'
        ? { selectComboRank: parsed.selectComboRank }
        : {}),
      ...(wantsStallArrange
        ? {
            arrangeStallLayout: true,
            navigateToTab: parsed.navigateToTab || 'strategies',
          }
        : parsed.navigateToTab
        ? { navigateToTab: parsed.navigateToTab }
        : {}),
    };

    if (parsed.categoryUpdates.length > 0) {
      plannerArgs.categories = parsed.categoryUpdates
        .map((u) => {
          const cat = targetCategories.find((c) => c.id === u.id);
          if (!cat) return null;
          return {
            name: cat.name,
            ...(typeof u.cost === 'number' ? { cost: u.cost } : {}),
            ...(typeof u.price === 'number' ? { price: u.price } : {}),
            ...(typeof u.beauty === 'number' ? { beauty: u.beauty } : {}),
          };
        })
        .filter(Boolean);
    }

    const res = applyAiToolAction(current, 'configure_planner', plannerArgs, accountContext);
    if (!res.ok) {
      return {
        ok: false,
        updatedState: null,
        changes: [],
        error: res.error || 'Could not apply requested update.',
      };
    }
    current = res.nextState;
    allChanges.push(...res.changes);
    if (res.focusSection) focusSection = res.focusSection;
    if (res.requiresConfirmation) {
      requiresConfirmation = true;
      confirmationReason = res.confirmationReason;
    }
  }

  const hasStockUpdates =
    parsed.stockAdditions.length > 0 ||
    (Array.isArray(parsed.eventCostAdditions) && parsed.eventCostAdditions.length > 0);

  if (hasStockUpdates) {
    const stockRes = applyAiToolAction(
      current,
      'manage_inventory_stock',
      {
        ...(parsed.stockAdditions.length > 0
          ? {
              items: parsed.stockAdditions.map((s) => ({
                name: s.name,
                category: s.category,
                cost: s.cost,
                price: s.price,
                qty: s.qty,
                sellThrough: s.sellThrough,
              })),
            }
          : {}),
        ...(parsed.eventCostAdditions && parsed.eventCostAdditions.length > 0
          ? { eventCosts: parsed.eventCostAdditions }
          : {}),
      },
      accountContext
    );
    if (!stockRes.ok) {
      return {
        ok: false,
        updatedState: null,
        changes: [],
        error: stockRes.error || 'Could not update stock or event expenses.',
      };
    }
    current = stockRes.nextState;
    allChanges.push(...stockRes.changes);
    if (stockRes.focusSection) focusSection = stockRes.focusSection;
    if (stockRes.requiresConfirmation) {
      requiresConfirmation = true;
      confirmationReason = stockRes.confirmationReason;
    }
  }

  if (allChanges.length === 0) {
    return {
      ok: false,
      updatedState: null,
      changes: [],
      clarification:
        'Which category budget, product price, event expense, or section should I update? (e.g., "Budget 4500 and open overview")',
    };
  }

  return {
    ok: true,
    updatedState: current,
    changes: allChanges,
    focusSection,
    requiresConfirmation,
    confirmationReason,
  };
}
