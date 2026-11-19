import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type { SavedStallLayout, StallType, ZoneId } from '../../types/stall';
import { triggerHaptic } from '../../utils/experienceMode';
import { buildDynamicStallZones } from '../../utils/playbookEngine';
import {
  buildCustomerInteractionScripts,
  buildProductBundles,
  LAYOUT_PRESETS,
} from '../../utils/strategyBuilder';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileStallScreenProps {
  workspace: StallWorkspaceController;
}

const ZONE_META: Array<{ id: ZoneId; title: string; role: string }> = [
  { id: 'back_riser', title: 'Rear Risers', role: 'Hero backdrop & signage' },
  { id: 'front_left', title: 'Front Showcase', role: 'Eye-level crowd stopper' },
  { id: 'center_tray', title: 'Center Impulse', role: 'Fast-moving grab items' },
  { id: 'right_mirror', title: 'Counter & Mirror', role: 'Try-on, bundles & UPI' },
];

const STALL_TYPES: Array<{ id: StallType; label: string }> = [
  { id: 'tabletop', label: 'Tabletop' },
  { id: 'corner_booth', label: 'Corner' },
  { id: 'indoor_kiosk', label: 'Kiosk' },
  { id: 'open_canopy', label: 'Canopy' },
];

const QUICK_SIZES: Array<{ label: string; w: number; d: number }> = [
  { label: '6×4 ft', w: 6, d: 4 },
  { label: '8×6 ft', w: 8, d: 6 },
  { label: '10×10 ft', w: 10, d: 10 },
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function MobileStallScreen({ workspace }: MobileStallScreenProps) {
  const {
    stallSetup,
    setStallSetup,
    resolvedGroups,
    eventName,
    currentProjectName,
    expectedFootfall,
    stallFee,
    showToast,
  } = workspace;

  const [subView, setSubView] = useState<'layout' | 'selling'>('layout');
  const [zoom, setZoom] = useState<number>(1);
  const [editingZone, setEditingZone] = useState<ZoneId | null>(null);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualUrl, setVisualUrl] = useState<string | null>(null);
  const [visualError, setVisualError] = useState<string | null>(null);

  const categoryNames = useMemo(
    () => resolvedGroups.map((rg) => rg.group.name),
    [resolvedGroups]
  );

  const dynamicZones = useMemo(
    () =>
      buildDynamicStallZones(
        eventName || currentProjectName,
        expectedFootfall,
        stallFee,
        resolvedGroups
      ),
    [eventName, currentProjectName, expectedFootfall, stallFee, resolvedGroups]
  );

  const bundles = useMemo(
    () => buildProductBundles(resolvedGroups),
    [resolvedGroups]
  );

  const scripts = useMemo(
    () =>
      buildCustomerInteractionScripts(
        resolvedGroups,
        eventName || currentProjectName
      ),
    [resolvedGroups, eventName, currentProjectName]
  );

  const updateSetup = (patch: Partial<typeof stallSetup>) => {
    setStallSetup((prev) => ({ ...prev, ...patch }));
  };

  const toggleCategoryInZone = (zoneId: ZoneId, catName: string) => {
    triggerHaptic(8);
    const current = stallSetup.zoneCategoryOverrides?.[zoneId] || [];
    const exists = current.includes(catName);
    const nextZoneList = exists
      ? current.filter((c) => c !== catName)
      : [...current, catName];

    updateSetup({
      zoneCategoryOverrides: {
        ...(stallSetup.zoneCategoryOverrides || {}),
        [zoneId]: nextZoneList,
      },
    });
  };

  const applyPreset = (presetId: (typeof LAYOUT_PRESETS)[number]['id']) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    triggerHaptic(10);
    updateSetup({
      layoutStyle: preset.id,
      stallType: preset.recommendedType,
      zoneCategoryOverrides: preset.zoneMap(categoryNames),
    });
    showToast(`Applied ${preset.name}`);
  };

  const handleSaveNamedLayout = () => {
    const clean =
      layoutName.trim() ||
      `Layout ${(stallSetup.savedLayouts?.length || 0) + 1}`;
    const entry: SavedStallLayout = {
      id: `lay_${Date.now()}`,
      name: clean,
      widthFt: stallSetup.widthFt,
      depthFt: stallSetup.depthFt,
      stallType: stallSetup.stallType,
      layoutStyle: stallSetup.layoutStyle || 'classic_u',
      zoneCategoryOverrides: { ...(stallSetup.zoneCategoryOverrides || {}) },
      savedAtMs: Date.now(),
    };
    updateSetup({
      savedLayouts: [entry, ...(stallSetup.savedLayouts || [])].slice(0, 8),
    });
    setLayoutName('');
    setSaveSheetOpen(false);
    showToast(`Saved "${clean}"`);
  };

  const handleLoadLayout = (saved: SavedStallLayout) => {
    triggerHaptic(8);
    updateSetup({
      widthFt: saved.widthFt,
      depthFt: saved.depthFt,
      stallType: saved.stallType,
      layoutStyle: saved.layoutStyle,
      zoneCategoryOverrides: { ...(saved.zoneCategoryOverrides || {}) },
    });
    setSaveSheetOpen(false);
    showToast(`Loaded "${saved.name}"`);
  };

  const handleDeleteLayout = (id: string) => {
    updateSetup({
      savedLayouts: (stallSetup.savedLayouts || []).filter((l) => l.id !== id),
    });
  };

  const handleGenerateVisual = async () => {
    setVisualLoading(true);
    setVisualError(null);
    try {
      const cats = categoryNames.length > 0 ? categoryNames.join(', ') : 'retail products';
      const prompt = `Photorealistic modern exhibition pop-up stall (${stallSetup.widthFt}ft by ${stallSetup.depthFt}ft, ${stallSetup.stallType.replace('_', ' ')}) showcasing ${cats} for ${eventName || currentProjectName}. Warm directional display spotlights, wooden tiered risers, clean modern signage, inviting customer walkway, premium boutique visual merchandising.`;
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Unable to generate stall visual.');
      }
      setVisualUrl(data.imageUrl);
    } catch (err) {
      setVisualError(
        err instanceof Error ? err.message : 'Unable to generate stall visual.'
      );
    } finally {
      setVisualLoading(false);
    }
  };

  const areaSqFt = Math.round(stallSetup.widthFt * stallSetup.depthFt);

  return (
    <div className="space-y-4 step-fade-in">
      {/* Sub-view Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#13111C] border border-[#252136]">
        <button
          type="button"
          onClick={() => setSubView('layout')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold ${
            subView === 'layout' ? 'bg-[#8B5CF6] text-white' : 'text-[#9D95B8]'
          }`}
        >
          Stall Layout
        </button>
        <button
          type="button"
          onClick={() => setSubView('selling')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold ${
            subView === 'selling' ? 'bg-[#8B5CF6] text-white' : 'text-[#9D95B8]'
          }`}
        >
          Bundles & Scripts
        </button>
      </div>

      {subView === 'layout' ? (
        <>
          {/* Stall Dimensions & Type Card */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="font-display text-sm font-bold text-[#F5F3FA]">
                  Stall Footprint
                </h1>
                <p className="text-xs text-[#9D95B8] font-mono tabular-nums mt-0.5">
                  {stallSetup.widthFt}ft × {stallSetup.depthFt}ft · {areaSqFt} sq ft
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaveSheetOpen(true)}
                className="min-h-[38px] px-3 rounded-xl bg-[#1A1726] border border-[#2D2744] text-xs font-semibold text-[#C4B5FD] inline-flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>
                  Saved ({stallSetup.savedLayouts?.length || 0})
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {QUICK_SIZES.map((sz) => {
                const active =
                  stallSetup.widthFt === sz.w && stallSetup.depthFt === sz.d;
                return (
                  <button
                    key={sz.label}
                    type="button"
                    onClick={() => updateSetup({ widthFt: sz.w, depthFt: sz.d })}
                    className={`flex-1 min-h-[38px] rounded-xl border text-xs font-mono font-semibold ${
                      active
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]'
                        : 'bg-[#0E0C15] border-[#252136] text-[#9D95B8]'
                    }`}
                  >
                    {sz.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 block">
                <span className="text-[10px] uppercase tracking-wider text-[#9D95B8]">
                  Width (ft)
                </span>
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={stallSetup.widthFt}
                  onChange={(e) =>
                    updateSetup({
                      widthFt: Math.max(2, Math.min(40, Number(e.target.value) || 6)),
                    })
                  }
                  className="w-full bg-transparent font-mono tabular-nums text-base font-bold text-[#F5F3FA] mt-0.5 focus:outline-none"
                />
              </label>

              <label className="rounded-2xl bg-[#0E0C15] border border-[#221E33] px-3 py-2 block">
                <span className="text-[10px] uppercase tracking-wider text-[#9D95B8]">
                  Depth (ft)
                </span>
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={stallSetup.depthFt}
                  onChange={(e) =>
                    updateSetup({
                      depthFt: Math.max(2, Math.min(40, Number(e.target.value) || 4)),
                    })
                  }
                  className="w-full bg-transparent font-mono tabular-nums text-base font-bold text-[#F5F3FA] mt-0.5 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {STALL_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateSetup({ stallType: t.id })}
                  className={`min-h-[36px] rounded-xl border text-[11px] font-semibold ${
                    stallSetup.stallType === t.id
                      ? 'bg-[#8B5CF6] border-[#A78BFA] text-white'
                      : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* Layout Presets */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {LAYOUT_PRESETS.map((preset) => {
              const active = stallSetup.layoutStyle === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`shrink-0 min-h-[42px] px-3.5 rounded-2xl border text-xs font-semibold whitespace-nowrap ${
                    active
                      ? 'bg-[#1D1833] border-[#8B5CF6] text-[#C4B5FD]'
                      : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {/* Interactive Touch Stall Blueprint Canvas */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                  Tap a Zone to Place Stock
                </h2>
                <p className="text-[11px] text-[#9D95B8]">
                  Tap any area to assign or move categories
                </p>
              </div>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Zoom out stall layout"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
                  className="w-9 h-9 rounded-xl bg-[#1A1726] border border-[#252136] text-[#A29BB8] flex items-center justify-center"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in stall layout"
                  onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.15).toFixed(2))))}
                  className="w-9 h-9 rounded-xl bg-[#1A1726] border border-[#252136] text-[#C4B5FD] flex items-center justify-center"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl bg-[#0B0A10] border border-[#221E33] p-3">
              <div
                style={{
                  width: `${Math.round(zoom * 100)}%`,
                  transition: 'width 180ms ease',
                }}
                className="space-y-2.5 min-w-full"
              >
                {/* Back Riser (full width top) */}
                {(['back_riser'] as ZoneId[]).map((zid) => {
                  const meta = ZONE_META.find((m) => m.id === zid)!;
                  const assigned = stallSetup.zoneCategoryOverrides?.[zid] || [];
                  return (
                    <button
                      key={zid}
                      type="button"
                      onClick={() => setEditingZone(zid)}
                      className="w-full min-h-[76px] rounded-2xl bg-[#171326] border border-[#322C47] hover:border-[#8B5CF6] p-3 text-left transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#C4B5FD]">
                          {meta.title}
                        </span>
                        <span className="text-[10px] text-[#9D95B8]">
                          {assigned.length > 0 ? `${assigned.length} assigned` : 'Tap to assign'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#DDD7EE] mt-1 truncate">
                        {assigned.length > 0
                          ? assigned.join(' · ')
                          : dynamicZones[zid]?.items || meta.role}
                      </p>
                    </button>
                  );
                })}

                {/* Middle Row: Front Left / Center Impulse / Right Counter */}
                <div className="grid grid-cols-3 gap-2">
                  {(['front_left', 'center_tray', 'right_mirror'] as ZoneId[]).map(
                    (zid) => {
                      const meta = ZONE_META.find((m) => m.id === zid)!;
                      const assigned = stallSetup.zoneCategoryOverrides?.[zid] || [];
                      return (
                        <button
                          key={zid}
                          type="button"
                          onClick={() => setEditingZone(zid)}
                          className="min-h-[112px] rounded-2xl bg-[#141120] border border-[#2B2540] hover:border-[#8B5CF6] p-2.5 text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
                        >
                          <div>
                            <div className="text-[11px] font-bold text-[#F5F3FA] leading-tight">
                              {meta.title}
                            </div>
                            <div className="text-[10px] text-[#9D95B8] mt-1 line-clamp-3">
                              {assigned.length > 0
                                ? assigned.join(', ')
                                : meta.role}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-[#A78BFA] mt-2">
                            {assigned.length > 0 ? 'Edit' : '+ Place'}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Visitor Walkway Indicator */}
                <div className="rounded-xl border border-dashed border-[#2D2744] py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-[#8C84A6]">
                  Customer Walkway · {stallSetup.widthFt} ft Frontage
                </div>
              </div>
            </div>
          </section>

          {/* AI Concept Display Visual */}
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#C4B5FD]" />
                <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                  Concept Display Visual
                </h2>
              </div>
              <button
                type="button"
                disabled={visualLoading}
                onClick={() => void handleGenerateVisual()}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {visualLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{visualUrl ? 'Regenerate' : 'Generate'}</span>
              </button>
            </div>

            {visualError && (
              <p className="text-xs text-[#FB7185]">{visualError}</p>
            )}

            {visualUrl && (
              <img
                src={visualUrl}
                alt="AI generated stall display concept"
                className="w-full rounded-2xl border border-[#2D2744] object-cover max-h-64"
              />
            )}
          </section>
        </>
      ) : (
        /* Bundles & Selling Scripts Sub-View */
        <div className="space-y-4">
          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#34D399]" />
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Bundle Suggestions
              </h2>
            </div>

            {bundles.length === 0 ? (
              <p className="text-xs text-[#9D95B8]">
                Add at least 2 products with wholesale cost and selling price to generate profitable stall bundles.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bundles.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F5F3FA]">
                        {b.title}
                      </span>
                      <span className="font-mono tabular-nums text-xs font-bold text-[#34D399]">
                        {fmt(b.bundlePrice)}
                      </span>
                    </div>
                    <p className="text-xs text-[#C4B5FD]">
                      {b.items.map((item) => item.name).join(' + ')}
                    </p>
                    <p className="text-[11px] text-[#9D95B8]">
                      Est. profit +{fmt(b.estimatedProfit)} · {b.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-[#13111C] border border-[#252136] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#C4B5FD]" />
              <h2 className="font-display text-sm font-bold text-[#F5F3FA]">
                Customer Pitch Scripts
              </h2>
            </div>

            <div className="space-y-2.5">
              {scripts.map((sc) => (
                <div
                  key={sc.stage}
                  className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3.5 space-y-1"
                >
                  <div className="text-xs font-bold text-[#C4B5FD]">
                    {sc.stage}
                  </div>
                  <p className="text-xs text-[#F5F3FA] leading-relaxed">
                    {sc.line}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Touch Zone Assignment Sheet */}
      <MobileBottomSheet
        isOpen={Boolean(editingZone)}
        onClose={() => setEditingZone(null)}
        title={
          ZONE_META.find((m) => m.id === editingZone)?.title || 'Assign Zone'
        }
        subtitle={
          editingZone ? dynamicZones[editingZone]?.why : undefined
        }
        footer={
          <button
            type="button"
            onClick={() => setEditingZone(null)}
            className="w-full min-h-[46px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-semibold"
          >
            Done
          </button>
        }
      >
        {editingZone && (
          <div className="space-y-3">
            <p className="text-xs text-[#A29BB8]">
              Tap categories to place or remove them from this zone:
            </p>
            {categoryNames.length === 0 ? (
              <p className="text-xs text-[#9D95B8]">
                Add product categories in Stock first to assign them to stall zones.
              </p>
            ) : (
              <div className="space-y-2">
                {categoryNames.map((catName) => {
                  const assigned = (
                    stallSetup.zoneCategoryOverrides?.[editingZone] || []
                  ).includes(catName);
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => toggleCategoryInZone(editingZone, catName)}
                      className={`w-full min-h-[48px] px-4 rounded-2xl border flex items-center justify-between text-sm font-semibold transition-colors ${
                        assigned
                          ? 'bg-[#1D1833] border-[#8B5CF6] text-[#F5F3FA]'
                          : 'bg-[#0E0C15] border-[#252136] text-[#A29BB8]'
                      }`}
                    >
                      <span>{catName}</span>
                      {assigned ? (
                        <Check className="w-4 h-4 text-[#34D399]" />
                      ) : (
                        <Plus className="w-4 h-4 text-[#8C84A6]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </MobileBottomSheet>

      {/* Saved Layouts Sheet */}
      <MobileBottomSheet
        isOpen={saveSheetOpen}
        onClose={() => setSaveSheetOpen(false)}
        title="Saved Stall Layouts"
        subtitle="Save and switch display arrangements"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Name current layout"
            aria-label="Stall layout name"
            className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0E0C15] border border-[#2A253D] text-sm text-[#F5F3FA]"
          />
          <button
            type="button"
            onClick={handleSaveNamedLayout}
            className="min-h-[44px] px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold shrink-0"
          >
            Save
          </button>
        </div>

        {(stallSetup.savedLayouts || []).length === 0 ? (
          <p className="text-xs text-[#9D95B8] text-center py-4">
            No saved layouts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {(stallSetup.savedLayouts || []).map((lay) => (
              <div
                key={lay.id}
                className="rounded-2xl bg-[#0E0C15] border border-[#221E33] p-3.5 flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => handleLoadLayout(lay)}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-sm font-semibold text-[#F5F3FA] truncate">
                    {lay.name}
                  </div>
                  <div className="text-xs text-[#9D95B8] font-mono">
                    {lay.widthFt}×{lay.depthFt} ft · {lay.stallType.replace('_', ' ')}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Delete layout ${lay.name}`}
                  onClick={() => handleDeleteLayout(lay.id)}
                  className="w-9 h-9 rounded-xl bg-[#1A1726] text-[#FB7185] flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
