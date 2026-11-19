import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  Compass,
  ExternalLink,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  PackagePlus,
  Sparkles,
  Tag,
  Target,
  Trash2,
} from 'lucide-react';
import type {
  AccountAiContext,
  CategoryGroupResolved,
  LayoutPresetStyle,
  PlaybookIdeaAction,
  SavedStallLayout,
  StallSetupPlan,
  StallType,
  ZoneId,
} from '../types/stall';
import {
  buildCategorySalesApproaches,
  buildDynamicLearningResources,
  buildDynamicStallZones,
} from '../utils/playbookEngine';
import {
  buildCustomerInteractionScripts,
  buildPlacementRecommendations,
  buildPricingIdeas,
  buildProductBundles,
  calculateDailyTargets,
  LAYOUT_PRESETS,
} from '../utils/strategyBuilder';

interface StrategiesTabProps {
  eventName: string;
  eventLocation: string;
  expectedFootfall: number;
  activeMixSummary: string;
  stallFee: number;
  expectedRevenue: number;
  breakEvenSalesAmount: number;
  totalPieces: number;
  breakEvenPieces: number;
  resolvedGroups: CategoryGroupResolved[];
  stallSetup: StallSetupPlan;
  onUpdateStallSetup: (patch: Partial<StallSetupPlan>) => void;
  accountContext?: AccountAiContext;
  onApplyPlaybookIdea: (action: PlaybookIdeaAction) => string;
  onOpenOptimizerGroup: (groupId: string) => void;
}

const STALL_TYPES: Array<{ id: StallType; label: string }> = [
  { id: 'tabletop', label: 'Tabletop' },
  { id: 'corner_booth', label: 'Corner Booth' },
  { id: 'open_canopy', label: 'Open Canopy' },
  { id: 'indoor_kiosk', label: 'Indoor Kiosk' },
];

const SIZE_PRESETS = [
  { label: '6×4 ft', widthFt: 6, depthFt: 4 },
  { label: '8×6 ft', widthFt: 8, depthFt: 6 },
  { label: '10×10 ft', widthFt: 10, depthFt: 10 },
];

const ZONE_META: Record<
  ZoneId,
  { short: string; badge: string; accent: string }
