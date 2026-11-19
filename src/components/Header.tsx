import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Check,
  ChevronDown,
  Compass,
  FolderKanban,
  LayoutGrid,
  Layers,
  LogIn,
  Plus,
  Search,
  Sparkles,
  Undo2,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { ActiveWorkspaceTab, AppTab } from '../types/stall';
import { PROJECT_TYPE_LABELS } from '../utils/orderAndProjectEngine';
import { PWAInstallButton } from './PWAInstallButton';

export const NAV_ITEMS: Array<{
  id: ActiveWorkspaceTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Overview', icon: LayoutGrid },
  { id: 'sell', label: 'Live Selling', mobileLabel: 'Sell', icon: Zap },
  { id: 'optimizer', label: 'Categories & Products', mobileLabel: 'Products', icon: Layers },
  { id: 'strategies', label: 'Stall Setup', mobileLabel: 'Setup', icon: Compass },
  { id: 'research', label: 'Market Research', mobileLabel: 'Research', icon: Search },
];

interface AppShellNavProps {
  activeTab: AppTab;
  onTabChange: (tab: ActiveWorkspaceTab) => void;
  projectName: string;
  eventName: string;
  totalBudget: number;
  totalStockCost: number;
  totalProductsCount: number;
  coachOpen: boolean;
  onOpenCoach: () => void;
  onOpenAccountDrawer: (initialTab?: 'projects' | 'profile' | 'memory') => void;
  onOpenNewProject: () => void;
  onOpenLoginScreen?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function DesktopSidebar({
  activeTab,
  onTabChange,
  totalBudget,
  totalStockCost,
  totalProductsCount,
  coachOpen,
  onOpenCoach,
  onOpenAccountDrawer,
  onOpenLoginScreen,
}: AppShellNavProps) {
  const { user, profile, memories, projects, signingIn, isFirebaseConfigured, signInWithGoogle } =
    useAuth();

  const normalizedTab: ActiveWorkspaceTab =
    activeTab === 'calculator' ? 'overview' : activeTab;

  const hasBudget = totalBudget > 0;
  const usedPct = hasBudget
    ? Math.min(100, Math.round((totalStockCost / Math.max(1, totalBudget)) * 100))
    : 0;
  const remaining = totalBudget - totalStockCost;

  const accountLabel = profile
    ? profile.preferredName || profile.businessName || profile.displayName.split(' ')[0]
    : '';

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 lg:left-0 z-30 bg-[#100E18] border-r border-[#221E33]">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-[#221E33]/80">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onTabChange('overview');
          }}
          className="flex items-center gap-2.5 group"
        >
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#5B21B6] flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(139,92,246,0.55)]">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-[#F5F3FA]">
            StallIQ
          </span>
        </a>
      </div>

