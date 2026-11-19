import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuickProductInput } from '../components/OptimizerTab';
import { useAuth, type CreateProjectInput } from '../context/AuthContext';
import {
  CATEGORY_TEMPLATES,
  EXTRA_CATEGORY_STYLES,
  GROUP_ACCENT_COLORS,
  INITIAL_CATEGORIES,
} from '../data/defaults';
import type {
  ActiveWorkspaceTab,
  ActualSaleRecord,
  AiFocusSection,
  AppTab,
  BangleCategory,
  CoachConversation,
  MarketResearchRecord,
  OptimizationObjective,
  OptimizerRules,
  PlannerSnapshot,
  PlaybookIdeaAction,
  PriorityWeights,
  ProductDraft,
  ProjectMetadata,
  PurchaseItemProgress,
  SavedStockPlan,
  StallSetupPlan,
  StallStockItem,
  StockCategoryGroup,
} from '../types/stall';
import { DEFAULT_STALL_SETUP } from '../utils/accountHelpers';
import {
  calculateStallTotals,
  computeDiversifiedOverviewTotals,
  resolveCategoryGroups,
  syncCategoryGroupsToStallStock,
} from '../utils/optimizer';
import {
  copyTextReliable,
  createSavedPlanSnapshot,
  fiveScaleToBeauty,
  formatCategoryPurchaseOrder,
  formatFullPurchaseOrder,
} from '../utils/orderAndProjectEngine';
import { mergeLiveSalesIntoActualSales } from '../utils/liveSellingEngine';
import { useLiveSelling } from './useLiveSelling';

export const DEFAULT_RULES: OptimizerRules = {
  allAtLeastOne: true,
  evenDistribution: false,
  beautyFirst: false,
  maxProfitFocus: false,
  safe90Mode: false,
};