> = {
  front_left: { short: 'Front Showcase', badge: 'Attention-Grabber', accent: '#8B5CF6' },
  center_tray: { short: 'Center Impulse', badge: 'Impulse-Buy', accent: '#F59E0B' },
  right_mirror: { short: 'Payment Counter', badge: 'Try & Billing', accent: '#38BDF8' },
  back_riser: { short: 'Rear Risers', badge: 'Eye-Level Premium', accent: '#34D399' },
};

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function StrategiesTab({
  eventName,
  eventLocation,
  expectedFootfall,
  stallFee,
  expectedRevenue,
  breakEvenSalesAmount,
  totalPieces,
  breakEvenPieces,
  resolvedGroups,
  stallSetup,
  onUpdateStallSetup,
  onApplyPlaybookIdea,
  onOpenOptimizerGroup,
}: StrategiesTabProps) {
  const [subTab, setSubTab] = useState<'layout' | 'selling'>('layout');
  const [selectedZone, setSelectedZone] = useState<ZoneId>('front_left');
  const [dragCategory, setDragCategory] = useState<string | null>(null);
  const [dropHoverZone, setDropHoverZone] = useState<ZoneId | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    resolvedGroups[0]?.group.id || ''
  );
  const [appliedIdeaNotes, setAppliedIdeaNotes] = useState<Record<string, string>>({});
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualUrl, setVisualUrl] = useState<string | null>(null);
  const [visualError, setVisualError] = useState<string | null>(null);

  // Save named layout state
  const [layoutNameInput, setLayoutNameInput] = useState('');
  const [layoutSavedToast, setLayoutSavedToast] = useState<string | null>(null);

  // Bundle discount tester (undefined = auto safe discount)
  const [customDiscountPct, setCustomDiscountPct] = useState<number | undefined>(undefined);

  const activeCategoryResolved = useMemo(
    () =>
      resolvedGroups.find((rg) => rg.group.id === selectedGroupId) ||
      resolvedGroups[0],
    [resolvedGroups, selectedGroupId]
  );

  const venueDisplay = eventLocation.trim()
    ? `${eventName} (${eventLocation.trim()})`
    : eventName;

  const zones = useMemo(
    () =>
      buildDynamicStallZones(
        venueDisplay,
        expectedFootfall,
        stallFee,
        resolvedGroups
      ),
    [venueDisplay, expectedFootfall, stallFee, resolvedGroups]
  );

  const placementRecommendations = useMemo(
    () => buildPlacementRecommendations(resolvedGroups, stallSetup),
    [resolvedGroups, stallSetup]
  );

  const productBundles = useMemo(
    () => buildProductBundles(resolvedGroups, customDiscountPct),
    [resolvedGroups, customDiscountPct]
  );

  const pricingIdeas = useMemo(
    () => buildPricingIdeas(resolvedGroups),
    [resolvedGroups]
  );

  const interactionScripts = useMemo(
    () => buildCustomerInteractionScripts(resolvedGroups, eventName),
    [resolvedGroups, eventName]
  );

  const dailyTargets = useMemo(
    () =>
      calculateDailyTargets({
        expectedRevenue,
        breakEvenSalesAmount,
        totalPieces,
        breakEvenPieces,
        tracker: stallSetup.dailyTracker,
      }),
    [expectedRevenue, breakEvenSalesAmount, totalPieces, breakEvenPieces, stallSetup.dailyTracker]
  );

  const salesApproaches = useMemo(() => {
    if (!activeCategoryResolved) return [];
    return buildCategorySalesApproaches(
      activeCategoryResolved.group,
      activeCategoryResolved.combos,
      activeCategoryResolved.activeCombo,
      venueDisplay
    );
  }, [activeCategoryResolved, venueDisplay]);

  const learningResources = useMemo(
    () => buildDynamicLearningResources(venueDisplay, resolvedGroups),
    [venueDisplay, resolvedGroups]
  );

  const zoneOverrides = stallSetup.zoneCategoryOverrides || {};
  const savedLayouts = stallSetup.savedLayouts || [];
  const activeLayoutStyle: LayoutPresetStyle = stallSetup.layoutStyle || 'classic_u';
  const isDefaultDimensions =
    stallSetup.widthFt === 8 && stallSetup.depthFt === 6 && !stallSetup.layoutNotes;

  const toggleCategoryInZone = (zoneId: ZoneId, categoryName: string) => {
    const current = zoneOverrides[zoneId] || [];
    const nextList = current.includes(categoryName)
      ? current.filter((n) => n !== categoryName)
      : [...current, categoryName];
    onUpdateStallSetup({
      zoneCategoryOverrides: {
        ...zoneOverrides,
        [zoneId]: nextList,
      },
    });
  };

  const assignDraggedCategory = (zoneId: ZoneId, categoryName: string) => {
    const current = zoneOverrides[zoneId] || [];
    if (!current.includes(categoryName)) {
      onUpdateStallSetup({
        zoneCategoryOverrides: {
          ...zoneOverrides,
          [zoneId]: [...current, categoryName],
        },
      });
    }
    setSelectedZone(zoneId);
    setDragCategory(null);
    setDropHoverZone(null);
  };

  const applyLayoutPreset = (presetId: LayoutPresetStyle) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const catNames = resolvedGroups.map((rg) => rg.group.name);
    onUpdateStallSetup({
      layoutStyle: preset.id,
      stallType: preset.recommendedType,
      zoneCategoryOverrides: preset.zoneMap(catNames),
    });
  };

  const handleSaveCurrentLayout = () => {
    const cleanName =
      layoutNameInput.trim() ||
      `${stallSetup.widthFt}×${stallSetup.depthFt} ${
        LAYOUT_PRESETS.find((p) => p.id === activeLayoutStyle)?.name || 'Custom'
      }`;
    const nextEntry: SavedStallLayout = {
      id: `layout_${Date.now()}`,
      name: cleanName.slice(0, 60),
      widthFt: stallSetup.widthFt,
      depthFt: stallSetup.depthFt,
      stallType: stallSetup.stallType,
      layoutStyle: activeLayoutStyle,
      zoneCategoryOverrides: { ...zoneOverrides },
      savedAtMs: Date.now(),
    };
    const nextList = [nextEntry, ...savedLayouts].slice(0, 8);
    onUpdateStallSetup({ savedLayouts: nextList });
    setLayoutNameInput('');
    setLayoutSavedToast(`Saved "${nextEntry.name}"`);
    window.setTimeout(() => setLayoutSavedToast(null), 2600);
  };

  const handleLoadSavedLayout = (saved: SavedStallLayout) => {
    onUpdateStallSetup({
      widthFt: saved.widthFt,
      depthFt: saved.depthFt,
      stallType: saved.stallType,
      layoutStyle: saved.layoutStyle,
      zoneCategoryOverrides: { ...(saved.zoneCategoryOverrides || {}) },
    });
    setLayoutSavedToast(`Loaded "${saved.name}"`);
    window.setTimeout(() => setLayoutSavedToast(null), 2400);
  };

  const handleDeleteSavedLayout = (id: string) => {
    onUpdateStallSetup({
      savedLayouts: savedLayouts.filter((l) => l.id !== id),
    });
  };

  const updateDailyTracker = (patch: Partial<NonNullable<StallSetupPlan['dailyTracker']>>) => {
    onUpdateStallSetup({
      dailyTracker: {
        sellingDays: stallSetup.dailyTracker?.sellingDays ?? 2,
        ...stallSetup.dailyTracker,
        ...patch,
      },
    });
  };

  const getZoneLabelText = (zoneId: ZoneId) => {
    const pinned = zoneOverrides[zoneId];
    if (pinned && pinned.length > 0) return pinned.join(' · ');
    return zones[zoneId].items;
  };

  const handleGenerateConceptVisual = async () => {
    setVisualLoading(true);
    setVisualError(null);
    try {
      const catNames = resolvedGroups.map((rg) => rg.group.name).join(', ');
      const prompt = `Clean top-front realistic exhibition stall display mockup for a ${stallSetup.widthFt}ft by ${stallSetup.depthFt}ft ${stallSetup.stallType.replace('_', ' ')} booth selling ${catNames} at ${venueDisplay}. Warm neutral linen table, tiered risers at back, neat front impulse tray, warm overhead spotlighting, no text watermarks.`;
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Unable to generate visual.');
      }
      setVisualUrl(data.imageUrl);
    } catch (err) {
      setVisualError(
        err instanceof Error ? err.message : 'Unable to generate visual.'
      );
    } finally {
      setVisualLoading(false);
    }
  };

  const activeZoneInfo = zones[selectedZone];
  const areaSqFt = Math.round(stallSetup.widthFt * stallSetup.depthFt);

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-[#13111C] border border-[#252136]">
          <button
            type="button"
            onClick={() => setSubTab('layout')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'layout'
                ? 'bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.5)]'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Visual Layout</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('selling')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'selling'
                ? 'bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.5)]'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Selling Strategy</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#A29BB8]">
          <span className="font-mono tabular-nums px-2.5 py-1 rounded-xl bg-[#13111C] border border-[#252136] text-[#C4B5FD]">
            {stallSetup.widthFt}×{stallSetup.depthFt} ft · {totalPieces} pcs planned
          </span>
        </div>
      </div>

      {subTab === 'layout' ? (
        <>
          {/* 1. Compact Studio Controls */}
          <section
            data-ai-section="playbook_layout"
            className="surface-card rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-lg font-bold text-[#F5F3FA]">
                  Stall Layout Studio
                </h1>
                <span className="font-mono tabular-nums text-xs px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 text-[#C4B5FD]">
                  {stallSetup.widthFt} × {stallSetup.depthFt} ft · {areaSqFt} sq ft
                </span>
                {isDefaultDimensions && (
                  <span className="text-[11px] text-[#FBBF24]">
                    Approximate layout
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {SIZE_PRESETS.map((p) => {
                  const active =
                    stallSetup.widthFt === p.widthFt && stallSetup.depthFt === p.depthFt;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        onUpdateStallSetup({ widthFt: p.widthFt, depthFt: p.depthFt })
                      }
                      className={`px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums font-semibold transition-colors ${
                        active
                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                          : 'bg-[#1A1726] text-[#A29BB8] border-[#2E2942] hover:text-[#F5F3FA]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 Alternative Layout Presets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {LAYOUT_PRESETS.map((preset) => {
                const active = activeLayoutStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyLayoutPreset(preset.id)}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      active
                        ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/60 shadow-[0_0_20px_-8px_rgba(139,92,246,0.5)]'
                        : 'bg-[#0E0C15] border-[#252136] hover:border-[#3A3352]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F5F3FA]">
                        {preset.name}
                      </span>
                      {active && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8B5CF6] text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#A29BB8] mt-1 leading-snug">
                      {preset.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Stall Format + Dimensions Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6 flex flex-wrap gap-1.5">
                {STALL_TYPES.map((st) => {
                  const selected = stallSetup.stallType === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onUpdateStallSetup({ stallType: st.id })}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/60 text-[#C4B5FD]'
                          : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8] hover:text-[#F5F3FA]'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] text-[#A29BB8] mb-1">Width (ft)</label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={stallSetup.widthFt}
                  onChange={(e) =>
                    onUpdateStallSetup({
                      widthFt: Math.min(30, Math.max(3, Number(e.target.value) || 6)),
                    })
                  }
                  className="w-full surface-inset rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#F5F3FA]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] text-[#A29BB8] mb-1">Depth (ft)</label>
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={stallSetup.depthFt}
                  onChange={(e) =>
                    onUpdateStallSetup({
                      depthFt: Math.min(30, Math.max(2, Number(e.target.value) || 4)),
                    })
                  }
                  className="w-full surface-inset rounded-xl px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#F5F3FA]"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  disabled={visualLoading}
                  onClick={handleGenerateConceptVisual}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/50 text-xs font-semibold text-[#C4B5FD] disabled:opacity-50"
                >
                  {visualLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Mockup</span>
                </button>
              </div>
            </div>

            {/* Draggable Category Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-[#A29BB8]">Drag to a zone:</span>
              {resolvedGroups.map(({ group }) => (
                <div
                  key={group.id}
                  draggable
                  onDragStart={() => setDragCategory(group.name)}
                  onDragEnd={() => {
                    setDragCategory(null);
                    setDropHoverZone(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1726] border border-[#2E2942] text-xs font-medium text-[#F5F3FA] cursor-grab active:cursor-grabbing hover:border-[#8B5CF6]/60"
                >
                  <GripVertical className="w-3 h-3 text-[#78718E]" />
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.accentColor }}
                  />
                  <span>{group.name}</span>
                </div>
              ))}
            </div>

            {/* 2. Interactive Top-Down Blueprint + Side Placement Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
              {/* Interactive Top-Down Stall Blueprint */}
              <div className="lg:col-span-7 surface-inset rounded-2xl p-4 space-y-3">
                <svg
                  viewBox="0 0 600 360"
                  className="w-full h-auto rounded-xl bg-[#0B0A10] border border-[#252136]"
                  role="img"
                  aria-label={`Interactive top-down stall layout for ${stallSetup.widthFt} by ${stallSetup.depthFt} ft`}
                >
                  <defs>
                    <pattern
                      id="stallGrid"
                      width="24"
                      height="24"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 24 0 L 0 0 0 24"
                        fill="none"
                        stroke="#1D192B"
                        strokeWidth="0.8"
                      />
                    </pattern>
                  </defs>

                  <rect width="600" height="360" fill="url(#stallGrid)" />

                  {/* Rear Storage Strip */}
                  <rect
                    x="28"
                    y="18"
                    width="544"
                    height="34"
                    rx="8"
                    fill="#161322"
                    stroke="#2B2640"
                  />
                  <text
                    x="300"
                    y="39"
                    textAnchor="middle"
                    fill="#78718E"
                    fontSize="10.5"
                    fontWeight="600"
                  >
                    STORAGE &amp; BACKUP STOCK AREA ({stallSetup.widthFt}×{stallSetup.depthFt} FT)
                  </text>

                  {/* Rear Elevated Risers (Premium Display) */}
                  <g
                    onClick={() => setSelectedZone('back_riser')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropHoverZone('back_riser');
                    }}
                    onDragLeave={() => setDropHoverZone(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCategory) assignDraggedCategory('back_riser', dragCategory);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x="28"
                      y="64"
                      width="544"
                      height="74"
                      rx="12"
                      fill={
                        dropHoverZone === 'back_riser'
                          ? '#34D39930'
                          : selectedZone === 'back_riser'
                          ? '#192927'
                          : '#13111C'
                      }
                      stroke={
                        selectedZone === 'back_riser' || dropHoverZone === 'back_riser'
                          ? '#34D399'
                          : '#2E2942'
                      }
                      strokeWidth={selectedZone === 'back_riser' ? 2.2 : 1.2}
                    />
                    <text x="44" y="88" fill="#34D399" fontSize="10.5" fontWeight="700">
                      REAR RISERS · EYE-LEVEL PREMIUM DISPLAY
                    </text>
                    <text x="44" y="112" fill="#F5F3FA" fontSize="12" fontWeight="600">
                      {getZoneLabelText('back_riser').slice(0, 62)}
                    </text>
                  </g>

                  {/* Front-Left Showcase (Attention Grabber) */}
                  <g
                    onClick={() => setSelectedZone('front_left')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropHoverZone('front_left');
                    }}
                    onDragLeave={() => setDropHoverZone(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCategory) assignDraggedCategory('front_left', dragCategory);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x="28"
                      y="152"
                      width="172"
                      height="112"
                      rx="12"
                      fill={
                        dropHoverZone === 'front_left'
                          ? '#8B5CF635'
                          : selectedZone === 'front_left'
                          ? '#21183A'
                          : '#13111C'
                      }
                      stroke={
                        selectedZone === 'front_left' || dropHoverZone === 'front_left'
                          ? '#8B5CF6'
                          : '#2E2942'
                      }
                      strokeWidth={selectedZone === 'front_left' ? 2.2 : 1.2}
                    />
                    <text x="42" y="176" fill="#C4B5FD" fontSize="10" fontWeight="700">
                      MAIN SHOWCASE
                    </text>
                    <text x="42" y="196" fill="#F5F3FA" fontSize="12" fontWeight="700">
                      Front-Left Hook
                    </text>
                    <text x="42" y="220" fill="#A29BB8" fontSize="10.5">
                      {getZoneLabelText('front_left').slice(0, 22)}
                    </text>
                  </g>

                  {/* Front-Center Impulse Counter */}
                  <g
                    onClick={() => setSelectedZone('center_tray')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropHoverZone('center_tray');
                    }}
                    onDragLeave={() => setDropHoverZone(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCategory) assignDraggedCategory('center_tray', dragCategory);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x="214"
                      y="152"
                      width="172"
                      height="112"
                      rx="12"
                      fill={
                        dropHoverZone === 'center_tray'
                          ? '#F59E0B30'
                          : selectedZone === 'center_tray'
                          ? '#292014'
                          : '#13111C'
                      }
                      stroke={
                        selectedZone === 'center_tray' || dropHoverZone === 'center_tray'
                          ? '#F59E0B'
                          : '#2E2942'
                      }
                      strokeWidth={selectedZone === 'center_tray' ? 2.2 : 1.2}
                    />
                    <text x="228" y="176" fill="#FBBF24" fontSize="10" fontWeight="700">
                      FRONT COUNTER
                    </text>
                    <text x="228" y="196" fill="#F5F3FA" fontSize="12" fontWeight="700">
                      Impulse &amp; Bundles
                    </text>
                    <text x="228" y="220" fill="#A29BB8" fontSize="10.5">
                      {getZoneLabelText('center_tray').slice(0, 22)}
                    </text>
                  </g>

                  {/* Side Try / Billing Counter */}
                  <g
                    onClick={() => setSelectedZone('right_mirror')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropHoverZone('right_mirror');
                    }}
                    onDragLeave={() => setDropHoverZone(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCategory) assignDraggedCategory('right_mirror', dragCategory);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x="400"
                      y="152"
                      width="172"
                      height="112"
                      rx="12"
                      fill={
                        dropHoverZone === 'right_mirror'
                          ? '#38BDF830'
                          : selectedZone === 'right_mirror'
                          ? '#132433'
                          : '#13111C'
                      }
                      stroke={
                        selectedZone === 'right_mirror' || dropHoverZone === 'right_mirror'
                          ? '#38BDF8'
                          : '#2E2942'
                      }
                      strokeWidth={selectedZone === 'right_mirror' ? 2.2 : 1.2}
                    />
                    <text x="414" y="176" fill="#38BDF8" fontSize="10" fontWeight="700">
                      PAYMENT COUNTER · UPI
                    </text>
                    <text x="414" y="196" fill="#F5F3FA" fontSize="12" fontWeight="700">
                      Try &amp; Checkout
                    </text>
                    <text x="414" y="220" fill="#A29BB8" fontSize="10.5">
                      {getZoneLabelText('right_mirror').slice(0, 22)}
                    </text>
                  </g>

                  {/* Customer Movement Path */}
                  <path
                    d="M 48 318 C 145 278, 250 282, 300 296 C 365 312, 460 282, 548 312"
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                  />
                  <polygon points="552,313 540,305 542,318" fill="#A78BFA" />

                  {/* Entrance & Front Edge Label */}
                  <text
                    x="48"
                    y="344"
                    fill="#C4B5FD"
                    fontSize="10.5"
                    fontWeight="700"
                  >
                    ENTRANCE →
                  </text>
                  <text
                    x="300"
                    y="344"
                    textAnchor="middle"
                    fill="#A29BB8"
                    fontSize="10.5"
                    fontWeight="600"
                  >
                    CUSTOMER FLOW ({expectedFootfall.toLocaleString('en-IN')} visitors)
                  </text>
                </svg>

                {/* Zone Switcher Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(Object.keys(ZONE_META) as ZoneId[]).map((zId) => (
                    <button
                      key={zId}
                      type="button"
                      onClick={() => setSelectedZone(zId)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        selectedZone === zId
                          ? 'bg-[#8B5CF6]/20 text-[#F5F3FA] border-[#8B5CF6]/60'
                          : 'bg-[#13111C] text-[#A29BB8] border-[#252136] hover:text-[#F5F3FA]'
                      }`}
                    >
                      {ZONE_META[zId].short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Panel: Selected Zone Inspector + Save Layout */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3.5">
                <div className="surface-inset rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: ZONE_META[selectedZone].accent }}
                    >
                      {ZONE_META[selectedZone].badge}
                    </span>
                    <span className="text-[11px] text-[#78718E]">
                      {ZONE_META[selectedZone].short}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-[#F5F3FA]">
                    {getZoneLabelText(selectedZone)}
                  </div>

                  <p className="text-xs text-[#A29BB8] leading-relaxed">
                    {activeZoneInfo.why}
                  </p>

                  {/* Click-to-Assign Categories */}
                  <div className="pt-2 border-t border-[#252136] space-y-1.5">
                    <div className="text-[11px] text-[#A29BB8]">Assign to zone</div>
                    <div className="flex flex-wrap gap-1.5">
                      {resolvedGroups.map(({ group }) => {
                        const isPinned = (zoneOverrides[selectedZone] || []).includes(
                          group.name
                        );
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() =>
                              toggleCategoryInZone(selectedZone, group.name)
                            }
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                              isPinned
                                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                : 'bg-[#13111C] text-[#A29BB8] border-[#252136] hover:text-[#F5F3FA]'
                            }`}
                          >
                            {isPinned ? `✓ ${group.name}` : group.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Save & Reopen Layout */}
                <div className="surface-inset rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F5F3FA] inline-flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#A78BFA]" />
                      Save layout option
                    </span>
                    {layoutSavedToast && (
                      <span className="text-[11px] text-[#34D399] font-medium">
                        {layoutSavedToast}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={layoutNameInput}
                      onChange={(e) => setLayoutNameInput(e.target.value)}
                      placeholder="e.g. Corner 10×10 Festive"
                      className="flex-1 min-w-0 bg-[#0B0A10] border border-[#252136] rounded-xl px-2.5 py-1.5 text-xs text-[#F5F3FA] placeholder-[#78718E]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCurrentLayout}
                      className="px-3 py-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold shrink-0"
                    >
                      Save
                    </button>
                  </div>

                  {savedLayouts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {savedLayouts.map((saved) => (
                        <div
                          key={saved.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161322] border border-[#2E2942] text-[11px]"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadSavedLayout(saved)}
                            className="text-[#C4B5FD] hover:text-white font-medium"
                          >
                            {saved.name} ({saved.widthFt}×{saved.depthFt})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedLayout(saved.id)}
                            aria-label={`Delete layout ${saved.name}`}
                            className="text-[#78718E] hover:text-[#FB7185]"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {visualError && (
                  <p className="text-xs text-[#FB7185]">{visualError}</p>
                )}
                {visualUrl && (
                  <img
                    src={visualUrl}
                    alt={`Stall concept for ${venueDisplay}`}
                    className="w-full h-36 object-cover rounded-xl border border-[#2E2942]"
                  />
                )}
              </div>
            </div>
          </section>

          {/* 2. Inventory-Driven Placement Intelligence (8 Practical Cards) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                Product Placement Recommendations
              </h2>
              <span className="text-[11px] text-[#A29BB8]">
                Calculated from your live stock &amp; {stallSetup.widthFt}×{stallSetup.depthFt} ft space
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {placementRecommendations.map((item) => (
                <div
                  key={item.id}
                  className="surface-card rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">
                      {item.tag}
                    </span>
                    <span className="text-[11px] font-semibold text-[#F5F3FA]">
                      {item.question}
                    </span>
                  </div>
                  <p className="text-xs text-[#C7C1D8] leading-relaxed">
                    {item.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* SELLING STRATEGY SUB-TAB */}

          {/* 1. Product Bundle Builder with Unprofitable Discount Guard */}
          <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-[#A78BFA]" />
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Suggested Product Bundles
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="text-[#A29BB8]">Test bundle discount:</span>
                <button
                  type="button"
                  onClick={() => setCustomDiscountPct(undefined)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                    customDiscountPct === undefined
                      ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                      : 'bg-[#13111C] text-[#A29BB8] border-[#252136]'
                  }`}
                >
                  Auto safe
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={65}
                    step={5}
                    aria-label="Test bundle discount percentage"
                    value={customDiscountPct ?? 10}
                    onChange={(e) => setCustomDiscountPct(Number(e.target.value))}
                    className="w-24 accent-[#8B5CF6]"
                  />
                  <span className="font-mono tabular-nums text-[#F5F3FA] w-10 text-right">
                    {customDiscountPct === undefined ? 'Safe' : `${customDiscountPct}%`}
                  </span>
                </div>
              </div>
            </div>

            {productBundles.length === 0 ? (
              <p className="text-xs text-[#A29BB8]">
                Add at least 2 products with purchase cost and selling price in Stock Planner to generate profitable bundles.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {productBundles.map((bundle) => (
                  <div
                    key={bundle.id}
                    className={`rounded-2xl p-4 border space-y-3 ${
                      !bundle.isProfitable
                        ? 'bg-[#FB7185]/8 border-[#FB7185]/45'
                        : 'bg-[#0E0C15] border-[#252136]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                          {bundle.title}
                        </h3>
                        <div className="text-[11px] text-[#A29BB8] mt-0.5">
                          {bundle.items.map((it) => `${it.name} (${fmt(it.price)})`).join(' + ')}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-base font-bold text-[#C4B5FD]">
                          {fmt(bundle.bundlePrice)}
                        </div>
                        {bundle.discountAmount > 0 && (
                          <div className="text-[10px] font-mono text-[#A29BB8]">
                            Save {fmt(bundle.discountAmount)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] surface-inset rounded-xl p-2.5 font-mono tabular-nums">
                      <div>
                        <div className="text-[#78718E] font-sans text-[10px]">Cost</div>
                        <div className="text-[#F5F3FA] font-semibold">
                          {fmt(bundle.combinedCost)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78718E] font-sans text-[10px]">Est. Profit</div>
                        <div
                          className={`font-semibold ${
                            bundle.estimatedProfit > 0
                              ? 'text-[#34D399]'
                              : 'text-[#FB7185]'
                          }`}
                        >
                          {bundle.estimatedProfit >= 0
                            ? `+${fmt(bundle.estimatedProfit)}`
                            : `-${fmt(Math.abs(bundle.estimatedProfit))}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78718E] font-sans text-[10px]">Margin</div>
                        <div
                          className={`font-semibold ${
                            bundle.marginPct >= 25
                              ? 'text-[#34D399]'
                              : bundle.marginPct > 0
                              ? 'text-[#FBBF24]'
                              : 'text-[#FB7185]'
                          }`}
                        >
                          {bundle.marginPct}%
                        </div>
                      </div>
                    </div>

                    {bundle.warning ? (
                      <div className="flex items-start gap-2 rounded-xl bg-[#FB7185]/12 border border-[#FB7185]/35 px-3 py-2 text-[11px] text-[#FDA4AF]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#FB7185]" />
                        <span>{bundle.warning}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#A29BB8]">{bundle.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Daily Sales Targets & Optional Actuals Tracker */}
          <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#34D399]" />
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Daily Sales Targets
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="selling-days-input" className="text-[#A29BB8]">
                  Event days
                </label>
                <input
                  id="selling-days-input"
                  type="number"
                  min={1}
                  max={30}
                  value={dailyTargets.sellingDays}
                  onChange={(e) =>
                    updateDailyTracker({
                      sellingDays: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-16 surface-inset rounded-xl px-2.5 py-1 text-xs font-mono tabular-nums text-[#F5F3FA]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="surface-inset rounded-xl p-3">
                <div className="text-[11px] text-[#A29BB8]">Daily sales target</div>
                <div className="font-mono tabular-nums text-lg font-bold text-[#F5F3FA] mt-1">
                  {fmt(dailyTargets.dailyRevenueTarget)}
                </div>
                <div className="text-[10px] text-[#78718E] mt-0.5">
                  Across {dailyTargets.sellingDays} day{dailyTargets.sellingDays > 1 ? 's' : ''}
                </div>
              </div>
              <div className="surface-inset rounded-xl p-3">
                <div className="text-[11px] text-[#A29BB8]">Daily break-even sales</div>
                <div className="font-mono tabular-nums text-lg font-bold text-[#FBBF24] mt-1">
                  {fmt(dailyTargets.dailyBreakEvenRevenue)}
                </div>
                <div className="text-[10px] text-[#78718E] mt-0.5">
                  Covers stock + event costs
                </div>
              </div>
              <div className="surface-inset rounded-xl p-3">
                <div className="text-[11px] text-[#A29BB8]">Daily pieces goal</div>
                <div className="font-mono tabular-nums text-lg font-bold text-[#C4B5FD] mt-1">
                  {dailyTargets.dailyPiecesTarget} pcs/day
                </div>
                <div className="text-[10px] text-[#78718E] mt-0.5">
                  Break-even: {dailyTargets.dailyBreakEvenPieces} pcs/day
                </div>
              </div>
              <div className="surface-inset rounded-xl p-3">
                <div className="text-[11px] text-[#A29BB8]">Total event goal</div>
                <div className="font-mono tabular-nums text-lg font-bold text-[#34D399] mt-1">
                  {fmt(dailyTargets.totalRevenueTarget)}
                </div>
                <div className="text-[10px] text-[#78718E] mt-0.5">
                  Based on current stock plan
                </div>
              </div>
            </div>

            {/* Optional User-Entered Actuals (Never Fabricated) */}
            <div className="surface-inset rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#F5F3FA]">
                  Optional: Enter actual sales so far
                </span>
                <span className="text-[11px] text-[#78718E]">
                  Leave blank until the event begins — StallIQ never estimates actuals.
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Actual sales received (₹)
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Not entered yet"
                    value={stallSetup.dailyTracker?.actualRevenueEntered ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateDailyTracker({
                        actualRevenueEntered: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
                      });
                    }}
                    className="w-full bg-[#0B0A10] border border-[#252136] rounded-xl px-3 py-1.5 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E]"
                  />
                </label>
                <label className="block text-xs">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Actual pieces sold
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Not entered yet"
                    value={stallSetup.dailyTracker?.actualPiecesEntered ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateDailyTracker({
                        actualPiecesEntered: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
                      });
                    }}
                    className="w-full bg-[#0B0A10] border border-[#252136] rounded-xl px-3 py-1.5 text-xs font-mono tabular-nums text-[#F5F3FA] placeholder-[#78718E]"
                  />
                </label>
              </div>

              {dailyTargets.revenueProgressPct !== null && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#34D399] font-semibold">
                      {dailyTargets.revenueProgressPct}% of target reached
                    </span>
                    <span className="text-[#A29BB8]">
                      {dailyTargets.remainingRevenueToTarget === 0
                        ? 'Target hit!'
                        : `${fmt(dailyTargets.remainingRevenueToTarget || 0)} left to target`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0B0A10] overflow-hidden border border-[#252136]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#34D399]"
                      style={{ width: `${dailyTargets.revenueProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Pricing Ideas + Customer Interaction Scripts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <section className="lg:col-span-6 surface-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#FBBF24]" />
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Pricing Ideas
                </h2>
              </div>
              <div className="space-y-2.5">
                {pricingIdeas.map((idea) => (
                  <div key={idea.id} className="surface-inset rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#FBBF24]">
                        {idea.tier}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#F5F3FA]">
                        {idea.priceTag}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#F5F3FA]">
                      {idea.headline}
                    </div>
                    <p className="text-[11px] text-[#A29BB8] leading-snug">
                      {idea.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-6 surface-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Customer Interaction Guide
                </h2>
              </div>
              <div className="space-y-2">
                {interactionScripts.map((step, idx) => (
                  <div key={step.stage} className="surface-inset rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">
                      {idx + 1}. {step.stage}
                    </div>
                    <p className="text-xs text-[#F5F3FA] mt-1 leading-relaxed">
                      {step.line}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 4. Actionable Category Sales Approaches */}
          <section
            data-ai-section="playbook_approaches"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                One-Click Plan Actions
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {resolvedGroups.map(({ group }) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-colors ${
                      activeCategoryResolved?.group.id === group.id
                        ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                        : 'bg-[#13111C] text-[#A29BB8] border-[#252136] hover:text-[#F5F3FA]'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {salesApproaches.map((idea) => {
                const appliedMsg = appliedIdeaNotes[idea.id];
                return (
                  <div
                    key={idea.id}
                    className="surface-card rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#A78BFA]">
                          {idea.tag}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#34D399]">
                          {idea.metric}
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-[#F5F3FA]">
                        {idea.title}
                      </h3>
                      <p className="text-xs text-[#A29BB8] leading-relaxed">
                        {idea.summary}
                      </p>
                    </div>

                    {idea.action && (
                      <button
                        type="button"
                        onClick={() => {
                          const feedback = onApplyPlaybookIdea(idea.action!);
                          setAppliedIdeaNotes((prev) => ({
                            ...prev,
                            [idea.id]: feedback,
                          }));
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          appliedMsg
                            ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/35'
                            : 'bg-[#1A1726] hover:bg-[#8B5CF6] text-[#F5F3FA] border border-[#2E2942] hover:border-[#8B5CF6]'
                        }`}
                      >
                        {appliedMsg ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{appliedMsg}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{idea.actionLabel || 'Use this idea'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. Compact Reference Links */}
          <section
            data-ai-section="playbook_resources"
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            {learningResources.map((res) => (
              <a
                key={res.id}
                href={res.queryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-card hover:border-[#8B5CF6]/50 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#A78BFA]">
                    {res.tag}
                  </div>
                  <div className="text-xs font-bold text-[#F5F3FA] mt-0.5 truncate">
                    {res.title}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#A78BFA] shrink-0" />
              </a>
            ))}
          </section>
        </>
      )}

      {activeCategoryResolved && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenOptimizerGroup(activeCategoryResolved.group.id)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Edit {activeCategoryResolved.group.name} stock →</span>
          </button>
        </div>
      )}
    </div>
  );
}
