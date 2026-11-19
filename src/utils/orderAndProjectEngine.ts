import type {
  ActualSaleRecord,
  CategoryGroupResolved,
  CoachConversation,
  CoachMessageRecord,
  DiversifiedOverviewTotals,
  EventReadinessItem,
  MarketResearchRecord,
  PlannerSnapshot,
  ProjectMetadata,
  ProjectStatus,
  ProjectType,
  PurchaseItemProgress,
  PurchaseStatus,
  SavedPlanCategorySnapshot,
  SavedStockPlan,
  SmartAlertItem,
  StallSetupPlan,
  StallTotals,
  StockCategoryGroup,
} from '../types/stall.js';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  exhibition_stall: 'Exhibition / Jewellery Stall',
  popup_shop: 'Pop-up Shop',
  retail_business: 'Retail Business',
  instagram_store: 'Instagram Store',
  custom: 'Other',
};

export function beautyToFiveScale(beauty: number): number {
  const n = Number(beauty);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return Math.min(5, Math.max(1, Math.round(n / 2)));
}

export function fiveScaleToBeauty(stars: number): number {
  const clamped = Math.min(5, Math.max(1, Math.round(Number(stars) || 3)));
  return clamped * 2;
}

export function createEmptyProjectSnapshot(params: {
  id?: string;
  projectName: string;
  eventName: string;
  type: ProjectType;
  eventLocation?: string;
  eventDate?: string;
  expectedFootfall?: number;
  stallFee?: number;
  description?: string;
}): PlannerSnapshot {
  const now = Date.now();
  const id =
    (params.id && params.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)) ||
    `proj_${now}`;
  const cleanProjectName = params.projectName.trim().slice(0, 100) || 'My Project';
  const cleanEventName = params.eventName.trim().slice(0, 120) || cleanProjectName;
  const footfall =
    typeof params.expectedFootfall === 'number' &&
    Number.isFinite(params.expectedFootfall) &&
    params.expectedFootfall > 0
      ? Math.round(params.expectedFootfall)
      : 0;
  const rent =
    typeof params.stallFee === 'number' &&
    Number.isFinite(params.stallFee) &&
    params.stallFee > 0
      ? Math.round(params.stallFee)
      : 0;

  return {
    eventName: cleanEventName,
    eventLocation: (params.eventLocation || '').trim().slice(0, 120),
    eventDate: (params.eventDate || '').trim().slice(0, 40),
    expectedFootfall: footfall,
    budgetCap: 0,
    minProfitFloor: 0,
    stallFee: rent,
    maxPerCategory: 20,
    minColoursRule: 0,
    globalSellThrough: 90,
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
    stallStock: [],
    activeTab: 'optimizer',
    categoryGroups: [],
    activeGroupId: '',
    stallSetup: {
      widthFt: 8,
      depthFt: 6,
      stallType: 'tabletop',
      layoutNotes: '',
    },
    marketResearch: [],
    projectMeta: {
      id,
      name: cleanProjectName,
      type: params.type,
      ...(params.description?.trim()
        ? { description: params.description.trim().slice(0, 240) }
        : {}),
      status: 'ongoing',
      setupCompleted: true,
      createdAtMs: now,
      updatedAtMs: now,
    },
    savedPlans: [],
    purchaseProgress: {},
    actualSales: [],
    conversations: [],
    activeConversationId: null,
    orderPreparedAtMs: null,
  };
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  archived: 'Archived',
};

const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function makePurchaseItemKey(groupId: string, productId: string): string {
  return `${groupId}::${productId}`;
}

export function formatCategoryPurchaseOrder(
  resolvedGroup: CategoryGroupResolved,
  options?: { projectName?: string; eventName?: string }
): string {
  const { group, activeCombo } = resolvedGroup;
  if (!activeCombo) {
    return `${group.name.toUpperCase()} ORDER\n\nNo active stock combination selected yet.`;
  }

  const lines: string[] = [];
  lines.push(`${group.name.toUpperCase()} ORDER`);
  if (options?.projectName || options?.eventName) {
    const label = options.projectName || options.eventName || '';
    if (label) lines.push(`Project: ${label}`);
  }
  lines.push(`Selected mix: ${activeCombo.badge}`);
  lines.push('');

  let totalItems = 0;
  let totalCost = 0;

  group.categories.forEach((cat, idx) => {
    const qty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
    if (qty <= 0) return;
    const subtotal = qty * Math.max(0, Math.round(cat.cost));
    totalItems += qty;
    totalCost += subtotal;
    lines.push(`${cat.name}`);
    lines.push(`Wholesale price: ${fmtInr(cat.cost)}`);
    lines.push(`Quantity: ${qty}`);
    lines.push(`Subtotal: ${fmtInr(subtotal)}`);
    lines.push('');
  });

  if (totalItems === 0) {
    lines.push('No items with quantity > 0 selected in this category.');
    lines.push('');
  }

  lines.push(`TOTAL ITEMS: ${totalItems}`);
  lines.push(`CATEGORY TOTAL: ${fmtInr(totalCost)}`);

  return lines.join('\n').trim();
}

