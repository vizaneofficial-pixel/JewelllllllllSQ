export type AppTab = 'overview' | 'sell' | 'optimizer' | 'strategies' | 'research' | 'calculator';

export type ActiveWorkspaceTab = 'overview' | 'sell' | 'optimizer' | 'strategies' | 'research';

export type ZoneId = 'front_left' | 'center_tray' | 'right_mirror' | 'back_riser';

export type OptimizationObjective =
  | 'best_overall'
  | 'highest_profit'
  | 'balanced_variety'
  | 'lowest_risk'
  | 'best_appeal'
  | 'best_budget_use'
  | 'conservative_sales'
  | 'high_footfall'
  | 'small_budget';

export type StallType = 'tabletop' | 'corner_booth' | 'open_canopy' | 'indoor_kiosk';

export type LayoutPresetStyle = 'classic_u' | 'open_gallery' | 'counter_focus';

export interface SavedStallLayout {
  id: string;
  name: string;
  widthFt: number;
  depthFt: number;
  stallType: StallType;
  layoutStyle: LayoutPresetStyle;
  zoneCategoryOverrides: Partial<Record<ZoneId, string[]>>;
  savedAtMs: number;
}

export interface DailySalesTracker {
  sellingDays: number;
  actualRevenueEntered?: number | null;
  actualPiecesEntered?: number | null;
}

export interface StallSetupPlan {
  widthFt: number;
  depthFt: number;
  stallType: StallType;
  layoutStyle?: LayoutPresetStyle;
  layoutNotes?: string;
  zoneCategoryOverrides?: Partial<Record<ZoneId, string[]>>;
  savedLayouts?: SavedStallLayout[];
  dailyTracker?: DailySalesTracker;
}

export interface PriorityWeights {
  profit: number;      // 0-100
  variety: number;     // 0-100
  appeal: number;      // 0-100
  budgetUsage: number; // 0-100
  lowRisk: number;     // 0-100
}

export interface ProductDraft {
  id: string;
  name: string;
  targetCategoryId?: string;
  targetCategoryName?: string;
  cost: number;
  price: number;
  beauty: number;
  notes?: string;
  sourceQuery?: string;
}

export type OpportunityRating =
  | 'strong'
  | 'promising'
  | 'cautious'
  | 'insufficient_data';

export interface ProductOpportunityAssessment {
  id: string;
  name: string;
  categoryName: string;
  cost: number;
  price: number;
  profitPerPiece: number;
  marginPct: number;
  appeal: number;
  stockingRisk: 'Low' | 'Medium' | 'High' | 'Unknown';
  demandEvidence: string | null;
  competitionSignal: string | null;
  suggestedQtyMin: number | null;
  suggestedQtyMax: number | null;
  rating: OpportunityRating;
  ratingLabel: string;
  missingDataHints: string[];
  summaryReason: string;
}

export interface ProductBundleSuggestion {
  id: string;
  title: string;
  items: Array<{ name: string; cost: number; price: number }>;
  combinedCost: number;
  combinedSellingPrice: number;
  bundlePrice: number;
  discountAmount: number;
  estimatedProfit: number;
  marginPct: number;
  isProfitable: boolean;
  warning?: string;
  reason: string;
}

export interface GroundedSource {
  title: string;
  uri: string;
}

export interface VerifiedResearchFact {
  claim: string;
  sourceTitle: string;
  sourceUrl: string;
  dateNote?: string;
}

export interface MarketResearchRecord {
  id: string;
  query: string;
  topic: string;
  createdAtMs: number;
  retrievedDate: string;
  grounded: boolean;
  summary: string;
  verifiedFacts: VerifiedResearchFact[];
  interpretation: string[];
  hypothesesToValidate: string[];
  checklist: string[];
  sources: GroundedSource[];
  fallbackReason?: string;
}

