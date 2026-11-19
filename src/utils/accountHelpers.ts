import {
  EXTRA_CATEGORY_STYLES,
  GROUP_ACCENT_COLORS,
  INITIAL_CATEGORIES,
  INITIAL_CATEGORY_GROUPS,
} from '../data/defaults';
import type {
  ActualSaleRecord,
  AiMemoryCategory,
  AppTab,
  BangleCategory,
  CoachConversation,
  MarketResearchRecord,
  OptimizationObjective,
  OptimizerRules,
  PlannerSnapshot,
  ProjectMetadata,
  PurchaseItemProgress,
  SavedStockPlan,
  StallSetupPlan,
  StallStockItem,
  StallType,
  StockCategoryGroup,
  UserProfile,
} from '../types/stall';
import {
  sanitizeActualSales,
  sanitizeConversations,
  sanitizeProjectMeta,
  sanitizePurchaseProgress,
  sanitizeSavedPlans,
} from './orderAndProjectEngine';

export const BLUEPRINT_LIMITS = {
  MAX_UID_LEN: 128,
  MAX_EMAIL_LEN: 254,
  MAX_DISPLAY_NAME_LEN: 120,
  MAX_PREFERRED_NAME_LEN: 80,
  MAX_PHOTO_URL_LEN: 512,
  MAX_BUSINESS_NAME_LEN: 120,
  MAX_PREFERRED_SCALE_LEN: 60,
  MAX_EVENT_NAME_LEN: 120,
  MAX_EVENT_LOCATION_LEN: 120,
  MAX_EVENT_DATE_LEN: 40,
  MIN_FACT_LEN: 2,
  MAX_FACT_LEN: 500,
  MAX_CATEGORIES: 25,
  MAX_CATEGORY_GROUPS: 20,
  MAX_GROUP_NAME_LEN: 80,
  MAX_STALL_STOCK: 60,
  MAX_COMBO_ID_LEN: 128,
  MAX_RESEARCH_RECORDS: 12,
} as const;

export const VALID_TABS = new Set<AppTab>([
  'overview',
  'sell',
  'optimizer',
  'strategies',
  'research',
  'calculator',
]);

