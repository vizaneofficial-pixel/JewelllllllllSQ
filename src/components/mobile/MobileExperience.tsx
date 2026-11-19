import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Sparkles,
  User,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import { triggerHaptic } from '../../utils/experienceMode';
import { PWAInstallButton } from '../PWAInstallButton';
import { MobileAiCoachScreen } from './MobileAiCoachScreen';
import { MobileBottomNav, type MobileNavTab } from './MobileBottomNav';
import { MobileHomeScreen } from './MobileHomeScreen';
import { MobileInsightsScreen } from './MobileInsightsScreen';
import { MobileProfileSheet } from './MobileProfileSheet';
import { MobileProjectsSheet } from './MobileProjectsSheet';
import { MobileStallScreen } from './MobileStallScreen';
import {
  MobileStockScreen,
  type MobileStockSubMode,
} from './MobileStockScreen';
import { LiveSellingWorkspace } from '../selling/LiveSellingWorkspace';

interface MobileExperienceProps {
  workspace: StallWorkspaceController;
}

export function MobileExperience({ workspace }: MobileExperienceProps) {
  const {
    auth,
    activeTab,
    setActiveTab,
    currentProjectName,
    coachBanner,
    setCoachBanner,
    undoStack,
    handleUndo,
    setGuestMode,
  } = workspace;

  const { user, profile, authError, clearAuthError } = auth;
  const { isOnline } = usePWAInstall();

  // Map shared desktop tab smoothly into the dedicated mobile architecture
  const [mobileTab, setMobileTab] = useState<MobileNavTab>(() => {
    if (activeTab === 'sell') return 'sell';
    if (activeTab === 'strategies') return 'stall';
    if (activeTab === 'research') return 'insights';
    return 'home';
  });
  const [stockSubMode, setStockSubMode] =
    useState<MobileStockSubMode>('inventory');
  const [addProductTrigger, setAddProductTrigger] = useState(0);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // If AI Coach updates workspace activeTab (e.g., "Open Overview" or "Open Live Selling"), reflect it
  useEffect(() => {
    if (mobileTab === 'coach') return;
    if (activeTab === 'sell') setMobileTab('sell');
    else if (activeTab === 'strategies') setMobileTab('stall');
    else if (activeTab === 'research') setMobileTab('insights');
  }, [activeTab]);

  const handleSelectMobileTab = (next: MobileNavTab) => {
    setMobileTab(next);
    if (next === 'home') setActiveTab('overview');
    else if (next === 'stock') setActiveTab('optimizer');
    else if (next === 'sell') setActiveTab('sell');
    else if (next === 'stall') setActiveTab('strategies');
    else if (next === 'insights') setActiveTab('overview');
  };

  const handleOpenStockSubMode = (mode: MobileStockSubMode) => {
    setStockSubMode(mode);
    setMobileTab('stock');
    setActiveTab('optimizer');
  };

  const handleOpenAddProduct = () => {
    setStockSubMode('inventory');
    setMobileTab('stock');
    setActiveTab('optimizer');
    setAddProductTrigger((n) => n + 1);
  };

  return (
    <div
      id="top"
      data-experience="mobile"
      className="min-h-[100dvh] bg-[#0B0A10] text-[#F5F3FA] flex flex-col"
    >
      {/* Compact Sticky Top App Header (~52px so header + bottom nav <= 14% of phone viewport) */}
      <header
        data-testid="mobile-top-bar"
        className="sticky top-0 z-30 bg-[#0B0A10]/92 backdrop-blur-xl border-b border-[#221E33] pt-safe"
      >
        <div className="max-w-lg mx-auto h-[52px] px-3.5 flex items-center justify-between gap-2">
          {/* Project Switcher Trigger */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              setProjectsOpen(true);
            }}
            aria-label="Switch project"
            className="min-h-[40px] max-w-[62%] px-2.5 -ml-1 rounded-xl hover:bg-[#161322] inline-flex items-center gap-2 text-left active:scale-[0.98] transition-transform"
          >
            <img
              src="/icon.svg"
              alt=""
              aria-hidden="true"
              className="w-6 h-6 rounded-lg shrink-0"
            />
            <span className="font-display text-sm font-bold text-[#F5F3FA] truncate">
              {currentProjectName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#9D95B8] shrink-0" />
          </button>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isOnline && (
              <span
                title="Offline — cloud sync and AI require an internet connection"
                className="w-8 h-8 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center"
              >
                <WifiOff className="w-3.5 h-3.5" />
              </span>
            )}

            <PWAInstallButton variant="compact" />

            {undoStack.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  handleUndo();
                }}
                aria-label="Undo last change"
                className="w-10 h-10 rounded-xl bg-[#161322] border border-[#252136] text-[#C4B5FD] flex items-center justify-center active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setProfileOpen(true);
              }}
              aria-label="Account and settings"
              className="w-10 h-10 rounded-xl bg-[#161322] border border-[#252136] flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={profile?.preferredName || user.displayName || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-[#C4B5FD]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Mobile Scroll Canvas */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-3 pb-[92px]">
        {authError && (
          <div className="mb-3 rounded-2xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#FDA4AF]">
            <span className="truncate">{authError}</span>
            <div className="flex items-center gap-2 shrink-0">
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
                OK
              </button>
            </div>
          </div>
        )}

        {coachBanner && (
          <div className="mb-3 rounded-2xl bg-[#8B5CF6]/18 border border-[#8B5CF6]/45 px-3.5 py-2 text-xs text-[#C4B5FD] flex items-center justify-between gap-2">
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

        {mobileTab === 'home' && (
          <MobileHomeScreen
            workspace={workspace}
            onNavigate={handleSelectMobileTab}
            onOpenStockSubMode={handleOpenStockSubMode}
            onOpenAddProduct={handleOpenAddProduct}
          />
        )}

        {mobileTab === 'stock' && (
          <MobileStockScreen
            workspace={workspace}
            subMode={stockSubMode}
            onSubModeChange={setStockSubMode}
            openAddTrigger={addProductTrigger}
          />
        )}

        {mobileTab === 'coach' && (
          <MobileAiCoachScreen workspace={workspace} />
        )}

        {mobileTab === 'sell' && (
          <LiveSellingWorkspace
            workspace={workspace}
            onOpenStockManager={() => handleOpenStockSubMode('inventory')}
          />
        )}

        {mobileTab === 'stall' && (
          <MobileStallScreen workspace={workspace} />
        )}

        {mobileTab === 'insights' && (
          <MobileInsightsScreen workspace={workspace} />
        )}
      </main>

      <MobileBottomNav
        activeTab={mobileTab}
        onSelect={handleSelectMobileTab}
        coachLive={false}
      />

      <MobileProjectsSheet
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        workspace={workspace}
      />

      <MobileProfileSheet
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        workspace={workspace}
      />
    </div>
  );
}
