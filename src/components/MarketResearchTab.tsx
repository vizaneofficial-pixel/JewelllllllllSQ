import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import type {
  AccountAiContext,
  CategoryGroupResolved,
  MarketResearchRecord,
  ProductDraft,
} from '../types/stall';
import { evaluateProductOpportunity } from '../utils/opportunityEngine';

interface MarketResearchTabProps {
  eventName: string;
  eventLocation: string;
  resolvedGroups: CategoryGroupResolved[];
  totalBudget: number;
  records: MarketResearchRecord[];
  onSaveRecord: (record: MarketResearchRecord) => void;
  onDeleteRecord: (id: string) => void;
  onSendProductDraft: (draft: ProductDraft) => void;
  accountContext?: AccountAiContext;
}

const EVENT_TYPES = [
  'Exhibition / Trade Fair',
  'Pop-Up Market',
  'Festive Mela',
  'College Fest',
  'Mall Kiosk',
];

const PRICE_RANGES = [
  'Any price range',
  'Under ₹250',
  '₹250 – ₹600',
  '₹600 – ₹1,500',
  '₹1,500+',
];

const AUDIENCE_TYPES = [
  'All shoppers',
  'Young women & college crowd',
  'Families & festive shoppers',
  'Gift buyers',
  'Premium boutique buyers',
];