      {/* Primary 4 Sections */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-5 space-y-1.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = normalizedTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#8B5CF6]/20 to-[#8B5CF6]/5 text-[#F5F3FA] border border-[#8B5CF6]/40 shadow-[0_0_24px_-8px_rgba(139,92,246,0.55)]'
                  : 'text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#A78BFA]' : 'text-[#78718E]'
                }`}
              />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Compact Live Stock Readout (No "Need Attention" element) */}
      <div className="px-4 pb-4 space-y-3">
        <div className="surface-inset rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#A29BB8]">Planned stock</span>
            <span className="font-mono text-[#C4B5FD]">
              {totalProductsCount} {totalProductsCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-bold text-[#F5F3FA]">
              {fmt(totalStockCost)}
            </span>
            {hasBudget && (
              <span className="text-[11px] text-[#A29BB8]">/ {fmt(totalBudget)}</span>
            )}
          </div>
          {hasBudget ? (
            <>
              <div className="h-1.5 rounded-full bg-[#1C1829] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    remaining < 0
                      ? 'bg-[#FB7185]'
                      : 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]'
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#A29BB8]">
                {remaining >= 0
                  ? `${fmt(remaining)} remaining`
                  : `${fmt(Math.abs(remaining))} over budget`}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[#78718E]">
              {totalStockCost > 0 ? 'Based on planned quantities' : 'Add products to calculate cost'}
            </div>
          )}
        </div>

        {/* AI Coach Dock Trigger */}
        <button
          type="button"
          onClick={onOpenCoach}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
            coachOpen
              ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#C4B5FD]'
              : 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white shadow-[0_8px_22px_-6px_rgba(139,92,246,0.5)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{coachOpen ? 'AI Coach Open' : 'AI Coach'}</span>
        </button>

        <PWAInstallButton variant="desktop-sidebar" />

        {/* Projects + Account Control */}
        {user && profile ? (
          <button
            type="button"
            onClick={() => onOpenAccountDrawer('projects')}
            aria-label="Open Projects, Profile and Saved Memory"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#161322] hover:bg-[#1E1A2E] border border-[#252136] text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full border border-[#8B5CF6]/40 object-cover shrink-0"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD] flex items-center justify-center text-[11px] font-bold shrink-0">
                  {accountLabel.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-medium text-[#F5F3FA] truncate">{accountLabel}</span>
            </div>
            {memories.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#C4B5FD]">
                <BrainCircuit className="w-3 h-3" />
                {memories.length}
              </span>
            )}
          </button>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => onOpenAccountDrawer('projects')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#161322] hover:bg-[#1E1A2E] border border-[#252136] text-xs font-medium text-[#D6D1E6] transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Projects</span>
              </span>
              <span className="text-[11px] font-mono text-[#A29BB8]">{projects.length}</span>
            </button>
            <button
              type="button"
              disabled={signingIn}
              onClick={() => {
                if (onOpenLoginScreen) onOpenLoginScreen();
                else if (isFirebaseConfigured) void signInWithGoogle();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#13111C] hover:bg-[#1E1A2E] border border-[#252136] text-xs font-medium text-[#A29BB8] hover:text-[#F5F3FA] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{signingIn ? 'Signing in...' : 'Sign in to sync'}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function TopBar({
  activeTab,
  onTabChange,
  projectName,
  eventName,
  totalStockCost,
  onOpenAccountDrawer,
  onOpenNewProject,
  onOpenLoginScreen,
  canUndo,
  onUndo,
}: AppShellNavProps) {
  const {
    user,
    profile,
    projects,
    activeProjectId,
    switchProject,
    signingIn,
    isFirebaseConfigured,
    signInWithGoogle,
  } = useAuth();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const { isOnline } = usePWAInstall();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedTab: ActiveWorkspaceTab =
    activeTab === 'calculator' ? 'overview' : activeTab;

  const sectionTitle =
    NAV_ITEMS.find((n) => n.id === normalizedTab)?.label || 'Overview';

  return (
    <header className="sticky top-0 z-20 h-14 lg:h-16 bg-[#0B0A10]/85 backdrop-blur-md border-b border-[#221E33]/80 px-4 lg:px-8 flex items-center justify-between gap-3">
      {/* Left: Mobile Brand + Section + Compact Project Switcher */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => onTabChange('overview')}
          className="lg:hidden flex items-center gap-1.5 shrink-0"
          aria-label="StallIQ Home"
        >
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#5B21B6] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </span>
        </button>

        <span className="hidden lg:inline font-display text-sm font-bold text-[#F5F3FA] shrink-0">
          {sectionTitle}
        </span>
        <span className="hidden lg:inline text-[#322C47]">/</span>

        {/* Project Switcher Dropdown */}
        <div ref={switcherRef} className="relative min-w-0">
          <button
            type="button"
            onClick={() => setSwitcherOpen((o) => !o)}
            aria-label="Switch project"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#151221] hover:bg-[#1C182C] border border-[#28233C] text-xs font-medium text-[#F5F3FA] max-w-[200px] sm:max-w-[260px] transition-colors"
          >
            <span className="truncate">{projectName || eventName || 'My Project'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#A29BB8] shrink-0" />
          </button>

          {switcherOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl surface-glass border border-[#2E2942] shadow-2xl py-2 z-40">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#78718E]">
                Your Projects ({projects.length})
              </div>
              <div className="max-h-60 overflow-y-auto px-1.5 space-y-0.5">
                {projects.map((p) => {
                  const isCurrent = p.id === activeProjectId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        switchProject(p.id);
                        setSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? 'bg-[#8B5CF6]/15 text-[#F5F3FA]'
                          : 'text-[#D6D1E6] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.name}</div>
                        <div className="text-[10px] text-[#A29BB8] truncate">
                          {PROJECT_TYPE_LABELS[p.type]}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 pt-1.5 px-2 border-t border-[#252136] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    onOpenNewProject();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#C4B5FD] text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    onOpenAccountDrawer('projects');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#A29BB8] hover:text-[#F5F3FA] hover:bg-white/5"
                >
                  Manage
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Offline + Undo + Planned Stock + Mobile Profile/Projects */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {!isOnline && (
          <span
            title="Offline — Live Selling saves locally and syncs when reconnected"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/35 text-[11px] font-semibold text-[#FCD34D]"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

        {canUndo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            aria-label="Undo last change"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#252136] border border-[#2E2942] text-xs font-semibold text-[#C4B5FD] transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>
        )}

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl surface-inset text-xs font-mono tabular-nums">
          <span className="text-[#A29BB8] font-sans text-[11px]">Stock cost</span>
          <span className="font-semibold text-[#F5F3FA]">{fmt(totalStockCost)}</span>
        </div>

        {/* Mobile Profile / Projects Button */}
        <div className="lg:hidden flex items-center gap-1.5">
          {user && profile ? (
            <button
              type="button"
              onClick={() => onOpenAccountDrawer('projects')}
              aria-label="Open Projects and Profile"
              className="w-8 h-8 rounded-full bg-[#1A1726] border border-[#2E2942] flex items-center justify-center overflow-hidden"
            >
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-[#C4B5FD]">
                  {(profile.preferredName || profile.displayName).charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => {
                if (onOpenLoginScreen) onOpenLoginScreen();
                else if (isFirebaseConfigured) void signInWithGoogle();
              }}
              aria-label="Sign in"
              className="p-2 rounded-xl bg-[#1A1726] border border-[#2E2942] text-[#A29BB8] hover:text-[#F5F3FA]"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AppTab;
  onTabChange: (tab: ActiveWorkspaceTab) => void;
}) {
  const normalizedTab: ActiveWorkspaceTab =
    activeTab === 'calculator' ? 'overview' : activeTab;

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 surface-glass border-t border-[#2E2942]/80 px-2 py-1.5"
    >
      <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
        {NAV_ITEMS.map(({ id, mobileLabel, icon: Icon }) => {
          const isActive = normalizedTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-[#C4B5FD] bg-[#8B5CF6]/15'
                  : 'text-[#A29BB8] hover:text-[#F5F3FA]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#A78BFA]' : ''}`} />
              <span>{mobileLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