export function formatFullPurchaseOrder(
  resolvedGroups: CategoryGroupResolved[],
  options?: { projectName?: string; eventName?: string; eventDate?: string }
): string {
  const lines: string[] = [];
  const headerName = options?.projectName || options?.eventName || 'StallIQ Purchase Order';
  lines.push(`FULL SUPPLIER PURCHASE ORDER — ${headerName.toUpperCase()}`);
  if (options?.eventDate) {
    lines.push(`Date: ${options.eventDate}`);
  }
  lines.push('');

  let overallItems = 0;
  let overallTotal = 0;
  let includedCategories = 0;

  resolvedGroups.forEach((rg) => {
    const { group, activeCombo } = rg;
    if (!activeCombo) return;

    const itemLines: string[] = [];
    let catItems = 0;
    let catTotal = 0;

    group.categories.forEach((cat, idx) => {
      const qty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
      if (qty <= 0) return;
      const subtotal = qty * Math.max(0, Math.round(cat.cost));
      catItems += qty;
      catTotal += subtotal;
      itemLines.push(`- ${cat.name} | Wholesale: ${fmtInr(cat.cost)} | Qty: ${qty} | Subtotal: ${fmtInr(subtotal)}`);
    });

    if (catItems === 0) return;
    includedCategories += 1;
    overallItems += catItems;
    overallTotal += catTotal;

    lines.push(`[${group.name.toUpperCase()}] (${activeCombo.badge})`);
    lines.push(...itemLines);
    lines.push(`Category Subtotal: ${catItems} pcs · ${fmtInr(catTotal)}`);
    lines.push('');
  });

  if (includedCategories === 0) {
    lines.push('No stock quantities selected yet.');
    lines.push('');
  }

  lines.push('------------------------------');
  lines.push(`OVERALL QUANTITY: ${overallItems} pcs`);
  lines.push(`OVERALL WHOLESALE TOTAL: ${fmtInr(overallTotal)}`);

  return lines.join('\n').trim();
}