export interface BangleCategory {
  id: string;
  name: string;
  shortName: string;
  cost: number;
  price: number;
  priceMin?: number | null;
  priceMax?: number | null;
  plannedQty?: number | null;
  minQty?: number | null;
  maxQty?: number | null;
  beauty: number;
  notes?: string;
  imageUrl?: string;
  barColor: string;
  textClass: string;
  bgClass: string;
}

export interface OptimizerRules {
  allAtLeastOne: boolean;
  evenDistribution: boolean;
  beautyFirst: boolean;
  maxProfitFocus: boolean;
  safe90Mode: boolean;
}

export interface OptimizerConfig {
  budgetCap: number;
  minProfitFloor: number;
  maxPerCategory: number;
  minColoursRule: number;
  conservativeSellThroughPct?: number;
  objective?: OptimizationObjective;
  priorityWeights?: PriorityWeights;
}

export interface SearchMetadata {
  searchMode: 'exact' | 'bounded';
  statesEvaluated: number;
  candidateCount: number;
  truncated: boolean;
  maxStates: number;
  objective: OptimizationObjective;
}

export interface BangleCombo {
  id: string;
  rank: number;
  label: string;
  badge: string;
  keywords: string[];
  badgeColor: string;
  counts: number[];
  cost: number;
  rev100: number;
  prof100: number;
  rev90: number;
  prof90: number;
  revMin100?: number;
  revMax100?: number;
  profMin100?: number;
  profMax100?: number;
  sellThroughPct: number;
  unsoldRiskCost: number;
  breakEvenSellThroughPct: number;
  budgetUtilizationPct?: number;
  distinctItemsCount?: number;
  reason: string;
  pieces: number;
  avgBeauty: number;
  evenness: number;
  marginPct: number;
  score: number;
  objective?: OptimizationObjective;
  isCustom?: boolean;
}

export interface StockCategoryGroup {
  id: string;
  name: string;
  accentColor: string;
  budgetCap: number;
  minProfitFloor: number;
  maxPerCategory: number;
  minColoursRule: number;
  conservativeSellThroughPct?: number;
  objective?: OptimizationObjective;
  priorityWeights?: PriorityWeights;
  savedComboIds?: string[];
  rules: OptimizerRules;
  categories: BangleCategory[];
  selectedComboId: string | null;
  customQuantities: number[] | null;
}

export interface CategoryGroupResolved {
  group: StockCategoryGroup;
  combos: BangleCombo[];
  activeCombo: BangleCombo | null;
  searchMeta?: SearchMetadata;
}

export interface DiversifiedOverviewTotals {
  totalAllocatedBudget: number;
  totalInvestment: number;
  totalRevenue100: number;
  totalRevenue90: number;
  totalProfit100: number;
  totalProfit90: number;
  totalPieces: number;
  weightedBeauty: number;
  blendedMarginPct: number;
  weightedConservativeSellThroughPct: number;
  unsoldInventoryCostConservative: number;
  totalEventCosts: number;
  totalOutlay: number;
  netProfit100AfterCosts: number;
  netProfitConservativeAfterCosts: number;
  breakEvenSellThroughPct: number;
  unitsToBreakEven: number;
  footfallConversionNeeded: number;
}

export interface PlanHealthSummary {
  status: 'healthy' | 'attention' | 'risky';
  label: 'Healthy' | 'Needs attention' | 'Risky';
  headline: string;
  reasons: string[];
}

export interface StallStockItem {
  id: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  qty: number;
  sellThrough: number;
  isSyncedBundle: boolean;
  unitPieces?: number;
  groupId?: string;
  itemType?: 'stock' | 'event_cost';
  sellThroughManual?: boolean;
}

export interface StallStockRow extends StallStockItem {
  lineCost: number;
  lineRev100: number;
  lineProfit100: number;
  lineRevReal: number;
  lineProfitReal: number;
  roiPct: number;
  marginPct: number;
  unitsCount: number;
}