export function useStallWorkspace() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('optimizer');
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [expectedFootfall, setExpectedFootfall] = useState(0);
  const [stallFee, setStallFee] = useState(0);
  const [globalSellThrough, setGlobalSellThrough] = useState(90);

  const [projectMeta, setProjectMeta] = useState<ProjectMetadata | undefined>(undefined);
  const [categoryGroups, setCategoryGroups] = useState<StockCategoryGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [savedPlans, setSavedPlans] = useState<SavedStockPlan[]>([]);
  const [purchaseProgress, setPurchaseProgress] = useState<
    Record<string, PurchaseItemProgress>
  >({});
  const [actualSales, setActualSales] = useState<ActualSaleRecord[]>([]);
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [orderPreparedAtMs, setOrderPreparedAtMs] = useState<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [fullOrderCopied, setFullOrderCopied] = useState(false);

  const [stallSetup, setStallSetup] = useState<StallSetupPlan>(DEFAULT_STALL_SETUP);
  const [marketResearch, setMarketResearch] = useState<MarketResearchRecord[]>([]);

  const [stallStock, setStallStock] = useState<StallStockItem[]>([]);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState<string | null>(null);
  const [aiAuditError, setAiAuditError] = useState<string | null>(null);

  const [coachBanner, setCoachBanner] = useState<string | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  const [coachOpen, setCoachOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountDrawerTab, setAccountDrawerTab] = useState<
    'projects' | 'profile' | 'memory'
  >('projects');
  const [guestMode, setGuestModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('stalliq_guest_mode_v1') === '1';
    } catch {
      return false;
    }
  });
  const setGuestMode = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setGuestModeState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (typeof window !== 'undefined') {
        try {
          if (resolved) window.localStorage.setItem('stalliq_guest_mode_v1', '1');
          else window.localStorage.removeItem('stalliq_guest_mode_v1');
        } catch {
          // ignore
        }
      }
      return resolved;
    });
  }, []);
  const [showNewProjectWizard, setShowNewProjectWizard] = useState(false);

  const [undoStack, setUndoStack] = useState<PlannerSnapshot[]>([]);
  const [productDrafts, setProductDrafts] = useState<ProductDraft[]>([]);

  const auth = useAuth();
  const {
    user,
    accountContext,
    syncStatus,
    activeProjectId,
    activeProjectSnapshot,
    createProjectFromSetup,
    syncWorkspace,
    registerWorkspaceHydrator,
    registerWorkspaceResetter,
  } = auth;

  const skipNextSaveRef = useRef(true);
  const prevProjectIdRef = useRef<string | null>(null);

  const resolvedGroups = useMemo(
    () => resolveCategoryGroups(categoryGroups),
    [categoryGroups]
  );

  const otherEventCostsTotal = useMemo(
    () =>
      stallStock.reduce(
        (sum, item) =>
          item.itemType === 'event_cost'
            ? sum + Math.max(0, item.cost) * Math.max(0, item.qty)
            : sum,
        0
      ),
    [stallStock]
  );

  const overviewTotals = useMemo(
    () =>
      computeDiversifiedOverviewTotals(
        resolvedGroups,
        stallFee + otherEventCostsTotal,
        expectedFootfall
      ),
    [resolvedGroups, stallFee, otherEventCostsTotal, expectedFootfall]
  );

  const activeResolved = useMemo(
    () =>
      resolvedGroups.find((rg) => rg.group.id === activeGroupId) ||
      resolvedGroups[0] ||
      null,
    [resolvedGroups, activeGroupId]
  );

  const activeGroup = activeResolved?.group || null;
  const generatedCombos = activeResolved?.combos || [];
  const activeCombo = activeResolved?.activeCombo || null;
  const activeSearchMeta = activeResolved?.searchMeta;

  const totalProductsCount = useMemo(
    () =>
      resolvedGroups.reduce((sum, rg) => sum + rg.group.categories.length, 0),
    [resolvedGroups]
  );

  const updateActiveGroup = useCallback(
    (updater: (group: StockCategoryGroup) => StockCategoryGroup) => {
      if (!activeGroup) return;
      const targetId = activeGroup.id;
      setCategoryGroups((prev) =>
        prev.map((g) => (g.id === targetId ? updater(g) : g))
      );
    },
    [activeGroup]
  );

  useEffect(() => {
    setStallStock((prev) =>
      syncCategoryGroupsToStallStock(resolvedGroups, prev, globalSellThrough)
    );
  }, [resolvedGroups, globalSellThrough]);

  const stallTotals = useMemo(
    () => calculateStallTotals(stallStock, stallFee, expectedFootfall),
    [stallStock, stallFee, expectedFootfall]
  );

  const liveSelling = useLiveSelling({
    userId: user?.uid,
    projectId: activeProjectId || projectMeta?.id || 'local_default',
    resolvedGroups,
    purchaseProgress,
    isSellTabActive: activeTab === 'sell',
  });

  const combinedActualSales = useMemo(
    () => mergeLiveSalesIntoActualSales(liveSelling.transactions, actualSales),
    [liveSelling.transactions, actualSales]
  );

  const showToast = useCallback((msg: string, ms = 3400) => {
    setCoachBanner(msg);
    window.setTimeout(() => setCoachBanner(null), ms);
  }, []);

  const plannerSnapshot: PlannerSnapshot = useMemo(
    () => ({
      eventName,
      eventLocation,
      eventDate,
      expectedFootfall,
      budgetCap: activeGroup?.budgetCap ?? 0,
      minProfitFloor: activeGroup?.minProfitFloor ?? 0,
      stallFee,
      maxPerCategory: activeGroup?.maxPerCategory ?? 20,
      minColoursRule: activeGroup?.minColoursRule ?? 0,
      globalSellThrough,
      rules: activeGroup?.rules || DEFAULT_RULES,
      categories: activeGroup?.categories || [],
      selectedComboId: activeGroup?.selectedComboId ?? null,
      customQuantities: activeGroup?.customQuantities ?? null,
      stallStock,
      activeTab,
      categoryGroups,
      activeGroupId: activeGroup?.id || '',
      stallSetup,
      marketResearch,
      projectMeta,
      savedPlans,
      purchaseProgress,
      actualSales,
      conversations,
      activeConversationId,
      orderPreparedAtMs,
    }),
    [
      eventName,
      eventLocation,
      eventDate,
      expectedFootfall,
      activeGroup,
      stallFee,
      globalSellThrough,
      stallStock,
      activeTab,
      categoryGroups,
      stallSetup,
      marketResearch,
      projectMeta,
      savedPlans,
      purchaseProgress,
      actualSales,
      conversations,
      activeConversationId,
      orderPreparedAtMs,
    ]
  );

  const snapshotRef = useRef<PlannerSnapshot>(plannerSnapshot);
  snapshotRef.current = plannerSnapshot;

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-14), snapshotRef.current]);
  }, []);

  const createEmptyCategoryGroup = (customName: string) => {
    const cleanName = customName.trim();
    if (!cleanName) return;
    const nextIdx = categoryGroups.length + 1;
    const accent =
      GROUP_ACCENT_COLORS[(nextIdx - 1) % GROUP_ACCENT_COLORS.length];
    const newId = `grp_${Date.now()}`;
    const existsSame = categoryGroups.some(
      (g) => g.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    const resolvedName = existsSame ? `${cleanName} ${nextIdx}` : cleanName;

    const newGroup: StockCategoryGroup = {
      id: newId,
      name: resolvedName,
      accentColor: accent,
      budgetCap: 0,
      minProfitFloor: 0,
      maxPerCategory: 20,
      minColoursRule: 0,
      conservativeSellThroughPct: globalSellThrough,
      objective: 'best_overall',
      rules: { ...DEFAULT_RULES },
      categories: [],
      selectedComboId: null,
      customQuantities: null,
    };

    setCategoryGroups((prev) => [...prev, newGroup]);
    setActiveGroupId(newId);
    setActiveTab('optimizer');
  };

  const createGroupFromTemplate = (templateId: string, customName?: string) => {
    const nextIdx = categoryGroups.length + 1;
    const accent =
      GROUP_ACCENT_COLORS[(nextIdx - 1) % GROUP_ACCENT_COLORS.length];
    const newId = `grp_${Date.now()}`;
    const tpl =
      CATEGORY_TEMPLATES.find((t) => t.id === templateId) || CATEGORY_TEMPLATES[0];
    const stylePool = [
      ...INITIAL_CATEGORIES.map(({ barColor, textClass, bgClass }) => ({
        barColor,
        textClass,
        bgClass,
      })),
      ...EXTRA_CATEGORY_STYLES,
    ];

    const baseName = customName?.trim() || tpl.name;
    const existsSame = categoryGroups.some(
      (g) => g.name.trim().toLowerCase() === baseName.toLowerCase()
    );
    const resolvedName = existsSame ? `${baseName} ${nextIdx}` : baseName;

    const newGroup: StockCategoryGroup = {
      id: newId,
      name: resolvedName,
      accentColor: accent,
      budgetCap: tpl.budgetCap,
      minProfitFloor: tpl.minProfitFloor,
      maxPerCategory: 6,
      minColoursRule: 0,
      conservativeSellThroughPct: globalSellThrough,
      objective: 'best_overall',
      rules: { ...DEFAULT_RULES },
      categories: tpl.items.map((item, idx) => ({
        id: `${newId}_${idx + 1}`,
        name: item.name,
        shortName:
          item.name.split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') || item.name,
        cost: item.cost,
        price: item.price,
        beauty: item.beauty,
        ...stylePool[idx % stylePool.length],
      })),
      selectedComboId: 'c_1',
      customQuantities: null,
    };

    setCategoryGroups((prev) => [...prev, newGroup]);
    setActiveGroupId(newId);
    setActiveTab('optimizer');
  };

  const duplicateCategoryGroup = (groupId: string) => {
    const source = categoryGroups.find((g) => g.id === groupId);
    if (!source) return;
    const nextIdx = categoryGroups.length + 1;
    const accent =
      GROUP_ACCENT_COLORS[(nextIdx - 1) % GROUP_ACCENT_COLORS.length];
    const newId = `grp_${Date.now()}`;
    const copyGroup: StockCategoryGroup = {
      ...source,
      id: newId,
      name: `${source.name} Copy`.slice(0, 60),
      accentColor: accent,
      rules: { ...source.rules },
      categories: source.categories.map((c, idx) => ({
        ...c,
        id: `${newId}_item_${idx + 1}`,
      })),
      customQuantities: source.customQuantities ? [...source.customQuantities] : null,
    };
    setCategoryGroups((prev) => [...prev, copyGroup]);
    setActiveGroupId(newId);
    setActiveTab('optimizer');
  };

  const moveCategoryGroup = (groupId: string, direction: -1 | 1) => {
    setCategoryGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const removeCategoryGroup = (groupId: string) => {
    pushUndoSnapshot();
    setCategoryGroups((prev) => {
      const filtered = prev.filter((g) => g.id !== groupId);
      if (activeGroupId === groupId) {
        setActiveGroupId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const renameCategoryGroup = (groupId: string, name: string) => {
    setCategoryGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  };

  const selectGroupCombo = (groupId: string, comboId: string) => {
    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, selectedComboId: comboId, customQuantities: null }
          : g
      )
    );
  };

  const toggleRule = (key: keyof OptimizerRules) => {
    updateActiveGroup((g) => {
      const nextRules = { ...g.rules, [key]: !g.rules[key] };
      if (key === 'beautyFirst' && nextRules.beautyFirst) {
        nextRules.maxProfitFocus = false;
      }
      if (key === 'maxProfitFocus' && nextRules.maxProfitFocus) {
        nextRules.beautyFirst = false;
      }
      return { ...g, rules: nextRules };
    });
  };

  const setActiveObjective = (objective: OptimizationObjective) => {
    updateActiveGroup((g) => ({
      ...g,
      objective,
      priorityWeights: undefined,
      customQuantities: null,
      selectedComboId: 'c_1',
    }));
  };

  const setActivePriorityWeights = (weights: PriorityWeights | undefined) => {
    updateActiveGroup((g) => ({
      ...g,
      priorityWeights: weights,
      customQuantities: null,
    }));
  };

  const toggleSavedCombo = (comboId: string) => {
    updateActiveGroup((g) => {
      const current = g.savedComboIds || [];
      const next = current.includes(comboId)
        ? current.filter((id) => id !== comboId)
        : [...current, comboId];
      return { ...g, savedComboIds: next };
    });
  };

  const duplicateComboToCustom = (counts: number[]) => {
    pushUndoSnapshot();
    updateActiveGroup((g) => ({
      ...g,
      customQuantities: [...counts],
    }));
    showToast('Copied combination into custom editable quantities');
  };

  const updateCatFields = (id: string, patch: Partial<BangleCategory>) => {
    updateActiveGroup((g) => ({
      ...g,
      categories: g.categories.map((c) => {
        if (c.id !== id) return c;
        const next: BangleCategory = { ...c, ...patch };
        if (typeof next.beauty === 'number') {
          next.beauty = Math.min(10, Math.max(1, next.beauty));
        }
        if (typeof next.cost === 'number') {
          next.cost = Math.max(0, next.cost);
        }
        if (typeof next.price === 'number') {
          next.price = Math.max(0, next.price);
        }
        return next;
      }),
    }));
  };

  const quickAddProduct = (input: QuickProductInput) => {
    if (!activeGroup) return;
    pushUndoSnapshot();
    updateActiveGroup((g) => {
      const style =
        EXTRA_CATEGORY_STYLES[g.categories.length % EXTRA_CATEGORY_STYLES.length];
      const newItem: BangleCategory = {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: input.name.trim(),
        shortName:
          input.name.trim().split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') ||
          input.name.trim(),
        cost: Math.max(0, Math.round(input.cost)),
        price: Math.max(0, Math.round(input.price)),
        beauty: fiveScaleToBeauty(input.appealStars),
        ...(input.plannedQty !== null ? { plannedQty: input.plannedQty } : {}),
        ...style,
      };
      const nextCategories = [...g.categories, newItem];
      const nextCustom =
        g.customQuantities && g.customQuantities.length === g.categories.length
          ? [...g.customQuantities, input.plannedQty ?? 0]
          : null;
      return {
        ...g,
        categories: nextCategories,
        customQuantities: nextCustom,
      };
    });
  };

  const bulkAddProducts = (items: QuickProductInput[]) => {
    if (!activeGroup || items.length === 0) return;
    pushUndoSnapshot();
    updateActiveGroup((g) => {
      const startIdx = g.categories.length;
      const added: BangleCategory[] = items.map((input, idx) => {
        const style =
          EXTRA_CATEGORY_STYLES[(startIdx + idx) % EXTRA_CATEGORY_STYLES.length];
        return {
          id: `item_${Date.now()}_${idx}`,
          name: input.name.trim(),
          shortName:
            input.name.trim().split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') ||
            input.name.trim(),
          cost: Math.max(0, Math.round(input.cost)),
          price: Math.max(0, Math.round(input.price)),
          beauty: fiveScaleToBeauty(input.appealStars),
          ...(input.plannedQty !== null ? { plannedQty: input.plannedQty } : {}),
          ...style,
        };
      });
      return {
        ...g,
        categories: [...g.categories, ...added],
        customQuantities: null,
      };
    });
    showToast(`Added ${items.length} products to ${activeGroup.name}`);
  };

  const duplicateCat = (id: string) => {
    updateActiveGroup((g) => {
      const source = g.categories.find((c) => c.id === id);
      if (!source) return g;
      return {
        ...g,
        categories: [
          ...g.categories,
          {
            ...source,
            id: `item_${Date.now()}`,
            name: `${source.name} Copy`.slice(0, 60),
          },
        ],
        customQuantities: null,
      };
    });
  };

  const removeCat = (id: string) => {
    pushUndoSnapshot();
    updateActiveGroup((g) => ({
      ...g,
      categories: g.categories.filter((c) => c.id !== id),
      customQuantities: null,
    }));
  };

  const resetWorkspaceLocalState = useCallback(() => {
    setActiveTab('optimizer');
    setEventName('');
    setEventLocation('');
    setEventDate('');
    setExpectedFootfall(0);
    setStallFee(0);
    setGlobalSellThrough(90);
    setProjectMeta(undefined);
    setCategoryGroups([]);
    setActiveGroupId('');
    setSavedPlans([]);
    setPurchaseProgress({});
    setActualSales([]);
    setConversations([]);
    setActiveConversationId(null);
    setOrderPreparedAtMs(null);
    setStallSetup(DEFAULT_STALL_SETUP);
    setMarketResearch([]);
    setProductDrafts([]);
    setStallStock([]);
    setUndoStack([]);
    setAiAuditReport(null);
    setAiAuditError(null);
    setCoachBanner(null);
  }, []);

  const relaxConstraints = () => {
    updateActiveGroup((g) => ({
      ...g,
      rules: {
        allAtLeastOne: false,
        evenDistribution: false,
        beautyFirst: false,
        maxProfitFocus: false,
        safe90Mode: false,
      },
      minProfitFloor: Math.min(
        g.minProfitFloor,
        Math.max(0, Math.round(g.budgetCap * 0.35))
      ),
    }));
  };

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setEventName(last.eventName);
      if (typeof last.eventLocation === 'string') setEventLocation(last.eventLocation);
      if (typeof last.eventDate === 'string') setEventDate(last.eventDate);
      setExpectedFootfall(last.expectedFootfall);
      setStallFee(last.stallFee);
      setGlobalSellThrough(last.globalSellThrough);
      if (last.stallSetup) setStallSetup(last.stallSetup);
      if (Array.isArray(last.marketResearch)) setMarketResearch(last.marketResearch);
      if (Array.isArray(last.categoryGroups)) {
        setCategoryGroups(last.categoryGroups);
        setActiveGroupId(last.activeGroupId || last.categoryGroups[0]?.id || '');
      }
      setStallStock(last.stallStock);
      if (last.projectMeta) setProjectMeta(last.projectMeta);
      if (Array.isArray(last.savedPlans)) setSavedPlans(last.savedPlans);
      if (last.purchaseProgress) setPurchaseProgress(last.purchaseProgress);
      if (Array.isArray(last.actualSales)) setActualSales(last.actualSales);
      showToast('Undid last change', 2600);
      return prev.slice(0, -1);
    });
  }, [showToast]);

  const handleSendProductDraft = (draft: ProductDraft) => {
    setProductDrafts((prev) => [draft, ...prev.filter((d) => d.id !== draft.id)]);
    const targetGroup =
      (draft.targetCategoryId &&
        categoryGroups.find((g) => g.id === draft.targetCategoryId)) ||
      (draft.targetCategoryName &&
        categoryGroups.find(
          (g) => g.name.toLowerCase() === draft.targetCategoryName!.toLowerCase()
        ));
    if (targetGroup) {
      setActiveGroupId(targetGroup.id);
    }
    setActiveTab('optimizer');
    showToast(`Staged "${draft.name}" draft — review and click Add to inventory`, 4000);
  };

  const handleAcceptProductDraft = (draft: ProductDraft) => {
    pushUndoSnapshot();
    const existingTarget =
      (draft.targetCategoryId &&
        categoryGroups.find((g) => g.id === draft.targetCategoryId)) ||
      (draft.targetCategoryName &&
        categoryGroups.find(
          (g) => g.name.toLowerCase() === draft.targetCategoryName!.toLowerCase()
        )) ||
      activeGroup;

    if (!existingTarget) {
      const grpId = `grp_${Date.now()}`;
      const newGroupName = draft.targetCategoryName?.trim() || 'Products';
      const newItem: BangleCategory = {
        id: `item_${Date.now()}`,
        name: draft.name,
        shortName:
          draft.name.split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') || draft.name,
        cost: Math.max(0, Math.round(draft.cost)),
        price: Math.max(0, Math.round(draft.price)),
        beauty: Math.min(10, Math.max(1, draft.beauty)),
        ...(draft.notes ? { notes: draft.notes } : {}),
        ...EXTRA_CATEGORY_STYLES[0],
      };
      setCategoryGroups([
        {
          id: grpId,
          name: newGroupName,
          accentColor: GROUP_ACCENT_COLORS[0],
          budgetCap: 0,
          minProfitFloor: 0,
          maxPerCategory: 20,
          minColoursRule: 0,
          conservativeSellThroughPct: globalSellThrough,
          objective: 'best_overall',
          rules: { ...DEFAULT_RULES },
          categories: [newItem],
          selectedComboId: null,
          customQuantities: null,
        },
      ]);
      setActiveGroupId(grpId);
      setProductDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      showToast(`Added "${draft.name}" to ${newGroupName}`);
      return;
    }

    const style =
      EXTRA_CATEGORY_STYLES[
        existingTarget.categories.length % EXTRA_CATEGORY_STYLES.length
      ];
    const newItem: BangleCategory = {
      id: `item_${Date.now()}`,
      name: draft.name,
      shortName:
        draft.name.split(/[\s/]+/).filter(Boolean).slice(0, 2).join(' ') || draft.name,
      cost: Math.max(0, Math.round(draft.cost)),
      price: Math.max(0, Math.round(draft.price)),
      beauty: Math.min(10, Math.max(1, draft.beauty)),
      ...(draft.notes ? { notes: draft.notes } : {}),
      ...style,
    };
    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.id === existingTarget.id
          ? {
              ...g,
              categories: [...g.categories, newItem],
              customQuantities: null,
            }
          : g
      )
    );
    setActiveGroupId(existingTarget.id);
    setProductDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    showToast(`Added "${draft.name}" to ${existingTarget.name}`);
  };

  const handleDismissProductDraft = (draftId: string) => {
    setProductDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  const scrollToAiSection = useCallback((section?: AiFocusSection | null) => {
    if (!section || typeof document === 'undefined') return;
    setHighlightedSection(section);
    window.setTimeout(() => setHighlightedSection(null), 1900);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-ai-section="${section}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, 60);
  }, []);

  const normalizeTab = (tab: AppTab | undefined): ActiveWorkspaceTab => {
    if (
      tab === 'sell' ||
      tab === 'optimizer' ||
      tab === 'strategies' ||
      tab === 'research'
    ) {
      return tab;
    }
    return 'overview';
  };

  const applyWorkspaceSnapshot = useCallback(
    (
      next: PlannerSnapshot,
      changes: string[],
      focusSection?: AiFocusSection | null
    ) => {
      setEventName(next.eventName || '');
      setEventLocation(typeof next.eventLocation === 'string' ? next.eventLocation : '');
      setEventDate(typeof next.eventDate === 'string' ? next.eventDate : '');
      setExpectedFootfall(
        typeof next.expectedFootfall === 'number' && Number.isFinite(next.expectedFootfall)
          ? Math.max(0, next.expectedFootfall)
          : 0
      );
      setStallFee(
        typeof next.stallFee === 'number' && Number.isFinite(next.stallFee)
          ? Math.max(0, next.stallFee)
          : 0
      );
      setGlobalSellThrough(next.globalSellThrough || 90);
      setStallSetup(next.stallSetup || DEFAULT_STALL_SETUP);
      setMarketResearch(Array.isArray(next.marketResearch) ? next.marketResearch : []);
      setCategoryGroups(Array.isArray(next.categoryGroups) ? next.categoryGroups : []);
      setActiveGroupId(
        next.activeGroupId ||
          (Array.isArray(next.categoryGroups) && next.categoryGroups[0]?.id) ||
          ''
      );
      setStallStock(Array.isArray(next.stallStock) ? next.stallStock : []);
      setProjectMeta(next.projectMeta);
      setSavedPlans(Array.isArray(next.savedPlans) ? next.savedPlans : []);
      setPurchaseProgress(next.purchaseProgress || {});
      setActualSales(Array.isArray(next.actualSales) ? next.actualSales : []);
      setConversations(Array.isArray(next.conversations) ? next.conversations : []);
      setActiveConversationId(next.activeConversationId ?? null);
      setOrderPreparedAtMs(next.orderPreparedAtMs ?? null);
      setActiveTab(normalizeTab(next.activeTab));
      setAiAuditReport(null);

      if (changes.length > 0) {
        showToast(changes.slice(0, 3).join(' · '), 4500);
      }
      if (focusSection) {
        scrollToAiSection(focusSection);
      }
    },
    [scrollToAiSection, showToast]
  );

  useEffect(() => {
    registerWorkspaceHydrator((saved) => {
      skipNextSaveRef.current = true;
      prevProjectIdRef.current = saved.projectMeta?.id || null;
      applyWorkspaceSnapshot(saved, []);
    });
    registerWorkspaceResetter((opts) => {
      skipNextSaveRef.current = true;
      prevProjectIdRef.current = null;
      if (opts?.exitGuest) {
        setGuestMode(false);
      }
      setCoachOpen(false);
      setAccountDrawerOpen(false);
      setShowNewProjectWizard(false);
      resetWorkspaceLocalState();
    });
  }, [
    registerWorkspaceHydrator,
    registerWorkspaceResetter,
    applyWorkspaceSnapshot,
    resetWorkspaceLocalState,
  ]);

  useEffect(() => {
    if (
      activeProjectSnapshot &&
      activeProjectId &&
      prevProjectIdRef.current !== activeProjectId
    ) {
      skipNextSaveRef.current = true;
      prevProjectIdRef.current = activeProjectId;
      applyWorkspaceSnapshot(activeProjectSnapshot, []);
    }
  }, [activeProjectSnapshot, activeProjectId, applyWorkspaceSnapshot]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (syncStatus === 'loading') return;
    if (prevProjectIdRef.current !== activeProjectId) {
      prevProjectIdRef.current = activeProjectId;
      skipNextSaveRef.current = true;
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void syncWorkspace(plannerSnapshot);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, syncStatus, plannerSnapshot, syncWorkspace]);

  const handleCompleteProjectSetup = async (input: CreateProjectInput) => {
    skipNextSaveRef.current = true;
    const created = await createProjectFromSetup(input);
    prevProjectIdRef.current = created.projectMeta?.id || null;
    applyWorkspaceSnapshot(created, []);
    setShowNewProjectWizard(false);
  };

  const stepQty = (idx: number, delta: number) => {
    if (!activeGroup) return;
    updateActiveGroup((g) => {
      const currentCounts = activeCombo
        ? [...activeCombo.counts]
        : g.categories.map((c) => c.plannedQty || 0);
      const nextQty = Math.max(0, (currentCounts[idx] || 0) + delta);
      currentCounts[idx] = nextQty;
      const nextCategories = g.categories.map((c, i) =>
        i === idx ? { ...c, plannedQty: nextQty } : c
      );
      return {
        ...g,
        categories: nextCategories,
        customQuantities: currentCounts,
      };
    });
  };

  const setPlannedQty = (idx: number, qty: number | null) => {
    if (!activeGroup) return;
    updateActiveGroup((g) => {
      const currentCounts = activeCombo
        ? [...activeCombo.counts]
        : g.categories.map((c) => c.plannedQty || 0);
      const cleanQty = qty === null ? 0 : Math.max(0, Math.round(qty));
      currentCounts[idx] = cleanQty;
      const nextCategories = g.categories.map((c, i) =>
        i === idx ? { ...c, plannedQty: cleanQty } : c
      );
      return {
        ...g,
        categories: nextCategories,
        customQuantities: currentCounts,
      };
    });
  };

  const copyOrder = async () => {
    if (!activeResolved) return;
    const text = formatCategoryPurchaseOrder(activeResolved, {
      projectName: projectMeta?.name || eventName || 'My Project',
      eventName,
    });
    const ok = await copyTextReliable(text);
    if (ok) {
      setOrderPreparedAtMs(Date.now());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyFullOrder = async () => {
    if (resolvedGroups.length === 0) return;
    const text = formatFullPurchaseOrder(resolvedGroups, {
      projectName: projectMeta?.name || eventName || 'My Project',
      eventName,
      eventDate,
    });
    const ok = await copyTextReliable(text);
    if (ok) {
      setOrderPreparedAtMs(Date.now());
      setFullOrderCopied(true);
      window.setTimeout(() => setFullOrderCopied(false), 2000);
    }
  };

  const handleSaveStockPlan = (name: string) => {
    const plan = createSavedPlanSnapshot(name, resolvedGroups, overviewTotals);
    setSavedPlans((prev) => [plan, ...prev].slice(0, 12));
    showToast(`Saved stock plan "${plan.name}"`);
  };

  const handleLoadSavedStockPlan = (planId: string) => {
    const plan = savedPlans.find((p) => p.id === planId);
    if (!plan) return;
    pushUndoSnapshot();
    setCategoryGroups((prev) =>
      prev.map((g) => {
        const snap = plan.categorySnapshots.find(
          (c) =>
            c.groupId === g.id ||
            c.groupName.toLowerCase() === g.name.toLowerCase()
        );
        if (!snap) return g;
        const counts = g.categories.map((cat) => {
          const item = snap.items.find(
            (i) =>
              i.productId === cat.id ||
              i.productName.toLowerCase() === cat.name.toLowerCase()
          );
          return item ? item.qty : 0;
        });
        return {
          ...g,
          budgetCap: snap.budgetCap,
          customQuantities: counts,
          categories: g.categories.map((cat, idx) => ({
            ...cat,
            plannedQty: counts[idx],
          })),
        };
      })
    );
    showToast(`Loaded "${plan.name}"`);
  };

  const handleDeleteSavedStockPlan = (planId: string) => {
    setSavedPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  const handleUpdatePurchaseProgress = (
    itemKey: string,
    patch: Partial<PurchaseItemProgress>
  ) => {
    setPurchaseProgress((prev) => {
      const existing = prev[itemKey] || {
        status: 'not_ordered' as const,
        checked: false,
        receivedQty: 0,
        updatedAtMs: Date.now(),
      };
      return {
        ...prev,
        [itemKey]: {
          ...existing,
          ...patch,
          updatedAtMs: Date.now(),
        },
      };
    });
  };

  const handleRecordActualSale = (entry: {
    groupId: string;
    categoryName: string;
    productId: string;
    productName: string;
    qtySold: number;
    actualPricePerUnit: number;
    unitCost: number;
  }) => {
    const record: ActualSaleRecord = {
      id: `sale_${Date.now()}`,
      ...entry,
      recordedAtMs: Date.now(),
    };
    setActualSales((prev) => [record, ...prev]);
    showToast(`Recorded ${entry.qtySold}× ${entry.productName} sold`);
  };

  const handleRemoveActualSale = (saleId: string) => {
    if (saleId.startsWith('live_')) {
      const rest = saleId.slice(5);
      const txnId = rest.split('_line_')[0];
      if (txnId) {
        liveSelling.reverseTransaction(txnId, 'Removed from sales overview');
        return;
      }
    }
    setActualSales((prev) => prev.filter((s) => s.id !== saleId));
  };

  const handleUpdateConversations = useCallback(
    (nextConvs: CoachConversation[], activeId: string) => {
      setConversations(nextConvs);
      setActiveConversationId(activeId);
    },
    []
  );

  const effectiveAccountContext = user ? accountContext : undefined;

  const applyGlobalSellThrough = (pct: number) => {
    setGlobalSellThrough(pct);
    setStallStock((prev) =>
      prev.map((item) =>
        item.itemType === 'event_cost'
          ? item
          : {
              ...item,
              sellThrough: pct,
              ...(item.isSyncedBundle ? { sellThroughManual: true } : {}),
            }
      )
    );
  };

  const updateStockItem = (
    id: string,
    field: keyof StallStockItem,
    val: string
  ) => {
    setStallStock((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === 'name' || field === 'category'
                  ? val
                  : Math.max(0, Number(val) || 0),
              ...(field === 'sellThrough' && item.isSyncedBundle
                ? { sellThroughManual: true }
                : {}),
            }
          : item
      )
    );
  };

  const addBlankStockItem = () => {
    setStallStock((prev) => [
      ...prev,
      {
        id: `stock_${Date.now()}`,
        name: `Extra Item ${prev.length + 1}`,
        category: 'General',
        cost: 0,
        price: 0,
        qty: 1,
        sellThrough: globalSellThrough,
        isSyncedBundle: false,
        itemType: 'stock',
      },
    ]);
  };

  const removeStockItem = (id: string) => {
    setStallStock((prev) => prev.filter((i) => i.id !== id));
  };

  const addEventCost = (name = 'Display / Packaging', amount = 500) => {
    pushUndoSnapshot();
    setStallStock((prev) => [
      ...prev,
      {
        id: `exp_${Date.now()}`,
        name,
        category: 'Event Cost',
        cost: Math.max(0, amount),
        price: 0,
        qty: 1,
        sellThrough: 0,
        isSyncedBundle: false,
        itemType: 'event_cost',
      },
    ]);
  };

  const updateEventCost = (id: string, field: 'name' | 'cost', val: string) => {
    setStallStock((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === 'name' ? val : Math.max(0, Number(val) || 0),
            }
          : item
      )
    );
  };

  const runAiPlanReview = async () => {
    setAiAuditLoading(true);
    setAiAuditError(null);
    try {
      const res = await fetch('/api/ai/cfo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: eventName || projectMeta?.name || 'My Project',
          stallFee,
          expectedFootfall,
          accountContext: effectiveAccountContext,
          totals: {
            totalCost: stallTotals.totalCost,
            totalOutlay: stallTotals.totalOutlay,
            revRealistic: stallTotals.revRealistic,
            netAfterStallReal: stallTotals.netAfterStallReal,
            unitsToBreakEven: stallTotals.unitsToBreakEven,
            footfallConversionNeeded: stallTotals.footfallConversionNeeded,
            blendedMarginPct: stallTotals.blendedMarginPct,
            rentBurdenPct: stallTotals.rentBurdenPct,
          },
          items: stallTotals.itemRows.map((r) => ({
            name: r.name,
            category: r.category,
            cost: r.cost,
            price: r.price,
            qty: r.qty,
            sellThrough: r.sellThrough,
            lineProfitReal: r.lineProfitReal,
            roiPct: r.roiPct,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Plan check failed');
      setAiAuditReport(data.audit);
    } catch (err) {
      setAiAuditError(
        err instanceof Error ? err.message : 'Unable to run plan check.'
      );
    } finally {
      setAiAuditLoading(false);
    }
  };

  const handleApplyPlaybookIdea = (action: PlaybookIdeaAction): string => {
    if (action.type === 'set_objective') {
      setCategoryGroups((prev) =>
        prev.map((g) =>
          g.id === action.groupId
            ? { ...g, objective: action.objective, customQuantities: null }
            : g
        )
      );
      return 'Applied buying goal';
    }
    if (action.type === 'prioritize_rule') {
      setCategoryGroups((prev) =>
        prev.map((g) => {
          if (g.id !== action.groupId) return g;
          return {
            ...g,
            customQuantities: null,
            rules: {
              ...g.rules,
              [action.rule]: true,
              ...(action.rule === 'beautyFirst' ? { maxProfitFocus: false } : {}),
              ...(action.rule === 'maxProfitFocus' ? { beautyFirst: false } : {}),
            },
          };
        })
      );
      return 'Applied focus';
    }
    if (action.type === 'set_sell_through') {
      setCategoryGroups((prev) =>
        prev.map((g) =>
          g.id === action.groupId
            ? { ...g, conservativeSellThroughPct: action.pct }
            : g
        )
      );
      return `Set sell-through to ${action.pct}%`;
    }
    if (action.type === 'select_combo_rank') {
      selectGroupCombo(action.groupId, action.comboId);
      return 'Updated stock mix';
    }
    if (action.type === 'add_event_cost') {
      const alreadyExists = stallStock.some(
        (s) =>
          s.itemType === 'event_cost' &&
          s.name.toLowerCase() === action.name.toLowerCase()
      );
      if (!alreadyExists) {
        addEventCost(action.name, action.amount);
        return `Added ₹${action.amount} expense`;
      }
      return 'Already included';
    }
    if (action.type === 'add_cfo_bundle') {
      const exists = stallStock.some(
        (s) =>
          s.itemType !== 'event_cost' &&
          s.name.toLowerCase() === action.name.toLowerCase()
      );
      if (!exists) {
        setStallStock((prev) => [
          ...prev,
          {
            id: `pb_bundle_${Date.now()}`,
            name: action.name,
            category: action.category,
            cost: action.cost,
            price: action.price,
            qty: action.qty,
            sellThrough: globalSellThrough,
            isSyncedBundle: false,
            itemType: 'stock',
          },
        ]);
        return `Added ${action.qty}× bundle`;
      }
      return 'Bundle already added';
    }
    return 'Applied';
  };

  const activeMixSummary =
    resolvedGroups.length > 0
      ? resolvedGroups
          .map(({ group, activeCombo: c }) =>
            c
              ? `${group.name}: ${c.pieces} pcs, Cost ₹${c.cost}`
              : `${group.name}: ${group.categories.length} items`
          )
          .join(' | ')
      : 'No categories added yet';

  const currentProjectName = projectMeta?.name || eventName || 'My Project';

  const contextSummary = `Project: ${currentProjectName}; Event: ${
    eventName || 'Not set'
  } (${eventLocation || 'Not set'}, Footfall: ${
    expectedFootfall > 0 ? expectedFootfall : 'Not added yet'
  }); Stock: ${activeMixSummary}; Total Investment: ₹${
    stallTotals.totalCost
  }; Event Expenses: ₹${stallTotals.totalEventCosts}`;

  return {
    auth,
    activeTab,
    setActiveTab,
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
    setGlobalSellThrough,
    projectMeta,
    categoryGroups,
    setCategoryGroups,
    activeGroupId,
    setActiveGroupId,
    savedPlans,
    purchaseProgress,
    actualSales: combinedActualSales,
    manualActualSales: actualSales,
    liveSelling,
    conversations,
    activeConversationId,
    orderPreparedAtMs,
    copied,
    fullOrderCopied,
    stallSetup,
    setStallSetup,
    marketResearch,
    setMarketResearch,
    stallStock,
    aiAuditLoading,
    aiAuditReport,
    aiAuditError,
    coachBanner,
    setCoachBanner,
    highlightedSection,
    coachOpen,
    setCoachOpen,
    accountDrawerOpen,
    setAccountDrawerOpen,
    accountDrawerTab,
    setAccountDrawerTab,
    guestMode,
    setGuestMode,
    showNewProjectWizard,
    setShowNewProjectWizard,
    undoStack,
    productDrafts,
    resolvedGroups,
    overviewTotals,
    activeResolved,
    activeGroup,
    generatedCombos,
    activeCombo,
    activeSearchMeta,
    totalProductsCount,
    stallTotals,
    plannerSnapshot,
    effectiveAccountContext,
    activeMixSummary,
    currentProjectName,
    contextSummary,
    showToast,
    pushUndoSnapshot,
    updateActiveGroup,
    createEmptyCategoryGroup,
    createGroupFromTemplate,
    duplicateCategoryGroup,
    moveCategoryGroup,
    removeCategoryGroup,
    renameCategoryGroup,
    selectGroupCombo,
    toggleRule,
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
    handleUndo,
    handleSendProductDraft,
    handleAcceptProductDraft,
    handleDismissProductDraft,
    applyWorkspaceSnapshot,
    handleCompleteProjectSetup,
    stepQty,
    setPlannedQty,
    copyOrder,
    copyFullOrder,
    handleSaveStockPlan,
    handleLoadSavedStockPlan,
    handleDeleteSavedStockPlan,
    handleUpdatePurchaseProgress,
    handleRecordActualSale,
    handleRemoveActualSale,
    handleUpdateConversations,
    applyGlobalSellThrough,
    updateStockItem,
    addBlankStockItem,
    removeStockItem,
    addEventCost,
    updateEventCost,
    runAiPlanReview,
    handleApplyPlaybookIdea,
  };
}

export type StallWorkspaceController = ReturnType<typeof useStallWorkspace>;