export function buildSupplierOrderCsv(resolvedGroups: CategoryGroupResolved[]): string {
  const rows: string[][] = [
    ['Category', 'Product', 'Wholesale Price (INR)', 'Quantity', 'Subtotal (INR)'],
  ];
  resolvedGroups.forEach(({ group, activeCombo }) => {
    if (!activeCombo) return;
    group.categories.forEach((cat, idx) => {
      const qty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
      if (qty <= 0) return;
      rows.push([
        group.name,
        cat.name,
        String(Math.round(cat.cost)),
        String(qty),
        String(qty * Math.round(cat.cost)),
      ]);
    });
  });
  return rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export async function copyTextReliable(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export interface PurchaseLineItemState {
  key: string;
  groupId: string;
  groupName: string;
  productId: string;
  productName: string;
  wholesaleCost: number;
  plannedQty: number;
  subtotalCost: number;
  status: PurchaseStatus;
  checked: boolean;
  receivedQty: number;
}

export interface PurchaseProgressSummary {
  lines: PurchaseLineItemState[];
  totalPlannedPieces: number;
  orderedPieces: number;
  receivedPieces: number;
  remainingPieces: number;
  checkedItemsCount: number;
  totalItemsCount: number;
  estimatedPurchaseAmount: number;
  receivedAmount: number;
  unreceivedItems: PurchaseLineItemState[];
  completionPct: number;
}

export function computePurchaseProgressSummary(
  resolvedGroups: CategoryGroupResolved[],
  progressMap: Record<string, PurchaseItemProgress> = {}
): PurchaseProgressSummary {
  const lines: PurchaseLineItemState[] = [];
  let totalPlannedPieces = 0;
  let orderedPieces = 0;
  let receivedPieces = 0;
  let checkedItemsCount = 0;
  let estimatedPurchaseAmount = 0;
  let receivedAmount = 0;

  resolvedGroups.forEach(({ group, activeCombo }) => {
    if (!activeCombo) return;
    group.categories.forEach((cat, idx) => {
      const plannedQty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
      if (plannedQty <= 0) return;

      const key = makePurchaseItemKey(group.id, cat.id);
      const saved = progressMap[key];
      const status: PurchaseStatus = saved?.status || 'not_ordered';
      const checked = Boolean(saved?.checked);
      const rawReceived =
        typeof saved?.receivedQty === 'number' && Number.isFinite(saved.receivedQty)
          ? Math.max(0, Math.round(saved.receivedQty))
          : status === 'received'
          ? plannedQty
          : 0;
      const receivedQty = Math.min(plannedQty, rawReceived);
      const unitCost = Math.max(0, Math.round(cat.cost));
      const subtotalCost = plannedQty * unitCost;

      totalPlannedPieces += plannedQty;
      estimatedPurchaseAmount += subtotalCost;
      receivedPieces += receivedQty;
      receivedAmount += receivedQty * unitCost;
      if (status === 'ordered' || status === 'received') {
        orderedPieces += plannedQty;
      }
      if (checked) checkedItemsCount += 1;

      lines.push({
        key,
        groupId: group.id,
        groupName: group.name,
        productId: cat.id,
        productName: cat.name,
        wholesaleCost: unitCost,
        plannedQty,
        subtotalCost,
        status,
        checked,
        receivedQty,
      });
    });
  });

  const remainingPieces = Math.max(0, totalPlannedPieces - receivedPieces);
  const unreceivedItems = lines.filter(
    (line) => line.status !== 'received' || line.receivedQty < line.plannedQty
  );
  const completionPct =
    totalPlannedPieces > 0
      ? Math.round((receivedPieces / totalPlannedPieces) * 100)
      : 0;

  return {
    lines,
    totalPlannedPieces,
    orderedPieces,
    receivedPieces,
    remainingPieces,
    checkedItemsCount,
    totalItemsCount: lines.length,
    estimatedPurchaseAmount,
    receivedAmount,
    unreceivedItems,
    completionPct,
  };
}

export function createSavedPlanSnapshot(
  name: string,
  resolvedGroups: CategoryGroupResolved[],
  overviewTotals: DiversifiedOverviewTotals
): SavedStockPlan {
  const now = Date.now();
  const categorySnapshots: SavedPlanCategorySnapshot[] = resolvedGroups.map(
    ({ group, activeCombo }) => {
      const items = activeCombo
        ? group.categories
            .map((cat, idx) => {
              const qty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
              if (qty <= 0) return null;
              return {
                productId: cat.id,
                productName: cat.name,
                wholesaleCost: Math.round(cat.cost),
                sellingPrice: Math.round(cat.price),
                qty,
                subtotalCost: qty * Math.round(cat.cost),
              };
            })
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
        : [];
      const categoryPieces = items.reduce((s, i) => s + i.qty, 0);
      const categoryWholesaleTotal = items.reduce((s, i) => s + i.subtotalCost, 0);
      return {
        groupId: group.id,
        groupName: group.name,
        budgetCap: group.budgetCap,
        comboLabel: activeCombo?.badge || 'Custom',
        items,
        categoryPieces,
        categoryWholesaleTotal,
      };
    }
  );

  const overallPieces = categorySnapshots.reduce((s, c) => s + c.categoryPieces, 0);
  const overallWholesaleTotal = categorySnapshots.reduce(
    (s, c) => s + c.categoryWholesaleTotal,
    0
  );

  return {
    id: `plan_${now}`,
    name: name.trim().slice(0, 80) || `Stock Plan ${new Date(now).toLocaleDateString('en-IN')}`,
    createdAtMs: now,
    updatedAtMs: now,
    categorySnapshots,
    overallPieces,
    overallWholesaleTotal,
    expectedRevenue: Math.round(overviewTotals.totalRevenue90),
    expectedProfit: Math.round(overviewTotals.totalProfit90),
  };
}

export interface SavedPlanPriceDrift {
  hasOutdatedPrices: boolean;
  driftedProducts: Array<{
    groupName: string;
    productName: string;
    savedCost: number;
    currentCost: number;
    savedPrice: number;
    currentPrice: number;
  }>;
}

export function detectSavedPlanOutdatedPrices(
  plan: SavedStockPlan,
  currentGroups: StockCategoryGroup[]
): SavedPlanPriceDrift {
  const driftedProducts: SavedPlanPriceDrift['driftedProducts'] = [];
  plan.categorySnapshots.forEach((catSnap) => {
    const liveGroup =
      currentGroups.find((g) => g.id === catSnap.groupId) ||
      currentGroups.find((g) => g.name.toLowerCase() === catSnap.groupName.toLowerCase());
    if (!liveGroup) return;

    catSnap.items.forEach((savedItem) => {
      const liveProd =
        liveGroup.categories.find((c) => c.id === savedItem.productId) ||
        liveGroup.categories.find(
          (c) => c.name.toLowerCase() === savedItem.productName.toLowerCase()
        );
      if (!liveProd) return;
      const curCost = Math.round(liveProd.cost);
      const curPrice = Math.round(liveProd.price);
      if (curCost !== Math.round(savedItem.wholesaleCost) || curPrice !== Math.round(savedItem.sellingPrice)) {
        driftedProducts.push({
          groupName: catSnap.groupName,
          productName: savedItem.productName,
          savedCost: Math.round(savedItem.wholesaleCost),
          currentCost: curCost,
          savedPrice: Math.round(savedItem.sellingPrice),
          currentPrice: curPrice,
        });
      }
    });
  });

  return {
    hasOutdatedPrices: driftedProducts.length > 0,
    driftedProducts,
  };
}

export interface ActualSalesSummary {
  recordsCount: number;
  totalPiecesSold: number;
  actualRevenue: number;
  actualCostOfGoodsSold: number;
  actualEstimatedProfit: number;
  plannedPieces: number;
  remainingStockPieces: number;
  plannedTargetRevenue: number;
  progressVsTargetPct: number;
  bestSellers: Array<{
    productName: string;
    categoryName: string;
    qtySold: number;
    revenue: number;
    profit: number;
  }>;
  remainingByProduct: Record<string, number>;
}

export function computeActualSalesSummary(
  records: ActualSaleRecord[],
  resolvedGroups: CategoryGroupResolved[],
  plannedTargetRevenue: number
): ActualSalesSummary {
  const plannedByKey = new Map<string, number>();
  let plannedPieces = 0;

  resolvedGroups.forEach(({ group, activeCombo }) => {
    if (!activeCombo) return;
    group.categories.forEach((cat, idx) => {
      const qty = Math.max(0, Math.round(activeCombo.counts[idx] || 0));
      plannedPieces += qty;
      plannedByKey.set(makePurchaseItemKey(group.id, cat.id), qty);
    });
  });

  let totalPiecesSold = 0;
  let actualRevenue = 0;
  let actualCostOfGoodsSold = 0;
  const soldByProduct = new Map<
    string,
    { productName: string; categoryName: string; qtySold: number; revenue: number; profit: number }
  >();
  const soldByKey = new Map<string, number>();

  records.forEach((rec) => {
    const qty = Math.max(0, Math.round(rec.qtySold));
    const unitSell = Math.max(0, Number(rec.actualPricePerUnit) || 0);
    const unitCost = Math.max(0, Number(rec.unitCost) || 0);
    const rev = qty * unitSell;
    const cogs = qty * unitCost;
    const profit = rev - cogs;

    totalPiecesSold += qty;
    actualRevenue += rev;
    actualCostOfGoodsSold += cogs;

    const itemKey = makePurchaseItemKey(rec.groupId, rec.productId);
    soldByKey.set(itemKey, (soldByKey.get(itemKey) || 0) + qty);

    const aggKey = `${rec.categoryName}::${rec.productName}`;
    const prev = soldByProduct.get(aggKey);
    if (prev) {
      prev.qtySold += qty;
      prev.revenue += rev;
      prev.profit += profit;
    } else {
      soldByProduct.set(aggKey, {
        productName: rec.productName,
        categoryName: rec.categoryName,
        qtySold: qty,
        revenue: rev,
        profit,
      });
    }
  });

  const remainingByProduct: Record<string, number> = {};
  plannedByKey.forEach((plannedQty, key) => {
    const sold = soldByKey.get(key) || 0;
    remainingByProduct[key] = Math.max(0, plannedQty - sold);
  });

  const bestSellers = Array.from(soldByProduct.values())
    .sort((a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue)
    .slice(0, 5);

  const actualEstimatedProfit = actualRevenue - actualCostOfGoodsSold;
  const remainingStockPieces = Math.max(0, plannedPieces - totalPiecesSold);
  const progressVsTargetPct =
    plannedTargetRevenue > 0
      ? Math.min(999, Math.round((actualRevenue / plannedTargetRevenue) * 100))
      : 0;

  return {
    recordsCount: records.length,
    totalPiecesSold,
    actualRevenue,
    actualCostOfGoodsSold,
    actualEstimatedProfit,
    plannedPieces,
    remainingStockPieces,
    plannedTargetRevenue,
    progressVsTargetPct,
    bestSellers,
    remainingByProduct,
  };
}

export function computeEventReadiness(params: {
  eventName: string;
  eventLocation?: string;
  resolvedGroups: CategoryGroupResolved[];
  totalBudget: number;
  purchaseSummary: PurchaseProgressSummary;
  orderPreparedAtMs?: number | null;
  stallSetup?: StallSetupPlan;
}): { items: EventReadinessItem[]; completedCount: number; totalCount: number; pct: number } {
  const hasEventDetails =
    params.eventName.trim().length >= 3 &&
    Boolean(params.eventLocation?.trim() || params.eventName.trim() !== 'Stall Event');
  const totalProducts = params.resolvedGroups.reduce(
    (s, rg) => s + rg.group.categories.length,
    0
  );
  const hasProducts = totalProducts > 0;
  const hasBudget = params.totalBudget >= 100;
  const hasGeneratedPlan = params.resolvedGroups.some((rg) => rg.combos.length > 0);
  const hasSelectedCombo = params.resolvedGroups.some(
    (rg) => rg.activeCombo !== null && rg.activeCombo.pieces > 0
  );
  const hasOrderPrepared =
    Boolean(params.orderPreparedAtMs) ||
    params.purchaseSummary.orderedPieces > 0 ||
    params.purchaseSummary.checkedItemsCount > 0;
  const hasStallLayout =
    Boolean(params.stallSetup?.layoutStyle) ||
    Boolean(params.stallSetup?.savedLayouts && params.stallSetup.savedLayouts.length > 0) ||
    Boolean(params.stallSetup?.layoutNotes?.trim());

  const items: EventReadinessItem[] = [
    { id: 'event', label: 'Event details added', done: hasEventDetails, actionTab: 'overview' },
    { id: 'products', label: 'Products added', done: hasProducts, actionTab: 'optimizer' },
    { id: 'budget', label: 'Budget set', done: hasBudget, actionTab: 'optimizer' },
    { id: 'plan', label: 'Stock plan generated', done: hasGeneratedPlan, actionTab: 'optimizer' },
    { id: 'combo', label: 'Combination selected', done: hasSelectedCombo, actionTab: 'optimizer' },
    { id: 'order', label: 'Purchase order prepared', done: hasOrderPrepared, actionTab: 'optimizer' },
    { id: 'layout', label: 'Stall layout created', done: hasStallLayout, actionTab: 'strategies' },
  ];

  const completedCount = items.filter((i) => i.done).length;
  return {
    items,
    completedCount,
    totalCount: items.length,
    pct: Math.round((completedCount / items.length) * 100),
  };
}

export function computeSmartAlerts(params: {
  resolvedGroups: CategoryGroupResolved[];
  stallTotals: StallTotals;
  savedPlans?: SavedStockPlan[];
  purchaseSummary: PurchaseProgressSummary;
  marketResearch?: MarketResearchRecord[];
}): SmartAlertItem[] {
  const alerts: SmartAlertItem[] = [];

  // 1. Selected combination exceeds category budget
  const overBudgetGroups = params.resolvedGroups.filter(
    (rg) => rg.activeCombo && rg.activeCombo.cost > rg.group.budgetCap
  );
  if (overBudgetGroups.length > 0) {
    const names = overBudgetGroups
      .map((rg) => `${rg.group.name} (+${fmtInr((rg.activeCombo?.cost || 0) - rg.group.budgetCap)})`)
      .join(', ');
    alerts.push({
      id: 'over_budget',
      severity: 'danger',
      title: 'Selection exceeds category budget',
      detail: names,
      actionLabel: 'Adjust quantities',
      actionTab: 'optimizer',
    });
  }

  // 2. Missing wholesale cost or selling price below wholesale cost
  const missingCost: string[] = [];
  const priceBelowCost: string[] = [];
  params.resolvedGroups.forEach(({ group }) => {
    group.categories.forEach((cat) => {
      if (cat.cost <= 0) missingCost.push(cat.name);
      else if (cat.price < cat.cost) priceBelowCost.push(cat.name);
    });
  });

  if (missingCost.length > 0) {
    alerts.push({
      id: 'missing_cost',
      severity: 'warning',
      title: 'Missing wholesale cost',
      detail: `${missingCost.slice(0, 3).join(', ')}${missingCost.length > 3 ? ` +${missingCost.length - 3} more` : ''}`,
      actionLabel: 'Fix products',
      actionTab: 'optimizer',
    });
  }

  if (priceBelowCost.length > 0) {
    alerts.push({
      id: 'price_below_cost',
      severity: 'danger',
      title: 'Selling price is below wholesale cost',
      detail: `${priceBelowCost.slice(0, 3).join(', ')}${priceBelowCost.length > 3 ? ` +${priceBelowCost.length - 3} more` : ''}`,
      actionLabel: 'Fix pricing',
      actionTab: 'optimizer',
    });
  }

  // 3. Negative profit after expenses
  if (params.stallTotals.totalUnits > 0 && params.stallTotals.netAfterStallReal < 0) {
    alerts.push({
      id: 'negative_profit',
      severity: 'danger',
      title: 'Estimated profit after expenses is negative',
      detail: `Short by ${fmtInr(Math.abs(params.stallTotals.netAfterStallReal))} at ${params.stallTotals.weightedSellThroughPct}% sell-through.`,
      actionLabel: 'Review stock',
      actionTab: 'optimizer',
    });
  }

  // 4. Saved plan contains outdated prices
  const currentGroups = params.resolvedGroups.map((rg) => rg.group);
  const outdatedPlans = (params.savedPlans || []).filter(
    (plan) => detectSavedPlanOutdatedPrices(plan, currentGroups).hasOutdatedPrices
  );
  if (outdatedPlans.length > 0) {
    alerts.push({
      id: 'outdated_plan',
      severity: 'info',
      title: `${outdatedPlans.length} saved plan${outdatedPlans.length > 1 ? 's have' : ' has'} older catalogue prices`,
      detail: `${outdatedPlans[0].name} was saved before recent product price edits.`,
      actionLabel: 'View plans',
      actionTab: 'optimizer',
    });
  }

  // 5. Ordered products still not received
  const orderedNotReceived = params.purchaseSummary.lines.filter(
    (l) => l.status === 'ordered' && l.receivedQty < l.plannedQty
  );
  if (orderedNotReceived.length > 0) {
    alerts.push({
      id: 'unreceived_orders',
      severity: 'warning',
      title: `${orderedNotReceived.length} ordered item${orderedNotReceived.length > 1 ? 's' : ''} not yet received`,
      detail: `${orderedNotReceived.slice(0, 2).map((l) => l.productName).join(', ')}${orderedNotReceived.length > 2 ? ` +${orderedNotReceived.length - 2} more` : ''}`,
      actionLabel: 'Purchase list',
      actionTab: 'optimizer',
    });
  }

  // 6. Research data insufficient (only if user ran research and none were grounded)
  const research = params.marketResearch || [];
  if (research.length > 0 && research.every((r) => !r.grounded)) {
    alerts.push({
      id: 'research_ungrounded',
      severity: 'info',
      title: 'Market research lacks verified web sources',
      detail: 'Verify local pricing manually or retry live research before ordering high-cost items.',
      actionLabel: 'Research',
      actionTab: 'research',
    });
  }

  return alerts;
}

export function sanitizeProjectMeta(
  raw: Partial<ProjectMetadata> | undefined | null,
  fallbackId: string,
  fallbackName: string
): ProjectMetadata {
  const validTypes: ProjectType[] = [
    'exhibition_stall',
    'popup_shop',
    'retail_business',
    'instagram_store',
    'custom',
  ];
  const validStatuses: ProjectStatus[] = ['ongoing', 'completed', 'archived'];
  const now = Date.now();
  const type: ProjectType =
    raw?.type && validTypes.includes(raw.type) ? raw.type : 'exhibition_stall';
  const status: ProjectStatus =
    raw?.status && validStatuses.includes(raw.status) ? raw.status : 'ongoing';
  const clean: ProjectMetadata = {
    id: (typeof raw?.id === 'string' && raw.id.trim().slice(0, 64)) || fallbackId,
    name:
      (typeof raw?.name === 'string' && raw.name.trim().slice(0, 100)) ||
      fallbackName.trim().slice(0, 100) ||
      'My Project',
    type,
    status,
    setupCompleted: typeof raw?.setupCompleted === 'boolean' ? raw.setupCompleted : true,
    createdAtMs:
      typeof raw?.createdAtMs === 'number' && Number.isFinite(raw.createdAtMs)
        ? raw.createdAtMs
        : now,
    updatedAtMs:
      typeof raw?.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs)
        ? raw.updatedAtMs
        : now,
  };
  if (typeof raw?.description === 'string' && raw.description.trim()) {
    clean.description = raw.description.trim().slice(0, 240);
  }
  return clean;
}

export function sanitizeSavedPlans(raw?: SavedStockPlan[] | null): SavedStockPlan[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim())
    .slice(0, 15)
    .map((p, idx) => ({
      id: (typeof p.id === 'string' && p.id.trim().slice(0, 64)) || `plan_${idx + 1}`,
      name: p.name.trim().slice(0, 80),
      createdAtMs:
        typeof p.createdAtMs === 'number' && Number.isFinite(p.createdAtMs)
          ? p.createdAtMs
          : Date.now(),
      updatedAtMs:
        typeof p.updatedAtMs === 'number' && Number.isFinite(p.updatedAtMs)
          ? p.updatedAtMs
          : Date.now(),
      categorySnapshots: Array.isArray(p.categorySnapshots)
        ? p.categorySnapshots.slice(0, 20).map((cs, cIdx) => ({
            groupId: (typeof cs?.groupId === 'string' && cs.groupId.slice(0, 64)) || `grp_${cIdx + 1}`,
            groupName: (typeof cs?.groupName === 'string' && cs.groupName.slice(0, 80)) || `Category ${cIdx + 1}`,
            budgetCap: Math.max(0, Math.round(Number(cs?.budgetCap) || 0)),
            comboLabel: (typeof cs?.comboLabel === 'string' && cs.comboLabel.slice(0, 60)) || 'Saved Mix',
            items: Array.isArray(cs?.items)
              ? cs.items.slice(0, 25).map((it, iIdx) => ({
                  productId:
                    (typeof it?.productId === 'string' && it.productId.slice(0, 64)) || `item_${iIdx + 1}`,
                  productName:
                    (typeof it?.productName === 'string' && it.productName.slice(0, 80)) || `Item ${iIdx + 1}`,
                  wholesaleCost: Math.max(0, Math.round(Number(it?.wholesaleCost) || 0)),
                  sellingPrice: Math.max(0, Math.round(Number(it?.sellingPrice) || 0)),
                  qty: Math.max(0, Math.round(Number(it?.qty) || 0)),
                  subtotalCost: Math.max(0, Math.round(Number(it?.subtotalCost) || 0)),
                }))
              : [],
            categoryPieces: Math.max(0, Math.round(Number(cs?.categoryPieces) || 0)),
            categoryWholesaleTotal: Math.max(
              0,
              Math.round(Number(cs?.categoryWholesaleTotal) || 0)
            ),
          }))
        : [],
      overallPieces: Math.max(0, Math.round(Number(p.overallPieces) || 0)),
      overallWholesaleTotal: Math.max(0, Math.round(Number(p.overallWholesaleTotal) || 0)),
      expectedRevenue: Math.max(0, Math.round(Number(p.expectedRevenue) || 0)),
      expectedProfit: Math.round(Number(p.expectedProfit) || 0),
    }));
}

export function sanitizePurchaseProgress(
  raw?: Record<string, PurchaseItemProgress> | null
): Record<string, PurchaseItemProgress> {
  if (!raw || typeof raw !== 'object') return {};
  const validStatuses: PurchaseStatus[] = ['not_ordered', 'ordered', 'received'];
  const out: Record<string, PurchaseItemProgress> = {};
  Object.entries(raw)
    .slice(0, 150)
    .forEach(([key, val]) => {
      if (!key || !val || typeof val !== 'object') return;
      const cleanKey = key.trim().slice(0, 140);
      if (!cleanKey) return;
      const status: PurchaseStatus = validStatuses.includes(val.status)
        ? val.status
        : 'not_ordered';
      out[cleanKey] = {
        status,
        checked: Boolean(val.checked),
        receivedQty: Math.max(0, Math.round(Number(val.receivedQty) || 0)),
        updatedAtMs:
          typeof val.updatedAtMs === 'number' && Number.isFinite(val.updatedAtMs)
            ? val.updatedAtMs
            : Date.now(),
      };
    });
  return out;
}

export function sanitizeActualSales(raw?: ActualSaleRecord[] | null): ActualSaleRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object' && typeof r.productName === 'string' && r.productName.trim())
    .slice(0, 200)
    .map((r, idx) => ({
      id: (typeof r.id === 'string' && r.id.trim().slice(0, 64)) || `sale_${idx + 1}`,
      groupId: (typeof r.groupId === 'string' && r.groupId.trim().slice(0, 64)) || 'grp_1',
      categoryName:
        (typeof r.categoryName === 'string' && r.categoryName.trim().slice(0, 80)) || 'General',
      productId: (typeof r.productId === 'string' && r.productId.trim().slice(0, 64)) || `item_${idx + 1}`,
      productName: r.productName.trim().slice(0, 80),
      qtySold: Math.max(1, Math.round(Number(r.qtySold) || 1)),
      actualPricePerUnit: Math.max(0, Math.round(Number(r.actualPricePerUnit) || 0)),
      unitCost: Math.max(0, Math.round(Number(r.unitCost) || 0)),
      recordedAtMs:
        typeof r.recordedAtMs === 'number' && Number.isFinite(r.recordedAtMs)
          ? r.recordedAtMs
          : Date.now(),
    }));
}