export interface StallTotals {
  itemRows: StallStockRow[];
  eventCostRows: StallStockRow[];
  totalCost: number;
  otherEventCosts: number;
  totalEventCosts: number;
  totalOutlay: number;
  rev100: number;
  revRealistic: number;
  grossProfit100: number;
  grossProfitReal: number;
  netAfterStall100: number;
  netAfterStallReal: number;
  unsoldInventoryCost: number;
  weightedSellThroughPct: number;
  totalUnits: number;
  breakEvenCoveragePct: number;
  breakEvenSellThroughPct: number;
  unitsToBreakEven: number;
  footfallConversionNeeded: number;
  blendedMarginPct: number;
  capitalMultiple: number;
  rentBurdenPct: number;
  avgItemPrice: number;
  topRoiItemName: string;
  topRoiPct: number;
}

export type AiFocusSection =
  | 'categories'
  | 'budget'
  | 'combos'
  | 'overview_totals'
  | 'overview_cards'
  | 'overview_costs'
  | 'cfo_summary'
  | 'cfo_costs'
  | 'cfo_ledger'
  | 'playbook_layout'
  | 'playbook_approaches'
  | 'playbook_resources'
  | 'research_workspace';

export interface PlaybookCard {
  id: string;
  number: string;
  title: string;
  desc: string;
  metric: string;
  imageUrl: string;
  imageAlt: string;
}

export interface PlaybookZoneInfo {
  id: ZoneId;
  shortTitle: string;
  placementLabel: string;
  title: string;
  subtitle: string;
  items: string;
  why: string;
  imageUrl: string;
}

export type PlaybookIdeaAction =
  | { type: 'prioritize_rule'; groupId: string; rule: 'beautyFirst' | 'maxProfitFocus' | 'safe90Mode' }
  | { type: 'set_objective'; groupId: string; objective: OptimizationObjective }
  | { type: 'set_sell_through'; groupId: string; pct: number }
  | { type: 'select_combo_rank'; groupId: string; comboId: string }
  | { type: 'add_event_cost'; name: string; amount: number }
  | { type: 'add_cfo_bundle'; name: string; category: string; cost: number; price: number; qty: number };

export interface CategorySalesApproach {
  id: string;
  title: string;
  summary: string;
  tag: string;
  metric: string;
  actionLabel?: string;
  action?: PlaybookIdeaAction;
}

export interface VideoGuide {
  id: string;
  title: string;
  tag: string;
  duration: string;
  keyTakeaway: string;
  queryUrl: string;
}

export interface LocalParseResult {
  budgetCap?: number;
  minProfitFloor?: number;
  stallFee?: number;
  maxPerCategory?: number;
  minColoursRule?: number;
  eventName?: string;
  eventLocation?: string;
  expectedFootfall?: number;
  navigateToTab?: AppTab;
  targetGroupName?: string;
  selectComboRank?: number;
  objective?: OptimizationObjective;
  ruleUpdates: Partial<OptimizerRules>;
  categoryUpdates: Array<{ id: string; cost?: number; price?: number; beauty?: number }>;
  stockAdditions: StallStockItem[];
  eventCostAdditions?: Array<{ name: string; cost: number }>;
  changes: string[];
}

export interface PendingAiConfirmation {
  id: string;
  summary: string;
  changes: string[];
  proposedState: PlannerSnapshot;
  focusSection?: AiFocusSection | null;
  reason: string;
}

export type ProjectType =
  | 'exhibition_stall'
  | 'popup_shop'
  | 'retail_business'
  | 'instagram_store'
  | 'custom';

export type ProjectStatus = 'ongoing' | 'completed' | 'archived';

export interface ProjectMetadata {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  status: ProjectStatus;
  setupCompleted?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  status: ProjectStatus;
  eventName: string;
  eventLocation?: string;
  totalBudget: number;
  totalStockCost: number;
  totalPieces: number;
  updatedAtMs: number;
  createdAtMs: number;
}

