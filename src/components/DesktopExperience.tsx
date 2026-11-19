import React from 'react';
import { Sparkles } from 'lucide-react';
import { AccountMemoryDrawer } from './AccountMemoryDrawer';
import { DesktopSidebar, MobileBottomNav, TopBar } from './Header';
import { MarketResearchTab } from './MarketResearchTab';
import { OptimizerTab } from './OptimizerTab';
import { OverviewTab } from './OverviewTab';
import { StrategiesTab } from './StrategiesTab';
import { VoiceCoachModal } from './VoiceCoachModal';
import { LiveSellingWorkspace } from './selling/LiveSellingWorkspace';
import {
  DEFAULT_RULES,
  type StallWorkspaceController,
} from '../hooks/useStallWorkspace';

interface DesktopExperienceProps {
  workspace: StallWorkspaceController;
}

export function DesktopExperience({ workspace }: DesktopExperienceProps) {
  const {
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
    activeGroup,
    activeCombo,
    activeSearchMeta,
    generatedCombos,
    resolvedGroups,
    overviewTotals,
    stallTotals,
    totalProductsCount,
    actualSales,
    savedPlans,
    purchaseProgress,
    conversations,
    activeConversationId,
    copied,
    fullOrderCopied,
    stallSetup,
    setStallSetup,
    marketResearch,
    setMarketResearch,
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
    setGuestMode,
    setShowNewProjectWizard,
    undoStack,
    productDrafts,
    plannerSnapshot,
    effectiveAccountContext,
    activeMixSummary,
    currentProjectName,
    contextSummary,
    setActiveGroupId,
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
    pushUndoSnapshot,
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
  } = workspace;

  const { user, authError, clearAuthError, addMemoriesBatch } = auth;

  const navProps = {
    activeTab,
    onTabChange: setActiveTab,
    projectName: currentProjectName,
    eventName,
    totalBudget: overviewTotals.totalAllocatedBudget,
    totalStockCost: stallTotals.totalCost,
    totalProductsCount,
    coachOpen,
    onOpenCoach: () => setCoachOpen((prev) => !prev),
    onOpenAccountDrawer: (tab: 'projects' | 'profile' | 'memory' = 'projects') => {
      setAccountDrawerTab(tab);
      setAccountDrawerOpen(true);
    },
    onOpenNewProject: () => setShowNewProjectWizard(true),
    onOpenLoginScreen: () => setGuestMode(false),
    canUndo: undoStack.length > 0,
    onUndo: handleUndo,
  };

  return (
    <div id="top" data-experience="desktop" className="min-h-screen bg-[#0B0A10] text-[#F5F3FA]">
      <DesktopSidebar {...navProps} />

      <div className="lg:pl-60 min-h-screen flex flex-col">
        <TopBar {...navProps} />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-12 space-y-5">
          {authError && (
            <div className="bg-[#FB7185]/12 border border-[#FB7185]/35 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#FDA4AF]">
              <span>{authError}</span>
              <div className="flex items-center gap-3 shrink-0">
                {!user && (
                  <button
                    type="button"
                    onClick={() => setGuestMode(false)}
                    className="text-[#C4B5FD] font-semibold underline"
                  >
                    Sign in
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="text-[#F5F3FA] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {coachBanner && (
            <div className="bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 rounded-xl px-4 py-2 text-xs text-[#C4B5FD] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                <span className="truncate">{coachBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setCoachBanner(null)}
                className="text-[#F5F3FA] font-semibold shrink-0"
              >
                OK
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              preferredName={effectiveAccountContext?.preferredName}
              projectName={currentProjectName}
              eventName={eventName}
              eventLocation={eventLocation}
              eventDate={eventDate}
              expectedFootfall={expectedFootfall}
              stallFee={stallFee}
              globalSellThrough={globalSellThrough}
              resolvedGroups={resolvedGroups}
              overviewTotals={overviewTotals}
              stallTotals={stallTotals}
              eventCostRows={stallTotals.eventCostRows}
              actualSales={actualSales}
              fullOrderCopied={fullOrderCopied}
              highlightedSection={highlightedSection}
              onEventNameChange={setEventName}
              onEventLocationChange={setEventLocation}
              onEventDateChange={setEventDate}
              onExpectedFootfallChange={setExpectedFootfall}
              onStallFeeChange={setStallFee}
              onApplyGlobalSellThrough={applyGlobalSellThrough}
              onAddEventCost={addEventCost}
              onUpdateEventCost={updateEventCost}
              onRemoveEventCost={removeStockItem}
              onUpdateStockItem={updateStockItem}
              onAddStockItem={addBlankStockItem}
              onRemoveStockItem={removeStockItem}
              onSelectGroupCombo={selectGroupCombo}
              onEditCategoryGroup={(groupId) => {
                setActiveGroupId(groupId);
                setActiveTab('optimizer');
              }}
              onAddCategoryGroup={() => setActiveTab('optimizer')}
              onCopyFullOrder={() => void copyFullOrder()}
              onRecordActualSale={handleRecordActualSale}
              onRemoveActualSale={handleRemoveActualSale}
              onOpenStockPlanner={() => setActiveTab('optimizer')}
              onOpenStallSetup={() => setActiveTab('strategies')}
              onOpenResearch={() => setActiveTab('research')}
              aiAuditLoading={aiAuditLoading}
              aiAuditReport={aiAuditReport}
              aiAuditError={aiAuditError}
              onRunPlanReview={runAiPlanReview}
            />
          )}

          {activeTab === 'sell' && (
            <LiveSellingWorkspace
              workspace={workspace}
              onOpenStockManager={() => setActiveTab('optimizer')}
            />
          )}

          {activeTab === 'optimizer' && (
            <OptimizerTab
              projectName={currentProjectName}
              eventName={eventName}
              resolvedGroups={resolvedGroups}
              activeGroupId={activeGroup?.id || ''}
              highlightedSection={highlightedSection}
              onSelectGroup={(id) => setActiveGroupId(id)}
              onCreateEmptyGroup={createEmptyCategoryGroup}
              onCreateGroupFromTemplate={createGroupFromTemplate}
              onDuplicateGroup={duplicateCategoryGroup}
              onMoveGroup={moveCategoryGroup}
              onRemoveGroup={removeCategoryGroup}
              onRenameGroup={renameCategoryGroup}
              categories={activeGroup?.categories || []}
              generatedCombos={generatedCombos}
              activeCombo={activeCombo}
              searchMeta={activeSearchMeta}
              objective={activeGroup?.objective || 'best_overall'}
              onObjectiveChange={setActiveObjective}
              priorityWeights={activeGroup?.priorityWeights}
              onPriorityWeightsChange={setActivePriorityWeights}
              savedComboIds={activeGroup?.savedComboIds || []}
              onToggleSavedCombo={toggleSavedCombo}
              onDuplicateComboToCustom={duplicateComboToCustom}
              productDrafts={productDrafts}
              onAcceptProductDraft={handleAcceptProductDraft}
              onDismissProductDraft={handleDismissProductDraft}
              rules={activeGroup?.rules || DEFAULT_RULES}
              budgetCap={activeGroup?.budgetCap ?? 0}
              minProfitFloor={activeGroup?.minProfitFloor ?? 0}
              stallFee={stallFee}
              maxPerCategory={activeGroup?.maxPerCategory ?? 20}
              conservativeSellThroughPct={
                activeGroup?.conservativeSellThroughPct ?? globalSellThrough
              }
              copied={copied}
              fullOrderCopied={fullOrderCopied}
              savedPlans={savedPlans}
              purchaseProgress={purchaseProgress}
              onUpdateCatFields={updateCatFields}
              onQuickAddProduct={quickAddProduct}
              onBulkAddProducts={bulkAddProducts}
              onDuplicateCat={duplicateCat}
              onRemoveCat={removeCat}
              onToggleRule={toggleRule}
              onBudgetCapChange={(val) =>
                updateActiveGroup((g) => ({ ...g, budgetCap: val }))
              }
              onMinProfitFloorChange={(val) =>
                updateActiveGroup((g) => ({ ...g, minProfitFloor: val }))
              }
              onMaxPerCategoryChange={(val) =>
                updateActiveGroup((g) => ({ ...g, maxPerCategory: val }))
              }
              onConservativeSellThroughChange={(pct) =>
                updateActiveGroup((g) => ({ ...g, conservativeSellThroughPct: pct }))
              }
              onSelectCombo={(id) =>
                updateActiveGroup((g) => ({
                  ...g,
                  selectedComboId: id,
                  customQuantities: null,
                }))
              }
              onStepQty={stepQty}
              onSetPlannedQty={setPlannedQty}
              onResetCustomQty={() =>
                updateActiveGroup((g) => ({ ...g, customQuantities: null }))
              }
              onCopyOrder={() => void copyOrder()}
              onCopyFullOrder={() => void copyFullOrder()}
              onSaveStockPlan={handleSaveStockPlan}
              onLoadSavedStockPlan={handleLoadSavedStockPlan}
              onDeleteSavedStockPlan={handleDeleteSavedStockPlan}
              onUpdatePurchaseProgress={handleUpdatePurchaseProgress}
              onOpenCoach={() => setCoachOpen(true)}
              onOpenOverview={() => setActiveTab('overview')}
              onRelaxConstraints={relaxConstraints}
            />
          )}

          {activeTab === 'strategies' && (
            <StrategiesTab
              eventName={eventName || currentProjectName}
              eventLocation={eventLocation}
              expectedFootfall={expectedFootfall}
              activeMixSummary={activeMixSummary}
              stallFee={stallFee}
              expectedRevenue={stallTotals.revRealistic}
              breakEvenSalesAmount={stallTotals.totalOutlay}
              totalPieces={stallTotals.totalUnits}
              breakEvenPieces={stallTotals.unitsToBreakEven}
              resolvedGroups={resolvedGroups}
              stallSetup={stallSetup}
              onUpdateStallSetup={(patch) =>
                setStallSetup((prev) => ({ ...prev, ...patch }))
              }
              accountContext={effectiveAccountContext}
              onApplyPlaybookIdea={handleApplyPlaybookIdea}
              onOpenOptimizerGroup={(groupId) => {
                setActiveGroupId(groupId);
                setActiveTab('optimizer');
              }}
            />
          )}

          {activeTab === 'research' && (
            <MarketResearchTab
              eventName={eventName || currentProjectName}
              eventLocation={eventLocation}
              resolvedGroups={resolvedGroups}
              totalBudget={overviewTotals.totalAllocatedBudget}
              records={marketResearch}
              onSaveRecord={(rec) =>
                setMarketResearch((prev) => [rec, ...prev].slice(0, 12))
              }
              onDeleteRecord={(id) =>
                setMarketResearch((prev) => prev.filter((r) => r.id !== id))
              }
              onSendProductDraft={handleSendProductDraft}
              accountContext={effectiveAccountContext}
            />
          )}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {!coachOpen && (
        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          aria-label="Open AI Coach"
          className="lg:hidden fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_12px_32px_-6px_rgba(139,92,246,0.65)] transition-transform hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Coach</span>
        </button>
      )}

      <AccountMemoryDrawer
        isOpen={accountDrawerOpen}
        initialTab={accountDrawerTab}
        onClose={() => setAccountDrawerOpen(false)}
        onStartNewProject={() => {
          setAccountDrawerOpen(false);
          setShowNewProjectWizard(true);
        }}
        onOpenLoginScreen={() => {
          setAccountDrawerOpen(false);
          setGuestMode(false);
        }}
      />

      <VoiceCoachModal
        isOpen={coachOpen}
        onClose={() => setCoachOpen(false)}
        contextSummary={contextSummary}
        plannerSnapshot={plannerSnapshot}
        accountContext={effectiveAccountContext}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onUpdateConversations={handleUpdateConversations}
        onApplyAiState={(next, changes, focus) => {
          pushUndoSnapshot();
          applyWorkspaceSnapshot(next, changes, focus);
        }}
        onMemoryAdditions={(items) => {
          if (user && items.length > 0) {
            void addMemoriesBatch(items, 'voice');
          }
        }}
      />
    </div>
  );
}