export function sanitizeConversations(raw?: CoachConversation[] | null): CoachConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object' && typeof c.id === 'string')
    .slice(0, 12)
    .map((c, idx) => {
      const messages: CoachMessageRecord[] = Array.isArray(c.messages)
        ? c.messages
            .filter(
              (m) =>
                m &&
                typeof m === 'object' &&
                typeof m.text === 'string' &&
                m.text.trim().length > 0 &&
                (m.role === 'user' || m.role === 'coach' || m.role === 'system')
            )
            .slice(-40)
            .map((m, mIdx) => {
              const cleanMsg: CoachMessageRecord = {
                id: (typeof m.id === 'string' && m.id.slice(0, 64)) || `msg_${mIdx + 1}`,
                role: m.role,
                text: m.text.trim().slice(0, 1600),
                createdAtMs:
                  typeof m.createdAtMs === 'number' && Number.isFinite(m.createdAtMs)
                    ? m.createdAtMs
                    : Date.now(),
              };
              if (Array.isArray(m.changes) && m.changes.length > 0) {
                cleanMsg.changes = m.changes
                  .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                  .slice(0, 6)
                  .map((x) => x.trim().slice(0, 140));
              }
              if (typeof m.orderCopyText === 'string' && m.orderCopyText.trim()) {
                cleanMsg.orderCopyText = m.orderCopyText.trim().slice(0, 4000);
              }
              return cleanMsg;
            })
        : [];
      return {
        id: c.id.trim().slice(0, 64) || `conv_${idx + 1}`,
        title: (typeof c.title === 'string' && c.title.trim().slice(0, 80)) || 'Coaching Chat',
        createdAtMs:
          typeof c.createdAtMs === 'number' && Number.isFinite(c.createdAtMs)
            ? c.createdAtMs
            : Date.now(),
        updatedAtMs:
          typeof c.updatedAtMs === 'number' && Number.isFinite(c.updatedAtMs)
            ? c.updatedAtMs
            : Date.now(),
        messages,
      };
    });
}

export function buildProjectSnapshotSummary(
  projectId: string,
  snapshot: PlannerSnapshot,
  totalBudget: number,
  totalStockCost: number,
  totalPieces: number
) {
  const meta = sanitizeProjectMeta(snapshot.projectMeta, projectId, snapshot.eventName);
  return {
    id: projectId,
    name: meta.name,
    type: meta.type,
    description: meta.description,
    status: meta.status,
    eventName: snapshot.eventName,
    eventLocation: snapshot.eventLocation || '',
    totalBudget,
    totalStockCost,
    totalPieces,
    createdAtMs: meta.createdAtMs,
    updatedAtMs: meta.updatedAtMs,
  };
}