export interface SavedPlanLineItem {
  productId: string;
  productName: string;
  wholesaleCost: number;
  sellingPrice: number;
  qty: number;
  subtotalCost: number;
}

export interface SavedPlanCategorySnapshot {
  groupId: string;
  groupName: string;
  budgetCap: number;
  comboLabel: string;
  items: SavedPlanLineItem[];
  categoryPieces: number;
  categoryWholesaleTotal: number;
}

export interface SavedStockPlan {
  id: string;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
  categorySnapshots: SavedPlanCategorySnapshot[];
  overallPieces: number;
  overallWholesaleTotal: number;
  expectedRevenue: number;
  expectedProfit: number;
}

export type PurchaseStatus = 'not_ordered' | 'ordered' | 'received';

export interface PurchaseItemProgress {
  status: PurchaseStatus;
  checked: boolean;
  receivedQty: number;
  updatedAtMs: number;
}

export interface ActualSaleRecord {
  id: string;
  groupId: string;
  categoryName: string;
  productId: string;
  productName: string;
  qtySold: number;
  actualPricePerUnit: number;
  unitCost: number;
  recordedAtMs: number;
}

export interface CoachMessageRecord {
  id: string;
  role: 'user' | 'coach' | 'system';
  text: string;
  createdAtMs: number;
  changes?: string[];
  orderCopyText?: string;
}

export interface CoachConversation {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  messages: CoachMessageRecord[];
}

export interface EventReadinessItem {
  id: string;
  label: string;
  done: boolean;
  actionTab: ActiveWorkspaceTab;
}

export interface SmartAlertItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  actionLabel?: string;
  actionTab?: ActiveWorkspaceTab;
}

export interface PlannerSnapshot {
  eventName: string;
  eventLocation?: string;
  eventDate?: string;
  expectedFootfall: number;
  budgetCap: number;
  minProfitFloor: number;
  stallFee: number;
  maxPerCategory: number;
  minColoursRule: number;
  globalSellThrough: number;
  rules: OptimizerRules;
  categories: BangleCategory[];
  selectedComboId: string | null;
  customQuantities: number[] | null;
  stallStock: StallStockItem[];
  activeTab: AppTab;
  categoryGroups?: StockCategoryGroup[];
  activeGroupId?: string;
  stallSetup?: StallSetupPlan;
  marketResearch?: MarketResearchRecord[];
  projectMeta?: ProjectMetadata;
  savedPlans?: SavedStockPlan[];
  purchaseProgress?: Record<string, PurchaseItemProgress>;
  actualSales?: ActualSaleRecord[];
  conversations?: CoachConversation[];
  activeConversationId?: string | null;
  orderPreparedAtMs?: number | null;
}

export interface SaleScalePreset {
  id: string;
  label: string;
  eventName: string;
  expectedFootfall: number;
  budgetCap: number;
  minProfitFloor: number;
  stallFee: number;
  maxPerCategory: number;
}

export type AiMemoryCategory = 'inventory' | 'pricing' | 'event' | 'preference' | 'strategy';

export interface AiMemoryAddition {
  fact: string;
  category: AiMemoryCategory;
}

export interface AiMemoryItem {
  id: string;
  ownerId: string;
  fact: string;
  category: AiMemoryCategory;
  source: 'voice' | 'command' | 'manual';
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  preferredName: string;
  photoURL: string;
  businessName: string;
  preferredScale: string;
}