const QUICK_TOPICS = [
  { id: 'trends', label: 'Trending items' },
  { id: 'pricing', label: 'Local price ranges' },
  { id: 'competitors', label: 'Competitor stalls' },
  { id: 'materials', label: 'Popular styles' },
  { id: 'gaps', label: 'Underserved gaps' },
  { id: 'risks', label: 'Slow-moving risks' },
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

function extractRupeeRange(text: string): { min: number; max: number } | null {
  const matches = [...text.matchAll(/(?:₹|Rs\.?\s*)(\d[\d,]*)/gi)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 200000);
  if (matches.length === 0) return null;
  return { min: Math.min(...matches), max: Math.max(...matches) };
}

export function MarketResearchTab({
  eventName,
  eventLocation,
  resolvedGroups,
  totalBudget,
  records,
  onSaveRecord,
  onDeleteRecord,
  onSendProductDraft,
  accountContext,
}: MarketResearchTabProps) {
  const categoryNames = useMemo(
    () => resolvedGroups.map((rg) => rg.group.name),
    [resolvedGroups]
  );

  const [subTab, setSubTab] = useState<'web' | 'opportunity'>('web');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryNames[0] || ''
  );
  const [specificProduct, setSpecificProduct] = useState('');
  const [locationFilter, setLocationFilter] = useState(eventLocation || '');
  const [eventTypeFilter, setEventTypeFilter] = useState(EVENT_TYPES[0]);
  const [audienceFilter, setAudienceFilter] = useState(AUDIENCE_TYPES[0]);
  const [priceRangeFilter, setPriceRangeFilter] = useState(PRICE_RANGES[0]);
  const [showDetailedEvidence, setShowDetailedEvidence] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(
    records[0]?.id || null
  );
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Opportunity Evaluator: New Candidate Product Draft Form
  const [draftName, setDraftName] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState<string>(
    resolvedGroups[0]?.group.id || ''
  );
  const [draftCost, setDraftCost] = useState<string>('120');
  const [draftPrice, setDraftPrice] = useState<string>('299');
  const [draftAppeal, setDraftAppeal] = useState<string>('8.5');
  const [draftNote, setDraftNote] = useState<string>('');

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) || records[0] || null,
    [records, activeRecordId]
  );

  const runResearch = async (customQuery?: string, topicLabel?: string) => {
    const targetCategory = selectedCategory || categoryNames.join(', ') || 'stall products';
    const targetProduct = specificProduct.trim();
    const targetLoc = locationFilter.trim() || eventLocation.trim() || eventName;
    const priceHint =
      priceRangeFilter !== PRICE_RANGES[0] ? ` (${priceRangeFilter})` : '';
    const audienceHint =
      audienceFilter !== AUDIENCE_TYPES[0] ? ` for ${audienceFilter}` : '';
    const productPhrase = targetProduct ? `${targetProduct} in ${targetCategory}` : targetCategory;

    const finalQuery =
      customQuery?.trim() ||
      query.trim() ||
      `${topicLabel || 'Popular products and typical retail prices'} for ${productPhrase} at ${eventTypeFilter} in ${targetLoc}${audienceHint}${priceHint}`;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          topic: topicLabel || (targetProduct ? `${targetProduct} Research` : 'Market Research'),
          eventName,
          eventLocation: targetLoc,
          categories: selectedCategory ? [selectedCategory] : categoryNames,
          budget: totalBudget,
          priceRangeHint:
            priceRangeFilter !== PRICE_RANGES[0] ? priceRangeFilter : undefined,
          accountContext,
        }),
      });
      const data = await res.json();
      const candidate = (data?.record ?? data) as Partial<MarketResearchRecord> | null;
      if (
        !res.ok ||
        !candidate ||
        typeof candidate.id !== 'string' ||
        typeof candidate.summary !== 'string'
      ) {
        throw new Error(data?.error || 'Research request failed.');
      }
      const record = candidate as MarketResearchRecord;
      onSaveRecord(record);
      setActiveRecordId(record.id);
      setShowDetailedEvidence(true);
      if (!customQuery) setQuery('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to run market research right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Price comparison bar range across sourced facts
  const sourcedRanges = useMemo(() => {
    if (!activeRecord) return [];
    return activeRecord.verifiedFacts
      .map((fact, idx) => {
        const range = extractRupeeRange(fact.claim);
        return range ? { id: idx, label: fact.sourceTitle, ...range } : null;
      })
      .filter(
        (x): x is { id: number; label: string; min: number; max: number } =>
          Boolean(x)
      );
  }, [activeRecord]);

  const maxSourcedPrice = useMemo(
    () => Math.max(100, ...sourcedRanges.map((r) => r.max)),
    [sourcedRanges]
  );

  // Product Opportunity Assessments for existing inventory
  const inventoryOpportunities = useMemo(() => {
    return resolvedGroups.flatMap((rg) =>
      rg.group.categories.map((cat) =>
        evaluateProductOpportunity({
          item: cat,
          categoryName: rg.group.name,
          categoryBudget: rg.group.budgetCap,
          researchRecords: records,
        })
      )
    );
  }, [resolvedGroups, records]);

  // Live preview assessment for candidate draft product
  const targetDraftGroup =
    resolvedGroups.find((rg) => rg.group.id === draftCategoryId) || resolvedGroups[0];

  const candidateAssessment = useMemo(() => {
    return evaluateProductOpportunity({
      item: {
        id: 'candidate_preview',
        name: draftName.trim() || 'New Product Idea',
        cost: Number(draftCost) || 0,
        price: Number(draftPrice) || 0,
        beauty: Number(draftAppeal) || 0,
      },
      categoryName: targetDraftGroup?.group.name || 'General',
      categoryBudget: targetDraftGroup?.group.budgetCap || totalBudget,
      researchRecords: records,
    });
  }, [draftName, draftCost, draftPrice, draftAppeal, targetDraftGroup, totalBudget, records]);

  const handleStageDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    const costNum = Math.max(0, Number(draftCost) || 0);
    const priceNum = Math.max(0, Number(draftPrice) || 0);
    const appealNum = Math.min(10, Math.max(1, Number(draftAppeal) || 7.5));
    onSendProductDraft({
      id: `draft_${Date.now()}`,
      name: draftName.trim().slice(0, 60),
      targetCategoryId: targetDraftGroup?.group.id,
      targetCategoryName: targetDraftGroup?.group.name || categoryNames[0] || 'General',
      cost: costNum,
      price: priceNum,
      beauty: appealNum,
      notes:
        draftNote.trim() ||
        candidateAssessment.demandEvidence ||
        candidateAssessment.summaryReason,
      sourceQuery: activeRecord?.grounded
        ? `From ${activeRecord.topic} (${activeRecord.retrievedDate})`
        : 'Evaluated in Product Opportunity Analyzer',
    });
    setDraftName('');
    setDraftNote('');
  };

  const ratingBadgeClass = (rating: string) => {
    if (rating === 'strong') {
      return 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/35';
    }
    if (rating === 'promising') {
      return 'bg-[#8B5CF6]/15 text-[#C4B5FD] border-[#8B5CF6]/35';
    }
    if (rating === 'insufficient_data') {
      return 'bg-[#252136] text-[#A29BB8] border-[#363050]';
    }
    return 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/35';
  };

  return (
    <div data-ai-section="research_workspace" className="space-y-6">
      {/* Sub-Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-[#13111C] border border-[#252136]">
          <button
            type="button"
            onClick={() => setSubTab('web')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'web'
                ? 'bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.5)]'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Research</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('opportunity')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'opportunity'
                ? 'bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.5)]'
                : 'text-[#A29BB8] hover:text-[#F5F3FA]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Product Opportunity</span>
          </button>
        </div>

        <span className="text-xs text-[#A29BB8]">
          {records.filter((r) => r.grounded).length} grounded web check
          {records.filter((r) => r.grounded).length === 1 ? '' : 's'} saved
        </span>
      </div>

      {subTab === 'web' ? (
        <>
          {/* 1. Search Bar & 6 Research Filters */}
          <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runResearch();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#78718E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search demand, prices, or trends for ${specificProduct || selectedCategory || 'your products'}...`}
                  className="w-full surface-inset rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F5F3FA] placeholder-[#78718E] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold shadow-[0_8px_20px_-6px_rgba(139,92,246,0.5)] disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                <span>{loading ? 'Researching...' : 'Search web'}</span>
              </button>
            </form>

            {/* 6 Structured Research Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Category</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA]"
                >
                  <option value="">All categories</option>
                  {categoryNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Product</span>
                <input
                  type="text"
                  value={specificProduct}
                  onChange={(e) => setSpecificProduct(e.target.value)}
                  placeholder="Optional item"
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA] placeholder-[#78718E]"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Location</span>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="City or market"
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA] placeholder-[#78718E]"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Event type</span>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA]"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Audience</span>
                <select
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA]"
                >
                  {AUDIENCE_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] text-[#A29BB8] mb-1">Price range</span>
                <select
                  value={priceRangeFilter}
                  onChange={(e) => setPriceRangeFilter(e.target.value)}
                  className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA]"
                >
                  {PRICE_RANGES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Quick Topic Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={loading}
                  onClick={() => void runResearch(undefined, topic.label)}
                  className="px-3 py-1.5 rounded-xl bg-[#1A1726] hover:bg-[#8B5CF6]/20 border border-[#2E2942] hover:border-[#8B5CF6]/50 text-xs font-medium text-[#C4B5FD] transition-colors disabled:opacity-50"
                >
                  {topic.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-[#FB7185]/10 border border-[#FB7185]/30 rounded-xl px-3.5 py-2.5 text-xs text-[#FDA4AF]">
                {error}
              </div>
            )}
          </section>

          {/* Saved Research Tabs */}
          {records.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {records.map((rec) => {
                const active = rec.id === activeRecord?.id;
                return (
                  <div
                    key={rec.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs shrink-0 ${
                      active
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/55 text-[#F5F3FA]'
                        : 'bg-[#13111C] border-[#252136] text-[#A29BB8]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveRecordId(rec.id)}
                      className="font-medium truncate max-w-[180px]"
                    >
                      {rec.topic || rec.query}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord(rec.id)}
                      aria-label="Delete research note"
                      className="text-[#78718E] hover:text-[#FB7185]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Research Results Display */}
          {!activeRecord ? (
            <div className="surface-card rounded-2xl p-8 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <div className="font-display text-base font-bold text-[#F5F3FA]">
                Check real market prices &amp; trends
              </div>
              <p className="text-xs text-[#A29BB8] max-w-md mx-auto">
                Pick a topic above or enter a question. Verified web sources are always separated from AI interpretation.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Concise Research Summary Card */}
              <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                      {activeRecord.query}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                        activeRecord.grounded
                          ? 'bg-[#34D399]/12 border-[#34D399]/30 text-[#34D399]'
                          : 'bg-[#F59E0B]/12 border-[#F59E0B]/30 text-[#FBBF24]'
                      }`}
                    >
                      {activeRecord.grounded ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{activeRecord.sources.length} web sources</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          <span>Offline guidance only</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#A29BB8]">
                      <Calendar className="w-3 h-3" />
                      {activeRecord.retrievedDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDetailedEvidence((v) => !v)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1A1726] border border-[#2E2942] text-[11px] font-semibold text-[#C4B5FD]"
                    >
                      <span>{showDetailedEvidence ? 'Hide evidence' : 'Show evidence'}</span>
                      {showDetailedEvidence ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#E2DCF2] leading-relaxed">
                  {activeRecord.summary}
                </p>

                {!activeRecord.grounded && (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#FDE68A]">
                    <AlertTriangle className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Live web sources unavailable: </span>
                      <span className="text-[#FDE68A]/85">
                        {activeRecord.fallbackReason ||
                          'No verified web results were returned. Showing AI planning checklist only — zero statistics or URLs were invented.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {showDetailedEvidence && (
                <>
                  {/* Visual Sourced Price Range Comparison */}
                  {sourcedRanges.length > 0 && (
                    <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#F5F3FA]">
                        <Tag className="w-3.5 h-3.5 text-[#34D399]" />
                        <span>Sourced Price Ranges</span>
                      </div>
                      <div className="space-y-2.5">
                        {sourcedRanges.slice(0, 5).map((item) => {
                          const leftPct = Math.round((item.min / maxSourcedPrice) * 100);
                          const widthPct = Math.max(
                            6,
                            Math.round(((item.max - item.min) / maxSourcedPrice) * 100)
                          );
                          return (
                            <div key={item.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#F5F3FA] truncate max-w-[65%]">
                                  {item.label}
                                </span>
                                <span className="font-mono tabular-nums text-[#34D399] font-semibold">
                                  ₹{item.min.toLocaleString('en-IN')}
                                  {item.max > item.min
                                    ? ` – ₹${item.max.toLocaleString('en-IN')}`
                                    : ''}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-[#0E0C15] relative overflow-hidden border border-[#211D30]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#34D399] absolute top-0"
                                  style={{
                                    left: `${Math.min(92, leftPct)}%`,
                                    width: `${Math.min(100 - leftPct, widthPct)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tier 1: Sourced Findings Cards */}
                  {activeRecord.verifiedFacts.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-wider">
                        <Globe className="w-3.5 h-3.5" />
                        <span>Sourced Findings</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {activeRecord.verifiedFacts.map((fact, idx) => {
                          const range = extractRupeeRange(fact.claim);
                          return (
                            <div
                              key={`${fact.sourceUrl}_${idx}`}
                              className="surface-card rounded-2xl p-4 flex flex-col justify-between gap-3 border-[#34D399]/20"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-semibold text-[#34D399] truncate">
                                    {fact.sourceTitle || extractDomain(fact.sourceUrl)}
                                  </span>
                                  {range && (
                                    <span className="font-mono tabular-nums px-2 py-0.5 rounded-lg bg-[#34D399]/12 text-[#34D399] font-semibold shrink-0">
                                      ₹{range.min.toLocaleString('en-IN')}
                                      {range.max > range.min
                                        ? `–₹${range.max.toLocaleString('en-IN')}`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#F5F3FA] leading-relaxed">
                                  {fact.claim}
                                </p>
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#252136]">
                                <span className="text-[#78718E]">
                                  {fact.dateNote || activeRecord.retrievedDate}
                                </span>
                                {fact.sourceUrl && (
                                  <a
                                    href={fact.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
                                  >
                                    <span>{extractDomain(fact.sourceUrl)}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Tier 2 & 3: AI Interpretation + Checklist Side-by-Side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3 border-[#8B5CF6]/25">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#C4B5FD] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span>AI Suggestions</span>
                        </div>
                        <span className="text-[10px] text-[#78718E]">Not sourced fact</span>
                      </div>
                      <ul className="space-y-2 text-xs text-[#F5F3FA]">
                        {activeRecord.interpretation.map((item, idx) => (
                          <li
                            key={idx}
                            className="surface-inset rounded-xl px-3 py-2 leading-relaxed"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#FBBF24] uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Verify Before Buying</span>
                      </div>
                      <div className="space-y-2">
                        {[...activeRecord.hypothesesToValidate, ...activeRecord.checklist]
                          .slice(0, 6)
                          .map((step, idx) => {
                            const key = `${activeRecord.id}_${idx}`;
                            const done = Boolean(checkedItems[key]);
                            return (
                              <label
                                key={key}
                                className="flex items-start gap-2.5 surface-inset rounded-xl px-3 py-2 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() =>
                                    setCheckedItems((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                  className="accent-[#8B5CF6] mt-0.5 rounded shrink-0"
                                />
                                <span
                                  className={
                                    done
                                      ? 'line-through text-[#78718E]'
                                      : 'text-[#F5F3FA]'
                                  }
                                >
                                  {step}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* All Source Links Strip */}
                  {activeRecord.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-[#78718E]">Sources:</span>
                      {activeRecord.sources.map((src, idx) => (
                        <a
                          key={`${src.uri}_${idx}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#13111C] hover:bg-[#1A1726] border border-[#252136] text-[11px] text-[#C4B5FD]"
                        >
                          <span className="truncate max-w-[160px]">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        /* PRODUCT OPPORTUNITY SUB-TAB */
        <div className="space-y-6">
          {/* 1. Evaluate & Draft a New Candidate Product -> Send to Stock Planner */}
          <section className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                  Evaluate &amp; Draft a New Product
                </h2>
                <p className="text-xs text-[#A29BB8] mt-0.5">
                  Test margin, risk, and suggested quantity before staging a draft for your Stock Planner. Nothing is added until you confirm there.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${ratingBadgeClass(
                  candidateAssessment.rating
                )}`}
              >
                {candidateAssessment.ratingLabel}
              </span>
            </div>

            <form onSubmit={handleStageDraft} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                <label className="block lg:col-span-2">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Product name
                  </span>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Oxidized Pearl Jhumka"
                    className="w-full surface-inset rounded-xl px-3 py-2 text-[#F5F3FA] placeholder-[#78718E]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Target category
                  </span>
                  <select
                    value={draftCategoryId}
                    onChange={(e) => setDraftCategoryId(e.target.value)}
                    className="w-full surface-inset rounded-xl px-2.5 py-2 text-[#F5F3FA]"
                  >
                    {resolvedGroups.map(({ group }) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Buy cost (₹)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={draftCost}
                    onChange={(e) => setDraftCost(e.target.value)}
                    className="w-full surface-inset rounded-xl px-2.5 py-2 font-mono tabular-nums text-[#F5F3FA]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Sell price (₹)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    className="w-full surface-inset rounded-xl px-2.5 py-2 font-mono tabular-nums text-[#F5F3FA]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
                <label className="block sm:col-span-3">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Customer appeal (1–10)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={draftAppeal}
                    onChange={(e) => setDraftAppeal(e.target.value)}
                    className="w-full surface-inset rounded-xl px-2.5 py-2 font-mono tabular-nums text-[#F5F3FA]"
                  />
                </label>

                <label className="block sm:col-span-6">
                  <span className="block text-[10px] text-[#A29BB8] mb-1">
                    Optional research note
                  </span>
                  <input
                    type="text"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="Supplier lead, colour note, or observed stall price"
                    className="w-full surface-inset rounded-xl px-3 py-2 text-[#F5F3FA] placeholder-[#78718E]"
                  />
                </label>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={!draftName.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-semibold disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Send draft to Stock Planner</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>

            {/* Live Candidate Preview Strip */}
            <div className="surface-inset rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono tabular-nums">
                <span>
                  <span className="text-[#78718E] font-sans">Profit/pc: </span>
                  <strong
                    className={
                      candidateAssessment.profitPerPiece > 0
                        ? 'text-[#34D399]'
                        : 'text-[#FB7185]'
                    }
                  >
                    {fmt(candidateAssessment.profitPerPiece)}
                  </strong>
                </span>
                <span>
                  <span className="text-[#78718E] font-sans">Margin: </span>
                  <strong className="text-[#F5F3FA]">
                    {candidateAssessment.marginPct}%
                  </strong>
                </span>
                <span>
                  <span className="text-[#78718E] font-sans">Risk: </span>
                  <strong className="text-[#FBBF24]">
                    {candidateAssessment.stockingRisk}
                  </strong>
                </span>
                <span>
                  <span className="text-[#78718E] font-sans">Suggested qty: </span>
                  <strong className="text-[#C4B5FD]">
                    {candidateAssessment.suggestedQtyMin !== null
                      ? `${candidateAssessment.suggestedQtyMin}–${candidateAssessment.suggestedQtyMax} pcs`
                      : 'Not enough information'}
                  </strong>
                </span>
              </div>
              <p className="text-[11px] text-[#C7C1D8]">
                {candidateAssessment.summaryReason}
              </p>
              <div className="text-[11px] text-[#A29BB8]">
                <span className="font-semibold text-[#F5F3FA]">Market evidence: </span>
                {candidateAssessment.demandEvidence || 'Not enough information — run a Web Research search first.'}
              </div>
            </div>
          </section>

          {/* 2. Opportunity Analysis Across Current Inventory */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#F5F3FA]">
                Your Catalogue Opportunity Breakdown
              </h2>
              <span className="text-[11px] text-[#A29BB8]">
                Demand &amp; competition signals only appear from verified web searches
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {inventoryOpportunities.map((item) => (
                <div
                  key={item.id}
                  className="surface-card rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#A78BFA]">
                        {item.categoryName}
                      </div>
                      <h3 className="font-display text-sm font-bold text-[#F5F3FA] truncate">
                        {item.name}
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 ${ratingBadgeClass(
                        item.rating
                      )}`}
                    >
                      {item.ratingLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 surface-inset rounded-xl p-2.5 text-[11px] font-mono tabular-nums">
                    <div>
                      <div className="text-[10px] font-sans text-[#78718E]">Buy / Sell</div>
                      <div className="text-[#F5F3FA] font-semibold">
                        {fmt(item.cost)}/{fmt(item.price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-sans text-[#78718E]">Profit/pc</div>
                      <div
                        className={`font-semibold ${
                          item.profitPerPiece > 0 ? 'text-[#34D399]' : 'text-[#FB7185]'
                        }`}
                      >
                        +{fmt(item.profitPerPiece)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-sans text-[#78718E]">Margin</div>
                      <div className="text-[#F5F3FA] font-semibold">{item.marginPct}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-sans text-[#78718E]">Stock risk</div>
                      <div
                        className={`font-semibold ${
                          item.stockingRisk === 'Low'
                            ? 'text-[#34D399]'
                            : item.stockingRisk === 'High'
                            ? 'text-[#FB7185]'
                            : 'text-[#FBBF24]'
                        }`}
                      >
                        {item.stockingRisk}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#C7C1D8] leading-snug">
                    {item.summaryReason}
                  </p>

                  <div className="space-y-1 text-[11px] border-t border-[#252136] pt-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#78718E] shrink-0">Suggested qty:</span>
                      <span className="font-mono tabular-nums text-[#C4B5FD] text-right">
                        {item.suggestedQtyMin !== null
                          ? `${item.suggestedQtyMin}–${item.suggestedQtyMax} pcs`
                          : 'Not enough information'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#78718E] shrink-0">Demand signal:</span>
                      <span className="text-[#A29BB8] text-right">
                        {item.demandEvidence || 'Not enough information'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#78718E] shrink-0">Competition / price:</span>
                      <span className="text-[#A29BB8] text-right">
                        {item.competitionSignal || 'Not enough information'}
                      </span>
                    </div>
                  </div>

                  {item.missingDataHints.length > 0 && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#161322] border border-[#252136] px-2.5 py-2 text-[11px] text-[#A29BB8]">
                      <Info className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                      <span>{item.missingDataHints[0]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