export const VALID_OBJECTIVES = new Set<OptimizationObjective>([
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

const VALID_MEMORY_CATEGORIES = new Set<AiMemoryCategory>([
  'inventory',
  'pricing',
  'event',
  'preference',
  'strategy',
]);

export const DEFAULT_STALL_SETUP: StallSetupPlan = {
  widthFt: 8,
  depthFt: 6,
  stallType: 'tabletop',
  layoutNotes: '',
};

export function clampStr(val: string | null | undefined, max: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback.trim();
  return s.slice(0, max);
}

export function clampNum(val: number, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeMemoryCategory(raw?: string): AiMemoryCategory {
  if (raw && VALID_MEMORY_CATEGORIES.has(raw as AiMemoryCategory)) {
    return raw as AiMemoryCategory;
  }
  return 'preference';
}

export function normalizeObjective(raw?: string): OptimizationObjective {
  if (raw && VALID_OBJECTIVES.has(raw as OptimizationObjective)) {
    return raw as OptimizationObjective;
  }
  return 'best_overall';
}

export function resolvePreferredName(
  profile: Pick<UserProfile, 'preferredName' | 'displayName'> | null | undefined
): string {
  const pref = profile?.preferredName?.trim();
  if (pref) return pref;
  const first = profile?.displayName?.trim().split(/\s+/)[0];
  return first || 'Merchant';
}

export function sanitizeRules(raw?: Partial<OptimizerRules> | null): OptimizerRules {
  return {
    allAtLeastOne: typeof raw?.allAtLeastOne === 'boolean' ? raw.allAtLeastOne : true,
    evenDistribution: typeof raw?.evenDistribution === 'boolean' ? raw.evenDistribution : true,
    beautyFirst: Boolean(raw?.beautyFirst),
    maxProfitFocus: Boolean(raw?.maxProfitFocus) && !Boolean(raw?.beautyFirst),
    safe90Mode: Boolean(raw?.safe90Mode),
  };
}

export function sanitizeStallSetup(raw?: Partial<StallSetupPlan> | null): StallSetupPlan {
  const stallType: StallType =
    raw?.stallType && VALID_STALL_TYPES.has(raw.stallType) ? raw.stallType : 'tabletop';
  const clean: StallSetupPlan = {
    widthFt: clampNum(raw?.widthFt ?? 8, 2, 60, 8),
    depthFt: clampNum(raw?.depthFt ?? 6, 2, 60, 6),
    stallType,
    layoutNotes: clampStr(raw?.layoutNotes, 400, ''),
  };
  if (
    raw?.layoutStyle === 'classic_u' ||
    raw?.layoutStyle === 'open_gallery' ||
    raw?.layoutStyle === 'counter_focus'
  ) {
    clean.layoutStyle = raw.layoutStyle;
  }
  if (raw?.zoneCategoryOverrides && typeof raw.zoneCategoryOverrides === 'object') {
    const cleanOverrides: Partial<Record<'front_left' | 'center_tray' | 'right_mirror' | 'back_riser', string[]>> = {};
    (['front_left', 'center_tray', 'right_mirror', 'back_riser'] as const).forEach((zone) => {
      const list = raw.zoneCategoryOverrides?.[zone];
      if (Array.isArray(list)) {
        cleanOverrides[zone] = list
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .slice(0, 10)
          .map((x) => x.trim().slice(0, 80));
      }
    });
    if (Object.keys(cleanOverrides).length > 0) {
      clean.zoneCategoryOverrides = cleanOverrides;
    }
  }
  if (Array.isArray(raw?.savedLayouts) && raw.savedLayouts.length > 0) {
    const layouts = raw.savedLayouts
      .filter((l) => l && typeof l === 'object' && typeof l.name === 'string' && l.name.trim())
      .slice(0, 8)
      .map((l, idx) => {
        const zOverrides: Partial<Record<'front_left' | 'center_tray' | 'right_mirror' | 'back_riser', string[]>> = {};
        if (l.zoneCategoryOverrides && typeof l.zoneCategoryOverrides === 'object') {
          (['front_left', 'center_tray', 'right_mirror', 'back_riser'] as const).forEach((z) => {
            const arr = l.zoneCategoryOverrides?.[z];
            if (Array.isArray(arr)) {
              zOverrides[z] = arr
                .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                .slice(0, 10)
                .map((x) => x.trim().slice(0, 80));
            }
          });
        }
        return {
          id: clampStr(l.id, 64, `layout_${idx + 1}`) || `layout_${idx + 1}`,
          name: clampStr(l.name, 80, `Layout ${idx + 1}`) || `Layout ${idx + 1}`,
          widthFt: clampNum(l.widthFt ?? 8, 2, 60, 8),
          depthFt: clampNum(l.depthFt ?? 6, 2, 60, 6),
          stallType:
            l.stallType && VALID_STALL_TYPES.has(l.stallType) ? l.stallType : ('tabletop' as StallType),
          layoutStyle:
            l.layoutStyle === 'open_gallery' || l.layoutStyle === 'counter_focus'
              ? l.layoutStyle
              : ('classic_u' as const),
          zoneCategoryOverrides: zOverrides,
          savedAtMs:
            typeof l.savedAtMs === 'number' && Number.isFinite(l.savedAtMs)
              ? l.savedAtMs
              : Date.now(),
        };
      });
    if (layouts.length > 0) clean.savedLayouts = layouts;
  }
  if (raw?.dailyTracker && typeof raw.dailyTracker === 'object') {
    const dt = raw.dailyTracker;
    const cleanTracker: NonNullable<StallSetupPlan['dailyTracker']> = {
      sellingDays: Math.round(clampNum(dt.sellingDays ?? 2, 1, 30, 2)),
    };
    if (typeof dt.actualRevenueEntered === 'number' && Number.isFinite(dt.actualRevenueEntered) && dt.actualRevenueEntered >= 0) {
      cleanTracker.actualRevenueEntered = Math.round(clampNum(dt.actualRevenueEntered, 0, 100000000, 0));
    }
    if (typeof dt.actualPiecesEntered === 'number' && Number.isFinite(dt.actualPiecesEntered) && dt.actualPiecesEntered >= 0) {
      cleanTracker.actualPiecesEntered = Math.round(clampNum(dt.actualPiecesEntered, 0, 1000000, 0));
    }
    clean.dailyTracker = cleanTracker;
  }
  return clean;
}

export function sanitizeMarketResearch(
  raw?: MarketResearchRecord[] | null
): MarketResearchRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object' && typeof r.query === 'string' && r.query.trim())
    .slice(0, BLUEPRINT_LIMITS.MAX_RESEARCH_RECORDS)
    .map((r, idx) => {
      const clean: MarketResearchRecord = {
        id: clampStr(r.id, 64, `res_${idx + 1}`) || `res_${idx + 1}`,
        query: clampStr(r.query, 240, 'Market research'),
        topic: clampStr(r.topic, 80, 'General'),
        createdAtMs:
          typeof r.createdAtMs === 'number' && Number.isFinite(r.createdAtMs)
            ? r.createdAtMs
            : Date.now(),
        retrievedDate: clampStr(r.retrievedDate, 40, new Date().toISOString().slice(0, 10)),
        grounded: Boolean(r.grounded),
        summary: clampStr(r.summary, 1200, ''),
        verifiedFacts: Array.isArray(r.verifiedFacts)
          ? r.verifiedFacts
              .filter((f) => f && typeof f.claim === 'string' && typeof f.sourceUrl === 'string')
              .slice(0, 8)
              .map((f) => ({
                claim: clampStr(f.claim, 320, ''),
                sourceTitle: clampStr(f.sourceTitle, 140, 'Source'),
                sourceUrl: clampStr(f.sourceUrl, 512, ''),
                ...(typeof f.dateNote === 'string' && f.dateNote.trim()
                  ? { dateNote: clampStr(f.dateNote, 60) }
                  : {}),
              }))
          : [],
        interpretation: Array.isArray(r.interpretation)
          ? r.interpretation
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .slice(0, 6)
              .map((x) => x.trim().slice(0, 320))
          : [],
        hypothesesToValidate: Array.isArray(r.hypothesesToValidate)
          ? r.hypothesesToValidate
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .slice(0, 6)
              .map((x) => x.trim().slice(0, 280))
          : [],
        checklist: Array.isArray(r.checklist)
          ? r.checklist
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .slice(0, 8)
              .map((x) => x.trim().slice(0, 240))
          : [],
        sources: Array.isArray(r.sources)
          ? r.sources
              .filter((s) => s && typeof s.uri === 'string' && s.uri.startsWith('http'))
              .slice(0, 8)
              .map((s) => ({
                title: clampStr(s.title, 140, 'Web Source'),
                uri: clampStr(s.uri, 512, ''),
              }))
          : [],
      };
      if (typeof r.fallbackReason === 'string' && r.fallbackReason.trim()) {
        clean.fallbackReason = clampStr(r.fallbackReason, 280);
      }
      return clean;
    });
}

export function sanitizeCategories(cats: BangleCategory[] | undefined | null): BangleCategory[] {
  if (!Array.isArray(cats) || cats.length === 0) return [];
  const pool = [
    ...INITIAL_CATEGORIES.map(({ barColor, textClass, bgClass }) => ({ barColor, textClass, bgClass })),
    ...EXTRA_CATEGORY_STYLES,
  ];
  return cats.slice(0, BLUEPRINT_LIMITS.MAX_CATEGORIES).map((c, idx) => {
    const style = pool[idx % pool.length];
    const hasMin = typeof c?.priceMin === 'number' && Number.isFinite(c.priceMin) && c.priceMin >= 0;
    const hasMax = typeof c?.priceMax === 'number' && Number.isFinite(c.priceMax) && c.priceMax >= 0;
    const priceMin = hasMin ? clampNum(c!.priceMin as number, 0, 10000000, 0) : null;
    const priceMax = hasMax ? clampNum(c!.priceMax as number, priceMin ?? 0, 10000000, priceMin ?? 0) : null;
    const minQty =
      typeof c?.minQty === 'number' && Number.isFinite(c.minQty) && c.minQty >= 0
        ? Math.floor(clampNum(c.minQty, 0, 10000, 0))
        : null;
    const maxQty =
      typeof c?.maxQty === 'number' && Number.isFinite(c.maxQty) && c.maxQty >= 0
        ? Math.floor(clampNum(c.maxQty, minQty ?? 0, 10000, minQty ?? 0))
        : null;
    const plannedQty =
      typeof c?.plannedQty === 'number' && Number.isFinite(c.plannedQty) && c.plannedQty >= 0
        ? Math.floor(clampNum(c.plannedQty, 0, 100000, 0))
        : null;

    const clean: BangleCategory = {
      id: clampStr(c?.id, 64, `cat_${idx + 1}`) || `cat_${idx + 1}`,
      name: clampStr(c?.name, 80, `Product ${idx + 1}`) || `Product ${idx + 1}`,
      shortName: clampStr(c?.shortName, 30, `Item ${idx + 1}`) || `Item ${idx + 1}`,
      cost: clampNum(c?.cost ?? 0, 0, 10000000, 0),
      price: typeof c?.price === 'number' && Number.isFinite(c.price) ? clampNum(c.price, 0, 10000000, 0) : 0,
      beauty: clampNum(c?.beauty ?? 6, 1, 10, 6),
      barColor: clampStr(c?.barColor, 32, style.barColor) || style.barColor,
      textClass: clampStr(c?.textClass, 64, style.textClass) || style.textClass,
      bgClass: clampStr(c?.bgClass, 64, style.bgClass) || style.bgClass,
    };
    if (plannedQty !== null) clean.plannedQty = plannedQty;
    if (priceMin !== null && priceMax !== null && priceMax >= priceMin && priceMax > 0) {
      clean.priceMin = priceMin;
      clean.priceMax = priceMax;
      clean.price = Math.round((priceMin + priceMax) / 2);
    }
    if (minQty !== null) clean.minQty = minQty;
    if (maxQty !== null) clean.maxQty = maxQty;
    if (typeof c?.notes === 'string' && c.notes.trim()) {
      clean.notes = clampStr(c.notes, 240);
    }
    if (typeof c?.imageUrl === 'string' && c.imageUrl.trim()) {
      clean.imageUrl = clampStr(c.imageUrl, 512);
    }
    return clean;
  });
}

export function sanitizeCategoryGroups(
  groups: StockCategoryGroup[] | undefined | null,
  legacyFallback?: {
    budgetCap?: number;
    minProfitFloor?: number;
    maxPerCategory?: number;
    minColoursRule?: number;
    rules?: OptimizerRules;
    categories?: BangleCategory[];
    selectedComboId?: string | null;
    customQuantities?: number[] | null;
  }
): StockCategoryGroup[] {
  if (Array.isArray(groups) && groups.length === 0) {
    return [];
  }

  if (!Array.isArray(groups)) {
    if (legacyFallback && Array.isArray(legacyFallback.categories) && legacyFallback.categories.length > 0) {
      const cats = sanitizeCategories(legacyFallback.categories);
      const customQuantities =
        Array.isArray(legacyFallback.customQuantities) &&
        legacyFallback.customQuantities.length === cats.length
          ? legacyFallback.customQuantities.map((q) => clampNum(q, 0, 100000, 0))
          : null;
      return [
        {
          id: 'grp_primary',
          name: 'Primary Category',
          accentColor: GROUP_ACCENT_COLORS[0],
          budgetCap: clampNum(legacyFallback.budgetCap ?? 0, 0, 100000000, 0),
          minProfitFloor: clampNum(legacyFallback.minProfitFloor ?? 0, 0, 100000000, 0),
          maxPerCategory: clampNum(legacyFallback.maxPerCategory ?? 6, 1, 500, 6),
          minColoursRule: clampNum(legacyFallback.minColoursRule ?? 0, 0, 25, 0),
          conservativeSellThroughPct: 90,
          objective: 'best_overall',
          rules: sanitizeRules(legacyFallback.rules),
          categories: cats,
          selectedComboId: legacyFallback.selectedComboId
            ? clampStr(legacyFallback.selectedComboId, BLUEPRINT_LIMITS.MAX_COMBO_ID_LEN)
            : null,
          customQuantities,
        },
      ];
    }
    return [];
  }

  return groups.slice(0, BLUEPRINT_LIMITS.MAX_CATEGORY_GROUPS).map((g, idx) => {
    const categories = sanitizeCategories(g?.categories);
    const customQuantities =
      Array.isArray(g?.customQuantities) && g.customQuantities.length === categories.length
        ? g.customQuantities.map((q) => clampNum(q, 0, 100000, 0))
        : null;
    const conservativeSellThroughPct =
      typeof g?.conservativeSellThroughPct === 'number' && Number.isFinite(g.conservativeSellThroughPct)
        ? Math.round(clampNum(g.conservativeSellThroughPct, 50, 99, 90))
        : 90;

    const cleanGroup: StockCategoryGroup = {
      id: clampStr(g?.id, BLUEPRINT_LIMITS.MAX_UID_LEN, `grp_${idx + 1}`) || `grp_${idx + 1}`,
      name:
        clampStr(g?.name, BLUEPRINT_LIMITS.MAX_GROUP_NAME_LEN, `Category ${idx + 1}`) ||
        `Category ${idx + 1}`,
      accentColor:
        clampStr(
          g?.accentColor,
          32,
          GROUP_ACCENT_COLORS[idx % GROUP_ACCENT_COLORS.length]
        ) || GROUP_ACCENT_COLORS[idx % GROUP_ACCENT_COLORS.length],
      budgetCap: clampNum(g?.budgetCap ?? 0, 0, 100000000, 0),
      minProfitFloor: clampNum(g?.minProfitFloor ?? 0, 0, 100000000, 0),
      maxPerCategory: clampNum(g?.maxPerCategory ?? 6, 1, 500, 6),
      minColoursRule: clampNum(g?.minColoursRule ?? 0, 0, 25, 0),
      conservativeSellThroughPct,
      objective: normalizeObjective(g?.objective),
      rules: sanitizeRules(g?.rules),
      categories,
      selectedComboId: g?.selectedComboId
        ? clampStr(g.selectedComboId, BLUEPRINT_LIMITS.MAX_COMBO_ID_LEN)
        : null,
      customQuantities,
    };

    if (g?.priorityWeights && typeof g.priorityWeights === 'object') {
      cleanGroup.priorityWeights = {
        profit: Math.round(clampNum(g.priorityWeights.profit ?? 70, 0, 100, 70)),
        variety: Math.round(clampNum(g.priorityWeights.variety ?? 55, 0, 100, 55)),
        appeal: Math.round(clampNum(g.priorityWeights.appeal ?? 65, 0, 100, 65)),
        budgetUsage: Math.round(clampNum(g.priorityWeights.budgetUsage ?? 45, 0, 100, 45)),
        lowRisk: Math.round(clampNum(g.priorityWeights.lowRisk ?? 50, 0, 100, 50)),
      };
    }

    if (Array.isArray(g?.savedComboIds) && g.savedComboIds.length > 0) {
      cleanGroup.savedComboIds = g.savedComboIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 20)
        .map((id) => id.trim().slice(0, 40));
    }

    return cleanGroup;
  });
}

export function sanitizeStock(stock: StallStockItem[] | undefined | null): Array<Record<string, unknown>> {
  if (!Array.isArray(stock)) return [];
  return stock.slice(0, BLUEPRINT_LIMITS.MAX_STALL_STOCK).map((item, idx) => {
    const clean: Record<string, unknown> = {
      id: clampStr(item?.id, 64, `stock_${idx + 1}`) || `stock_${idx + 1}`,
      name: clampStr(item?.name, 100, `Stock Item ${idx + 1}`) || `Stock Item ${idx + 1}`,
      category: clampStr(item?.category, 60, 'General') || 'General',
      cost: clampNum(item?.cost ?? 0, 0, 10000000, 0),
      price: clampNum(item?.price ?? 0, 0, 10000000, 0),
      qty: clampNum(item?.qty ?? 0, 0, 1000000, 0),
      sellThrough: clampNum(item?.sellThrough ?? 90, 0, 100, 90),
      isSyncedBundle: Boolean(item?.isSyncedBundle),
    };
    if (typeof item?.unitPieces === 'number' && Number.isFinite(item.unitPieces)) {
      clean.unitPieces = clampNum(item.unitPieces, 1, 100000, 1);
    }
    if (typeof item?.groupId === 'string' && item.groupId.trim()) {
      clean.groupId = clampStr(item.groupId, BLUEPRINT_LIMITS.MAX_UID_LEN);
    }
    if (item?.itemType === 'event_cost' || item?.itemType === 'stock') {
      clean.itemType = item.itemType;
    }
    if (item?.sellThroughManual === true) {
      clean.sellThroughManual = true;
    }
    return clean;
  });
}

export function sanitizeWorkspaceMutableFields(snapshot: PlannerSnapshot) {
  const categoryGroups = sanitizeCategoryGroups(
    snapshot.categoryGroups,
    snapshot.categoryGroups === undefined
      ? {
          budgetCap: snapshot.budgetCap,
          minProfitFloor: snapshot.minProfitFloor,
          maxPerCategory: snapshot.maxPerCategory,
          minColoursRule: snapshot.minColoursRule,
          rules: snapshot.rules,
          categories: snapshot.categories,
          selectedComboId: snapshot.selectedComboId,
          customQuantities: snapshot.customQuantities,
        }
      : undefined
  );

  const activeGroup =
    categoryGroups.find((g) => g.id === snapshot.activeGroupId) || categoryGroups[0];

  const categories = activeGroup ? activeGroup.categories : [];
  const customQuantities =
    activeGroup &&
    Array.isArray(activeGroup.customQuantities) &&
    activeGroup.customQuantities.length === categories.length
      ? activeGroup.customQuantities
      : null;

  const resolvedTab: AppTab =
    snapshot.activeTab === 'calculator'
      ? 'overview'
      : VALID_TABS.has(snapshot.activeTab)
        ? snapshot.activeTab
        : 'optimizer';

  const resolvedEventName =
    clampStr(snapshot.eventName, BLUEPRINT_LIMITS.MAX_EVENT_NAME_LEN, 'My Event') || 'My Event';

  return {
    eventName: resolvedEventName,
    eventLocation: clampStr(snapshot.eventLocation, BLUEPRINT_LIMITS.MAX_EVENT_LOCATION_LEN, ''),
    eventDate: clampStr(snapshot.eventDate, BLUEPRINT_LIMITS.MAX_EVENT_DATE_LEN, ''),
    expectedFootfall: clampNum(snapshot.expectedFootfall ?? 0, 0, 10000000, 0),
    budgetCap: activeGroup ? activeGroup.budgetCap : clampNum(snapshot.budgetCap ?? 0, 0, 100000000, 0),
    minProfitFloor: activeGroup
      ? activeGroup.minProfitFloor
      : clampNum(snapshot.minProfitFloor ?? 0, 0, 100000000, 0),
    stallFee: clampNum(snapshot.stallFee ?? 0, 0, 100000000, 0),
    maxPerCategory: activeGroup ? activeGroup.maxPerCategory : clampNum(snapshot.maxPerCategory ?? 6, 1, 500, 6),
    minColoursRule: activeGroup ? activeGroup.minColoursRule : clampNum(snapshot.minColoursRule ?? 0, 0, 25, 0),
    globalSellThrough: clampNum(snapshot.globalSellThrough ?? 90, 10, 100, 90),
    activeTab: resolvedTab,
    rules: activeGroup ? activeGroup.rules : sanitizeRules(snapshot.rules),
    categories,
    stallStock: sanitizeStock(snapshot.stallStock),
    selectedComboId: activeGroup ? activeGroup.selectedComboId : null,
    customQuantities,
    categoryGroups,
    activeGroupId: activeGroup ? activeGroup.id : '',
    stallSetup: sanitizeStallSetup(snapshot.stallSetup),
    marketResearch: sanitizeMarketResearch(snapshot.marketResearch),
    projectMeta: sanitizeProjectMeta(snapshot.projectMeta, 'active', resolvedEventName),
    savedPlans: sanitizeSavedPlans(snapshot.savedPlans),
    purchaseProgress: sanitizePurchaseProgress(snapshot.purchaseProgress),
    actualSales: sanitizeActualSales(snapshot.actualSales),
    conversations: sanitizeConversations(snapshot.conversations),
    activeConversationId:
      typeof snapshot.activeConversationId === 'string' && snapshot.activeConversationId.trim()
        ? clampStr(snapshot.activeConversationId, 64)
        : null,
    orderPreparedAtMs:
      typeof snapshot.orderPreparedAtMs === 'number' && Number.isFinite(snapshot.orderPreparedAtMs)
        ? snapshot.orderPreparedAtMs
        : null,
  };
}

export function hydrateWorkspaceSnapshot(data: Record<string, unknown>): PlannerSnapshot {
  const hasExplicitGroups = Array.isArray(data.categoryGroups);
  const legacyCategories =
    Array.isArray(data.categories) && data.categories.length > 0
      ? sanitizeCategories(data.categories as BangleCategory[])
      : [];
  const legacyRules = sanitizeRules((data.rules as Partial<OptimizerRules>) || undefined);
  const categoryGroups = sanitizeCategoryGroups(
    hasExplicitGroups ? (data.categoryGroups as StockCategoryGroup[]) : undefined,
    !hasExplicitGroups
      ? {
          budgetCap: typeof data.budgetCap === 'number' ? data.budgetCap : 0,
          minProfitFloor: typeof data.minProfitFloor === 'number' ? data.minProfitFloor : 0,
          maxPerCategory: typeof data.maxPerCategory === 'number' ? data.maxPerCategory : 6,
          minColoursRule: typeof data.minColoursRule === 'number' ? data.minColoursRule : 0,
          rules: legacyRules,
          categories: legacyCategories,
          selectedComboId: typeof data.selectedComboId === 'string' ? data.selectedComboId : null,
          customQuantities: Array.isArray(data.customQuantities)
            ? (data.customQuantities as number[])
            : null,
        }
      : undefined
  );

  const rawActiveId = typeof data.activeGroupId === 'string' ? data.activeGroupId : '';
  const activeGroup = categoryGroups.find((g) => g.id === rawActiveId) || categoryGroups[0];
  const rawTab = typeof data.activeTab === 'string' ? (data.activeTab as AppTab) : 'optimizer';
  // Migrate legacy 'calculator' tab smoothly into unified Overview
  const activeTab: AppTab =
    rawTab === 'calculator' ? 'overview' : VALID_TABS.has(rawTab) ? rawTab : 'optimizer';

  const stallStock: StallStockItem[] = Array.isArray(data.stallStock)
    ? (data.stallStock as StallStockItem[]).map((item, idx) => ({
        id: clampStr(item?.id, 64, `stock_${idx + 1}`) || `stock_${idx + 1}`,
        name: clampStr(item?.name, 100, `Stock Item ${idx + 1}`) || `Stock Item ${idx + 1}`,
        category: clampStr(item?.category, 60, 'General') || 'General',
        cost: clampNum(item?.cost ?? 0, 0, 10000000, 0),
        price: clampNum(item?.price ?? 0, 0, 10000000, 0),
        qty: clampNum(item?.qty ?? 0, 0, 1000000, 0),
        sellThrough: clampNum(item?.sellThrough ?? 90, 0, 100, 90),
        isSyncedBundle: Boolean(item?.isSyncedBundle),
        ...(typeof item?.unitPieces === 'number' && Number.isFinite(item.unitPieces)
          ? { unitPieces: clampNum(item.unitPieces, 1, 100000, 1) }
          : {}),
        ...(typeof item?.groupId === 'string' && item.groupId.trim()
          ? { groupId: clampStr(item.groupId, BLUEPRINT_LIMITS.MAX_UID_LEN) }
          : {}),
        ...(item?.itemType === 'event_cost' || item?.itemType === 'stock'
          ? { itemType: item.itemType }
          : {}),
        ...(item?.sellThroughManual === true ? { sellThroughManual: true } : {}),
      }))
    : [];

  const hydratedEventName =
    typeof data.eventName === 'string' && data.eventName.trim()
      ? clampStr(data.eventName, BLUEPRINT_LIMITS.MAX_EVENT_NAME_LEN)
      : 'My Event';

  return {
    eventName: hydratedEventName,
    eventLocation:
      typeof data.eventLocation === 'string'
        ? clampStr(data.eventLocation, BLUEPRINT_LIMITS.MAX_EVENT_LOCATION_LEN)
        : '',
    eventDate:
      typeof data.eventDate === 'string'
        ? clampStr(data.eventDate, BLUEPRINT_LIMITS.MAX_EVENT_DATE_LEN)
        : '',
    expectedFootfall:
      typeof data.expectedFootfall === 'number'
        ? clampNum(data.expectedFootfall, 0, 10000000, 0)
        : 0,
    budgetCap: activeGroup
      ? activeGroup.budgetCap
      : typeof data.budgetCap === 'number'
        ? clampNum(data.budgetCap, 0, 100000000, 0)
        : 0,
    minProfitFloor: activeGroup
      ? activeGroup.minProfitFloor
      : typeof data.minProfitFloor === 'number'
        ? clampNum(data.minProfitFloor, 0, 100000000, 0)
        : 0,
    stallFee:
      typeof data.stallFee === 'number' ? clampNum(data.stallFee, 0, 100000000, 0) : 0,
    maxPerCategory: activeGroup ? activeGroup.maxPerCategory : 6,
    minColoursRule: activeGroup ? activeGroup.minColoursRule : 0,
    globalSellThrough:
      typeof data.globalSellThrough === 'number'
        ? clampNum(data.globalSellThrough, 10, 100, 90)
        : 90,
    activeTab,
    rules: activeGroup ? activeGroup.rules : legacyRules,
    categories: activeGroup ? activeGroup.categories : [],
    stallStock,
    selectedComboId: activeGroup ? activeGroup.selectedComboId : null,
    customQuantities: activeGroup ? activeGroup.customQuantities : null,
    categoryGroups,
    activeGroupId: activeGroup ? activeGroup.id : '',
    stallSetup: sanitizeStallSetup(data.stallSetup as Partial<StallSetupPlan> | undefined),
    marketResearch: sanitizeMarketResearch(data.marketResearch as MarketResearchRecord[] | undefined),
    projectMeta: sanitizeProjectMeta(
      data.projectMeta as Partial<ProjectMetadata> | undefined,
      'active',
      hydratedEventName
    ),
    savedPlans: sanitizeSavedPlans(data.savedPlans as SavedStockPlan[] | undefined),
    purchaseProgress: sanitizePurchaseProgress(
      data.purchaseProgress as Record<string, PurchaseItemProgress> | undefined
    ),
    actualSales: sanitizeActualSales(data.actualSales as ActualSaleRecord[] | undefined),
    conversations: sanitizeConversations(data.conversations as CoachConversation[] | undefined),
    activeConversationId:
      typeof data.activeConversationId === 'string' && data.activeConversationId.trim()
        ? clampStr(data.activeConversationId, 64)
        : null,
    orderPreparedAtMs:
      typeof data.orderPreparedAtMs === 'number' && Number.isFinite(data.orderPreparedAtMs)
        ? data.orderPreparedAtMs
        : null,
  };
}

export function formatAuthOrSyncError(err: unknown, hostname = ''): string {
  const code =
    err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    const hostLabel = hostname ? `"${hostname}"` : 'this domain';
    return `Google Sign-In is not yet authorized for ${hostLabel}. Add this hostname under Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is disabled in Firebase Authentication. Enable the Google provider in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/configuration-not-found') {
    return 'Firebase project configuration is incomplete or invalid. Verify your VITE_FIREBASE_* environment variables without exposing client credentials.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error while contacting Google Sign-In. Check your connection and try again.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been disabled in Firebase Authentication.';
  }

  let rawMsg = err instanceof Error ? err.message : String(err || '');
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed && typeof parsed.error === 'string') {
      rawMsg = parsed.error;
    }
  } catch {
    // Plain message
  }

  const lower = rawMsg.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'Cloud workspace sync was denied by Firestore rules. Verify your Google account email and ensure the latest firestore.rules are deployed.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Firestore free-tier daily quota has been reached for this project. Your work remains editable locally; cloud sync will resume after quota resets.';
  }
  if (lower.includes('offline') || lower.includes('unavailable')) {
    return 'Firestore is currently unreachable or offline. Check your connection and Firebase database settings.';
  }

  if (rawMsg && !rawMsg.startsWith('{') && rawMsg.length <= 200) {
    return rawMsg;
  }

  return 'Unable to complete account sync right now. Please try again.';
}