export interface AccountAiContext {
  preferredName?: string;
  displayName?: string;
  businessName?: string;
  preferredScale?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  activeProjectType?: ProjectType;
  otherProjects?: Array<{
    id: string;
    name: string;
    type: ProjectType;
    status: ProjectStatus;
    eventName: string;
  }>;
  memories: Array<{ fact: string; category: string }>;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other' | 'unrecorded';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'failed' | 'local_only';

export type SaleTransactionStatus = 'completed' | 'reversed' | 'corrected';

export interface LiveSaleLineItem {
  lineId: string;
  groupId: string;
  categoryNameSnapshot: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  originalUnitPrice: number;
  perUnitDiscount: number;
  actualUnitPrice: number;
  originalTotalValue: number;
  totalDiscount: number;
  actualTotalRevenue: number;
  purchaseCostPerUnitSnapshot: number;
  totalCogs: number;
  realizedGrossProfit: number;
  stockTracked: boolean;
}

export interface LiveSaleTransaction {
  id: string;
  userId: string;
  projectId: string;
  sessionId: string;
  isBasket: boolean;
  items: LiveSaleLineItem[];
  primaryProductId: string;
  primaryProductName: string;
  primaryCategoryName: string;
  totalQuantity: number;
  originalTotalValue: number;
  totalDiscount: number;
  actualTotalRevenue: number;
  totalCogs: number;
  realizedGrossProfit: number;
  paymentMethod: PaymentMethod;
  timestampMs: number;
  status: SaleTransactionStatus;
  syncStatus: SyncState;
  syncedAtMs: number | null;
  syncError: string | null;
  stockConflict: boolean;
  stockConflictNote: string | null;
  stockConflictResolved: boolean;
  reversalOfTransactionId: string | null;
  reversedByTransactionId: string | null;
  correctionOfTransactionId: string | null;
  correctedByTransactionId: string | null;
  note?: string;
  deviceId?: string;
}

export interface LiveInventoryItem {
  key: string;
  groupId: string;
  categoryName: string;
  categoryColor: string;
  productId: string;
  productName: string;
  shortName: string;
  sellingPrice: number;
  purchaseCost: number;
  imageUrl?: string;
  barColor: string;
  plannedQty: number | null;
  purchasedQty: number | null;
  trackedBaseQty: number | null;
  soldQty: number;
  availableQty: number | null;
  oversoldBy: number;
  isStockTracked: boolean;
  isSoldOut: boolean;
  isPinned: boolean;
  saleFrequency: number;
  lastSoldAtMs: number | null;
}

export interface DailySalesReport {
  generatedAtMs: number;
  sessionId: string | null;
  dateKey: string;
  sessionLabel: string;
  totalUnitsSold: number;
  transactionCount: number;
  originalSalesValue: number;
  totalDiscounts: number;
  actualRevenue: number;
  costOfGoodsSold: number;
  realizedGrossProfit: number;
  averageTransactionValue: number;
  averageDiscountPerUnit: number;
  remainingTrackedStockUnits: number;
  untrackedProductsCount: number;
  paymentBreakdown: Record<PaymentMethod, { revenue: number; count: number }>;
  productReport: Array<{
    productId: string;
    groupId: string;
    productName: string;
    categoryName: string;
    unitsSold: number;
    originalValue: number;
    totalDiscount: number;
    revenue: number;
    cogs: number;
    realizedGrossProfit: number;
  }>;
  categoryReport: Array<{
    groupId: string;
    categoryName: string;
    unitsSold: number;
    originalValue: number;
    totalDiscount: number;
    revenue: number;
    cogs: number;
    realizedGrossProfit: number;
  }>;
  reversedCount: number;
  pendingSyncCount: number;
  conflictCount: number;
}

export interface LiveSellingSession {
  id: string;
  projectId: string;
  dateKey: string;
  label: string;
  status: 'open' | 'closed';
  startedAtMs: number;
  closedAtMs: number | null;
  defaultPaymentMethod: PaymentMethod;
  pendingSyncOnClose: boolean;
  closedReportSnapshot: DailySalesReport | null;
}

export interface LiveBasketEntry {
  key: string;
  groupId: string;
  categoryName: string;
  productId: string;
  productName: string;
  originalUnitPrice: number;
  purchaseCostPerUnit: number;
  stockTracked: boolean;
  availableQty: number | null;
  quantity: number;
  perUnitDiscount: number;
}
