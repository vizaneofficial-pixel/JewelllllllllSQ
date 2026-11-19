import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  Scale,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Star,
  Copy,
  CheckCircle2,
  Layers,
  Crown,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Calculator,
  Lightbulb,
  Wand2,
  Download,
  Play,
  Eye,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Youtube,
  DollarSign,
  Percent,
  Package,
  Award,
  Send
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';

const INITIAL_CATEGORIES = [
  { id: 'white', name: 'White (Resin)', shortName: 'White', cost: 280, price: 499, beauty: 9.5, barColor: '#f8fafc', textClass: 'text-slate-100', bgClass: 'bg-slate-800 border-slate-600' },
  { id: 'colours', name: 'Colours (Resin)', shortName: 'Colours', cost: 210, price: 449, beauty: 9.0, barColor: '#ec4899', textClass: 'text-pink-300', bgClass: 'bg-pink-500/15 border-pink-500/40' },
  { id: 'yellow', name: 'Yellow (Resin)', shortName: 'Yellow', cost: 180, price: 399, beauty: 8.2, barColor: '#eab308', textClass: 'text-amber-300', bgClass: 'bg-amber-500/15 border-amber-500/40' },
  { id: 'cuff', name: 'Cuff', shortName: 'Cuff', cost: 150, price: 349, beauty: 7.8, barColor: '#8b5cf6', textClass: 'text-violet-300', bgClass: 'bg-violet-500/15 border-violet-500/40' },
  { id: 'silver_gold', name: 'Silver Gold (Basic)', shortName: 'Silver Gold', cost: 120, price: 299, beauty: 5.5, barColor: '#94a3b8', textClass: 'text-slate-300', bgClass: 'bg-slate-500/15 border-slate-500/40' },
  { id: 'wooden', name: 'Wooden (Small)', shortName: 'Wooden', cost: 100, price: 249, beauty: 5.0, barColor: '#d97706', textClass: 'text-orange-300', bgClass: 'bg-orange-500/15 border-orange-500/40' }
];

const EXTRA_COLORS = [
  { barColor: '#06b6d4', textClass: 'text-cyan-300', bgClass: 'bg-cyan-500/15 border-cyan-500/40' },
  { barColor: '#10b981', textClass: 'text-emerald-300', bgClass: 'bg-emerald-500/15 border-emerald-500/40' },
  { barColor: '#3b82f6', textClass: 'text-blue-300', bgClass: 'bg-blue-500/15 border-blue-500/40' }
];

const INITIAL_STALL_STOCK = [
  { id: 's_bangles', name: 'Selected Bangle Mix (17 pcs)', category: 'Bangles', cost: 2990, price: 6583, qty: 1, sellThrough: 90, isSyncedBundle: true, unitPieces: 17 },
  { id: 's_jhumka', name: 'Oxidized Jhumkas', category: 'Earrings', cost: 65, price: 199, qty: 25, sellThrough: 90, isSyncedBundle: false },
  { id: 's_korean', name: 'Korean Studs & Hoops', category: 'Earrings', cost: 45, price: 149, qty: 30, sellThrough: 90, isSyncedBundle: false },
  { id: 's_rings', name: 'Anti-Tarnish Rings', category: 'Rings', cost: 55, price: 179, qty: 25, sellThrough: 85, isSyncedBundle: false },
  { id: 's_chains', name: 'Dainty Neck Chains', category: 'Necklaces', cost: 95, price: 299, qty: 15, sellThrough: 85, isSyncedBundle: false },
  { id: 's_combos', name: 'Bangle + Ring Combo Boxes', category: 'Bundles', cost: 140, price: 349, qty: 10, sellThrough: 85, isSyncedBundle: false }
];

const PLAYBOOK_CARDS = [
  {
    id: 'p1',
    badge: 'TACTIC 01',
    title: 'The ₹50 Bargaining Cushion',
    desc: 'Siliguri exhibition shoppers love asking for a concession. Tag Colours at ₹499 and White at ₹549, then happily give a "₹50 Grand Casa Special Discount" to close immediately at ₹449 and ₹499 with 100% of your planned profit intact.',
    metric: '+35% Faster Close Rate',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  },
  {
    id: 'p2',
    badge: 'TACTIC 02',
    title: 'The "Gloss + Matte" ₹599 Stack Bundle',
    desc: 'Pair 1 Glossy Colours Resin (₹210 cost / ₹449 sell) + 1 Matte Wooden Stacker (₹100 cost / ₹249 sell) for ₹599 (saving the buyer ₹99). Your combined cost is ₹310 and you pocket +₹289 profit in a single transaction while clearing wooden stock.',
    metric: '₹289 Net Profit / Pair',
    color: 'border-pink-500/40 bg-pink-500/10 text-pink-300'
  },
  {
    id: 'p3',
    badge: 'TACTIC 03',
    title: 'The Mirror Trap Placement',
    desc: 'Place an angled tabletop mirror on the right side of your 6ft table right next to your ₹349 Cuffs and ₹399 Yellow Festive bangles. Once a shopper slips a cuff onto her wrist and checks the mirror, conversion jumps past 70%.',
    metric: '2.4x Try-On Conversion',
    color: 'border-violet-500/40 bg-violet-500/10 text-violet-300'
  },
  {
    id: 'p4',
    badge: 'TACTIC 04',
    title: 'Last-Day 4 PM Clearance Protocol',
    desc: 'In the final 4 hours of Grand Casa, flip your sign to "Pick Any Bangle + Any ₹179 Ring for ₹499". Even on your ₹210 Colours bangle + ₹55 Ring (₹265 total cost), you walk away with +₹234 pure cash and zero dead stock.',
    metric: 'Zero Unsold Dead Stock',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  }
];

const CURATED_VIDEOS = [
  {
    id: 'v1',
    title: 'Jewellery Stall Display & Aesthetics for Pop-Up Exhibitions',
    tag: 'Display Setup',
    duration: '6 min guide',
    keyTakeaway: 'Use tiered wooden/velvet risers at eye-level so customers walking 6 feet away spot your White & Colours showpieces first.',
    queryUrl: 'https://www.youtube.com/results?search_query=jewellery+exhibition+stall+display+ideas+india',
    accent: 'from-amber-500/20 to-rose-500/20 border-amber-500/40'
  },
  {
    id: 'v2',
    title: 'How to Price & Bundle Small Business Jewellery at Fairs',
    tag: 'Pricing Psychology',
    duration: '8 min strategy',
    keyTakeaway: 'Anchor with ₹499 statement pieces on top trays, and place "Any 2 for ₹599" stack trays right at wrist-testing height.',
    queryUrl: 'https://www.youtube.com/results?search_query=how+to+price+jewellery+for+pop+up+stall+india',
    accent: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/40'
  },
  {
    id: 'v3',
    title: 'Turning Footfall into Sales: Craft Fair & Expo Pitch Secrets',
    tag: 'Crowd Conversion',
    duration: '5 min playbook',
    keyTakeaway: 'Never ask "Can I help you?" — instead hand them a mirror and say "Try stacking this matte wooden piece with the glossy resin!"',
    queryUrl: 'https://www.youtube.com/results?search_query=craft+fair+booth+setup+and+selling+tips+jewelry',
    accent: 'from-violet-500/20 to-pink-500/20 border-violet-500/40'
  }
];

// Helper: Exponential Backoff Gemini API Call
async function callGeminiTextAPI(systemPrompt, userPrompt, jsonSchema = null) {
  const apiKey = '';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  };
  if (jsonSchema) {
    payload.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: jsonSchema
    };
  }

  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response');
      return jsonSchema ? JSON.parse(text) : text;
    } catch (err) {
      if (attempt === delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

async function callGeminiImageAPI(promptText) {
  const apiKey = '';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  };
  const delays = [1000, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const base64Data = result?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (base64Data) return `data:image/png;base64,${base64Data}`;
      throw new Error('No image returned');
    } catch (err) {
      if (attempt === delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('optimizer'); // 'optimizer' | 'calculator' | 'strategies'
  const [budgetCap, setBudgetCap] = useState(3000);
  const [minProfitFloor, setMinProfitFloor] = useState(3100);
  const [stallFee, setStallFee] = useState(9000);
  const [maxPerCategory, setMaxPerCategory] = useState(6);
  const [globalSellThrough, setGlobalSellThrough] = useState(90);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [showItemEditor, setShowItemEditor] = useState(false);

  const [rules, setRules] = useState({
    allAtLeastOne: true,
    evenDistribution: true,
    beautyFirst: false,
    maxProfitFocus: false,
    safe90Mode: false
  });

  const [selectedComboId, setSelectedComboId] = useState(null);
  const [customQuantities, setCustomQuantities] = useState(null);
  const [copied, setCopied] = useState(false);
  const [minColoursRule, setMinColoursRule] = useState(1);

  // Smart AI Command Bar state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(
    'Try: "Max 5 Cuff, Min 2 Colours, Budget 3000" or "White cost 250 sell 499, add Nose Pins cost 30 sell 99 qty 30"'
  );

  // Total Stall Calculator state
  const [stallStock, setStallStock] = useState(INITIAL_STALL_STOCK);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditReport, setAiAuditReport] = useState(null);

  // AI Strategy & Visual Studio state
  const [selectedZone, setSelectedZone] = useState('front_center');
  const [strategyPrompt, setStrategyPrompt] = useState('');
  const [strategyResponse, setStrategyResponse] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  const toggleRule = (key) => {
    setRules((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'beautyFirst' && next.beautyFirst) next.maxProfitFocus = false;
      if (key === 'maxProfitFocus' && next.maxProfitFocus) next.beautyFirst = false;
      return next;
    });
  };

  const updateCat = (id, field, val) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === 'name' ? val : Math.max(0, Number(val) || 0) } : c))
    );
  };

  const addCat = (customObj = null) => {
    const style = EXTRA_COLORS[categories.length % EXTRA_COLORS.length];
    setCategories((prev) => [
      ...prev,
      customObj
        ? { id: `item_${Date.now()}`, ...style, ...customObj }
        : {
            id: `item_${Date.now()}`,
            name: `Item ${prev.length + 1}`,
            cost: 150,
            price: 349,
            beauty: 8.0,
            ...style
          }
    ]);
  };

  const removeCat = (id) => {
    if (categories.length <= 2) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const resetAll = () => {
    setBudgetCap(3000);
    setMinProfitFloor(3100);
    setStallFee(9000);
    setMaxPerCategory(6);
    setMinColoursRule(1);
    setCategories(INITIAL_CATEGORIES);
    setRules({
      allAtLeastOne: true,
      evenDistribution: true,
      beautyFirst: false,
      maxProfitFocus: false,
      safe90Mode: false
    });
    setCustomQuantities(null);
    setStallStock(INITIAL_STALL_STOCK);
    setGlobalSellThrough(90);
    setAiFeedback('Reset complete! All default Grand Casa Siliguri parameters restored.');
  };


  // Core Optimizer Engine
  const generatedCombos = useMemo(() => {
    const n = categories.length;
    if (n === 0) return [];

    const bounds = categories.map((cat) => {
      let min = rules.allAtLeastOne ? 1 : 0;
      if (cat.id === 'colours' && minColoursRule > min) min = minColoursRule;
      let max = rules.evenDistribution ? maxPerCategory : 11;
      if (rules.evenDistribution && cat.beauty <= 6.0) max = Math.min(max, 2);
      const maxAfford = cat.cost > 0 ? Math.floor(budgetCap / cat.cost) : 10;
      max = Math.max(min, Math.min(max, maxAfford));
      return { min, max };
    });

    const results = [];
    const minBudgetUse = budgetCap * 0.88;
    let nodes = 0;

    const evaluate = (counts) => {
      let cost = 0;
      let rev100 = 0;
      let pieces = 0;
      let beautySum = 0;

      for (let i = 0; i < n; i++) {
        const q = counts[i];
        if (!q) continue;
        cost += q * categories[i].cost;
        rev100 += q * categories[i].price;
        pieces += q;
        beautySum += q * categories[i].beauty;
      }

      if (pieces === 0 || cost > budgetCap || cost < minBudgetUse) return;
      const prof100 = rev100 - cost;
      const rev90 = Math.round(rev100 * 0.9);
      const prof90 = rev90 - cost;

      if (prof100 < minProfitFloor) return;
      const avgBeauty = Number((beautySum / pieces).toFixed(2));
      if (rules.beautyFirst && avgBeauty < 7.75) return;

      const mean = pieces / n;
      const variance = counts.reduce((a, q) => a + Math.pow(q - mean, 2), 0) / n;
      const evenness = Number(Math.max(1, 10 - Math.sqrt(variance) * 1.5).toFixed(2));

      let score = (prof100 / budgetCap) * 40 + (avgBeauty / 10) * 35 + (evenness / 10) * 25;
      if (rules.beautyFirst) score = (avgBeauty / 10) * 80 + (prof100 / budgetCap) * 20;
      if (rules.maxProfitFocus) score = (prof100 / budgetCap) * 85 + (avgBeauty / 10) * 15;
      if (rules.safe90Mode) score = (prof90 / budgetCap) * 75 + (avgBeauty / 10) * 25;

      results.push({
        counts: [...counts],
        cost,
        rev100,
        prof100,
        rev90,
        prof90,
        pieces,
        avgBeauty,
        evenness,
        score
      });
    };

    const dfs = (idx, counts, cost) => {
      if (nodes > 40000) return;
      nodes++;
      if (idx === n) {
        evaluate(counts);
        return;
      }
      const { min, max } = bounds[idx];
      const cCost = categories[idx].cost;
      for (let q = min; q <= max; q++) {
        if (cost + q * cCost > budgetCap) break;
        counts[idx] = q;
        dfs(idx + 1, counts, cost + q * cCost);
      }
    };

    dfs(0, new Array(n).fill(0), 0);

    if (results.length < 15) {
      nodes = 0;
      const fallbackDfs = (idx, counts, cost) => {
        if (nodes > 30000) return;
        nodes++;
        if (idx === n) {
          let c = 0, r = 0, p = 0, b = 0;
          for (let i = 0; i < n; i++) {
            const q = counts[i];
            c += q * categories[i].cost;
            r += q * categories[i].price;
            p += q;
            b += q * categories[i].beauty;
          }
          if (p === 0 || c > budgetCap || c < budgetCap * 0.78) return;
          const pr = r - c;
          if (pr < minProfitFloor * 0.8) return;
          const avgB = Number((b / p).toFixed(2));
          const rev90 = Math.round(r * 0.9);
          results.push({
            counts: [...counts],
            cost: c,
            rev100: r,
            prof100: pr,
            rev90,
            prof90: rev90 - c,
            pieces: p,
            avgBeauty: avgB,
            evenness: 7.5,
            score: (pr / budgetCap) * 50 + (avgB / 10) * 50
          });
          return;
        }
        const minQ = rules.allAtLeastOne ? 1 : 0;
        const maxQ = rules.evenDistribution ? maxPerCategory : 9;
        for (let q = minQ; q <= maxQ; q++) {
          if (cost + q * categories[idx].cost > budgetCap) break;
          counts[idx] = q;
          fallbackDfs(idx + 1, counts, cost + q * categories[idx].cost);
        }
      };
      fallbackDfs(0, new Array(n).fill(0), 0);
    }

    const unique = new Map();
    results.forEach((r) => {
      const k = r.counts.join('-');
      if (!unique.has(k)) unique.set(k, r);
    });

    const sorted = Array.from(unique.values()).sort((a, b) => {
      if (rules.beautyFirst) return b.avgBeauty - a.avgBeauty || b.prof100 - a.prof100;
      if (rules.maxProfitFocus) return b.prof100 - a.prof100 || b.avgBeauty - a.avgBeauty;
      if (rules.safe90Mode) return b.prof90 - a.prof90 || b.avgBeauty - a.avgBeauty;
      return b.score - a.score;
    });

    const diverse = [];
    for (const cand of sorted) {
      if (diverse.length >= 15) break;
      const tooClose = diverse.some((ex) => {
        let diff = 0;
        for (let i = 0; i < n; i++) diff += Math.abs(ex.counts[i] - cand.counts[i]);
        return diff < 2;
      });
      if (!tooClose || sorted.length <= 15) diverse.push(cand);
    }

    if (diverse.length === 0) return [];

    const maxProf = Math.max(...diverse.map((d) => d.prof100));
    const maxBeauty = Math.max(...diverse.map((d) => d.avgBeauty));
    const maxEven = Math.max(...diverse.map((d) => d.evenness));
    const maxProf90 = Math.max(...diverse.map((d) => d.prof90));

    const TAG_POOL = [
      'Balanced 4-4-6',
      'Zero Overload',
      'Colours Lead',
      'Sunshine Festive',
      'Sweet Spot Mix',
      'Boutique Curated',
      'High Impulse',
      'Crowd Magnet'
    ];

    return diverse.map((item, i) => {
      let badge = TAG_POOL[i % TAG_POOL.length];
      let badgeColor = 'bg-slate-800 text-slate-200 border-slate-700';

      if (item.avgBeauty === maxBeauty) {
        badge = 'Peak Beauty';
        badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      } else if (item.prof100 === maxProf) {
        badge = 'Max Profit';
        badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else if (item.prof90 === maxProf90 && item.prof90 >= minProfitFloor) {
        badge = '90% Safe';
        badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      } else if (item.evenness === maxEven) {
        badge = 'Balanced 4-4-6';
        badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      } else if (Math.max(...item.counts) <= 5) {
        badge = 'Zero Overload';
        badgeColor = 'bg-pink-500/20 text-pink-300 border-pink-500/40';
      }

      return {
        ...item,
        id: `c_${i + 1}`,
        rank: i + 1,
        label: `#${String(i + 1).padStart(2, '0')}`,
        badge,
        badgeColor
      };
    });
  }, [categories, budgetCap, minProfitFloor, maxPerCategory, minColoursRule, rules]);

  useEffect(() => {
    if (generatedCombos.length > 0 && !generatedCombos.some((c) => c.id === selectedComboId)) {
      setSelectedComboId(generatedCombos[0].id);
      setCustomQuantities(null);
    }
  }, [generatedCombos, selectedComboId]);

  const activeCombo = useMemo(() => {
    const base = generatedCombos.find((c) => c.id === selectedComboId) || generatedCombos[0];
    if (!base) return null;
    if (!customQuantities) return base;

    let cost = 0, rev100 = 0, pieces = 0, beautySum = 0;
    customQuantities.forEach((q, i) => {
      if (!categories[i]) return;
      cost += q * categories[i].cost;
      rev100 += q * categories[i].price;
      pieces += q;
      beautySum += q * categories[i].beauty;
    });

    const rev90 = Math.round(rev100 * 0.9);
    return {
      ...base,
      badge: 'Custom Mix',
      counts: customQuantities,
      cost,
      rev100,
      prof100: rev100 - cost,
      rev90,
      prof90: rev90 - cost,
      pieces,
      avgBeauty: pieces > 0 ? Number((beautySum / pieces).toFixed(2)) : 0,
      isCustom: true
    };
  }, [generatedCombos, selectedComboId, customQuantities, categories]);

  // Keep synced bangle mix updated inside Total Stall Stock
  useEffect(() => {
    if (!activeCombo) return;
    setStallStock((prev) =>
      prev.map((item) =>
        item.isSyncedBundle
          ? {
              ...item,
              name: `Selected Bangle Mix (${activeCombo.pieces} pcs)`,
              cost: activeCombo.cost,
              price: activeCombo.rev100,
              unitPieces: activeCombo.pieces
            }
          : item
      )
    );
  }, [activeCombo]);

  const stepQty = (idx, delta) => {
    if (!activeCombo) return;
    const next = [...activeCombo.counts];
    next[idx] = Math.max(0, (next[idx] || 0) + delta);
    setCustomQuantities(next);
  };

  const copyOrder = () => {
    if (!activeCombo) return;
    const items = categories
      .map((c, i) => (activeCombo.counts[i] > 0 ? `${activeCombo.counts[i]}x ${c.name} (₹${c.cost}→₹${c.price})` : null))
      .filter(Boolean)
      .join(' | ');
    const text = `StallIQ Mix ${activeCombo.label}: ${items} — Cost: ₹${activeCombo.cost} | Profit: +₹${activeCombo.prof100} | Beauty: ${activeCombo.avgBeauty}★`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Intelligent Natural Language + Gemini AI Parser for Raw Input
  const applyRawCommandFallback = (rawText) => {
    const lower = rawText.toLowerCase();
    const changes = [];

    const budgetMatch = lower.match(/budget\s*(?:of|is|to|=)?\s*₹?\s*(\d{3,5})/);
    if (budgetMatch) {
      setBudgetCap(Number(budgetMatch[1]));
      changes.push(`Budget → ₹${budgetMatch[1]}`);
    }

    const profitMatch = lower.match(/(?:profit|floor)\s*(?:above|atleast|at least|min|to|=)?\s*₹?\s*(\d{3,5})/);
    if (profitMatch) {
      setMinProfitFloor(Number(profitMatch[1]));
      changes.push(`Min Profit → ₹${profitMatch[1]}`);
    }

    const stallMatch = lower.match(/stall\s*(?:fee|cost|rent)?\s*(?:is|to|=)?\s*₹?\s*(\d{3,5})/);
    if (stallMatch) {
      setStallFee(Number(stallMatch[1]));
      changes.push(`Stall Fee → ₹${stallMatch[1]}`);
    }

    const maxMatch = lower.match(/(?:max|cap)\s*(\d{1,2})\s*(?:cuff|cuffs|each|per item)?|(?:max|cap)\s*(?:cuff|cuffs|each|per item)\s*(?:at|to|=)?\s*(\d{1,2})/);
    if (maxMatch) {
      const val = Number(maxMatch[1] || maxMatch[2]);
      if (val >= 2) {
        setMaxPerCategory(val);
        setRules((r) => ({ ...r, evenDistribution: true }));
        changes.push(`Max Cuff/Category → ${val}`);
      }
    }

    const minColMatch = lower.match(/min\s*(\d{1,2})\s*colours?/);
    if (minColMatch) {
      setMinColoursRule(Number(minColMatch[1]));
      changes.push(`Min Colours → ${minColMatch[1]}`);
    }

    if (lower.includes('all 6') || lower.includes('atleast 1') || lower.includes('at least 1')) {
      setRules((r) => ({ ...r, allAtLeastOne: true }));
      changes.push('All 6 Included ON');
    }

    if (lower.includes('even') || lower.includes('spread') || lower.includes('balance')) {
      setRules((r) => ({ ...r, evenDistribution: true }));
      changes.push('Even Spread ON');
    }
    if (lower.includes('90%')) {
      setRules((r) => ({ ...r, safe90Mode: true }));
      changes.push('90% Safe Mode ON');
    }

    // Check category specific price/cost/beauty updates
    setCategories((prev) =>
      prev.map((cat) => {
        const cKey = (cat.shortName || cat.name).toLowerCase();
        if (!lower.includes(cKey)) return cat;
        let updated = { ...cat };
        const costRegex = new RegExp(`${cKey}[^,.;]*?cost\\s*₹?\\s*(\\d{2,4})`, 'i');
        const sellRegex = new RegExp(`${cKey}[^,.;]*?(?:sell|price)\\s*₹?\\s*(\\d{2,4})`, 'i');
        const beautyRegex = new RegExp(`${cKey}[^,.;]*?(?:beauty|star|score)\\s*(\\d+(?:\\.\\d+)?)`, 'i');
        const cM = rawText.match(costRegex);
        const sM = rawText.match(sellRegex);
        const bM = rawText.match(beautyRegex);
        if (cM) {
          updated.cost = Number(cM[1]);
          changes.push(`${cat.shortName || cat.name} Cost → ₹${cM[1]}`);
        }
        if (sM) {
          updated.price = Number(sM[1]);
          changes.push(`${cat.shortName || cat.name} Sell → ₹${sM[1]}`);
        }
        if (bM) {
          updated.beauty = Math.min(10, Number(bM[1]));
          changes.push(`${cat.shortName || cat.name} Beauty → ${bM[1]}★`);
        }
        return updated;
      })
    );

    // Check if user wants to add a new stock item
    const addMatch = rawText.match(/add\s+([a-zA-Z\s]+?)\s+cost\s*₹?\s*(\d+)\s*(?:sell|price)\s*₹?\s*(\d+)(?:.*?qty\s*(\d+))?/i);
    if (addMatch) {
      const itemName = addMatch[1].trim();
      const itemCost = Number(addMatch[2]);
      const itemPrice = Number(addMatch[3]);
      const itemQty = addMatch[4] ? Number(addMatch[4]) : 25;
      setStallStock((prev) => [
        ...prev,
        {
          id: `s_${Date.now()}`,
          name: itemName
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          category: 'Custom',
          cost: itemCost,
          price: itemPrice,
          qty: itemQty,
          sellThrough: globalSellThrough,
          isSyncedBundle: false
        }
      ]);
      changes.push(`Added ${itemQty}x ${itemName} (₹${itemCost}→₹${itemPrice}) to Stall Stock`);
    }

    return changes;
  };

  const handleSmartAiSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!aiInput.trim()) return;
    setAiLoading(true);

    // Always run instant local regex parser first for immediate responsiveness
    const localChanges = applyRawCommandFallback(aiInput);

    try {
      const schema = {
        type: 'OBJECT',
        properties: {
          budgetCap: { type: 'NUMBER' },
          minProfitFloor: { type: 'NUMBER' },
          stallFee: { type: 'NUMBER' },
          maxPerCategory: { type: 'NUMBER' },
          allAtLeastOne: { type: 'BOOLEAN' },
          evenDistribution: { type: 'BOOLEAN' },
          beautyFirst: { type: 'BOOLEAN' },
          maxProfitFocus: { type: 'BOOLEAN' },
          safe90Mode: { type: 'BOOLEAN' },
          categoryUpdates: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                cost: { type: 'NUMBER' },
                price: { type: 'NUMBER' },
                beauty: { type: 'NUMBER' },
                isNewBangleCategory: { type: 'BOOLEAN' }
              }
            }
          },
          stallStockAdditions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                category: { type: 'STRING' },
                cost: { type: 'NUMBER' },
                price: { type: 'NUMBER' },
                qty: { type: 'NUMBER' },
                sellThrough: { type: 'NUMBER' }
              }
            }
          },
          summaryMessage: { type: 'STRING' }
        }
      };

      const sysPrompt = `You are the AI brain for StallIQ Pro, a jewellery stall optimizer for Grand Casa, Siliguri.
Current bangle categories: ${JSON.stringify(categories.map((c) => ({ name: c.name, cost: c.cost, price: c.price, beauty: c.beauty })))}.
Current settings: budgetCap=${budgetCap}, minProfitFloor=${minProfitFloor}, stallFee=${stallFee}, maxPerCategory=${maxPerCategory}.
Parse the user's raw text and return only the fields that should be updated or added, plus a concise 1-sentence summaryMessage confirming what was adjusted and a smart tip.`;

      const parsed = await callGeminiTextAPI(sysPrompt, aiInput, schema);

      if (parsed) {
        if (parsed.budgetCap && parsed.budgetCap >= 500) setBudgetCap(parsed.budgetCap);
        if (parsed.minProfitFloor && parsed.minProfitFloor >= 500) setMinProfitFloor(parsed.minProfitFloor);
        if (parsed.stallFee && parsed.stallFee >= 1000) setStallFee(parsed.stallFee);
        if (parsed.maxPerCategory && parsed.maxPerCategory >= 2) setMaxPerCategory(parsed.maxPerCategory);

        setRules((prev) => ({
          allAtLeastOne: typeof parsed.allAtLeastOne === 'boolean' ? parsed.allAtLeastOne : prev.allAtLeastOne,
          evenDistribution: typeof parsed.evenDistribution === 'boolean' ? parsed.evenDistribution : prev.evenDistribution,
          beautyFirst: typeof parsed.beautyFirst === 'boolean' ? parsed.beautyFirst : prev.beautyFirst,
          maxProfitFocus: typeof parsed.maxProfitFocus === 'boolean' ? parsed.maxProfitFocus : prev.maxProfitFocus,
          safe90Mode: typeof parsed.safe90Mode === 'boolean' ? parsed.safe90Mode : prev.safe90Mode
        }));

        if (Array.isArray(parsed.categoryUpdates) && parsed.categoryUpdates.length > 0) {
          parsed.categoryUpdates.forEach((u) => {
            if (!u.name) return;
            setCategories((prev) => {
              const exists = prev.some(
                (c) =>
                  c.name.toLowerCase().includes(u.name.toLowerCase()) ||
                  (c.shortName && c.shortName.toLowerCase() === u.name.toLowerCase())
              );
              if (exists) {
                return prev.map((c) =>
                  c.name.toLowerCase().includes(u.name.toLowerCase()) ||
                  (c.shortName && c.shortName.toLowerCase() === u.name.toLowerCase())
                    ? {
                        ...c,
                        cost: u.cost > 0 ? u.cost : c.cost,
                        price: u.price > 0 ? u.price : c.price,
                        beauty: u.beauty > 0 ? Math.min(10, u.beauty) : c.beauty
                      }
                    : c
                );
              } else if (u.isNewBangleCategory) {
                const style = EXTRA_COLORS[prev.length % EXTRA_COLORS.length];
                return [
                  ...prev,
                  {
                    id: `cat_${Date.now()}_${Math.random()}`,
                    name: u.name,
                    shortName: u.name,
                    cost: u.cost || 150,
                    price: u.price || 349,
                    beauty: u.beauty || 8.0,
                    ...style
                  }
                ];
              }
              return prev;
            });
          });
        }

        if (Array.isArray(parsed.stallStockAdditions) && parsed.stallStockAdditions.length > 0) {
          setStallStock((prev) => [
            ...prev,
            ...parsed.stallStockAdditions.map((s, idx) => ({
              id: `ai_s_${Date.now()}_${idx}`,
              name: s.name || 'New Jewellery Item',
              category: s.category || 'Jewellery',
              cost: s.cost || 80,
              price: s.price || 249,
              qty: s.qty || 20,
              sellThrough: s.sellThrough || 85,
              isSyncedBundle: false
            }))
          ]);
        }

        setAiFeedback(parsed.summaryMessage || `AI updated your stall parameters (${localChanges.join(', ') || 'applied'}).`);
      }
    } catch (err) {
      setAiFeedback(
        localChanges.length > 0
          ? `Applied: ${localChanges.join(' • ')}`
          : `Processed your request with smart rule optimization.`
      );
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  // Total Stall Calculator Analytics
  const stallTotals = useMemo(() => {
    let totalCost = 0;
    let rev100 = 0;
    let revRealistic = 0;
    let totalUnits = 0;

    const itemRows = stallStock.map((item) => {
      const lineCost = item.cost * item.qty;
      const lineRev100 = item.price * item.qty;
      const lineProfit100 = lineRev100 - lineCost;
      const lineRevReal = Math.round(lineRev100 * (item.sellThrough / 100));
      const lineProfitReal = lineRevReal - lineCost;
      const roiPct = lineCost > 0 ? Number(((lineProfit100 / lineCost) * 100).toFixed(1)) : 0;
      const unitsCount = item.isSyncedBundle ? item.unitPieces || 17 : item.qty;

      totalCost += lineCost;
      rev100 += lineRev100;
      revRealistic += lineRevReal;
      totalUnits += unitsCount;

      return {
        ...item,
        lineCost,
        lineRev100,
        lineProfit100,
        lineRevReal,
        lineProfitReal,
        roiPct,
        unitsCount
      };
    });

    const grossProfit100 = rev100 - totalCost;
    const grossProfitReal = revRealistic - totalCost;
    const netAfterStall100 = grossProfit100 - stallFee;
    const netAfterStallReal = grossProfitReal - stallFee;
    const totalOutlay = totalCost + stallFee;
    const breakEvenCoveragePct = Math.min(100, Math.max(0, Math.round((revRealistic / Math.max(1, totalOutlay)) * 100)));
    const avgRevenuePerUnit = totalUnits > 0 ? Math.round(rev100 / totalUnits) : 220;
    const unitsToBreakEven = Math.min(totalUnits, Math.ceil(totalOutlay / Math.max(1, avgRevenuePerUnit)));
    const footfallConversionNeeded = Number(((unitsToBreakEven / 10000) * 100).toFixed(2));

    return {
      itemRows,
      totalCost,
      totalOutlay,
      rev100,
      revRealistic,
      grossProfit100,
      grossProfitReal,
      netAfterStall100,
      netAfterStallReal,
      totalUnits,
      breakEvenCoveragePct,
      unitsToBreakEven,
      footfallConversionNeeded
    };
  }, [stallStock, stallFee]);

  const applyGlobalSellThrough = (pct) => {
    setGlobalSellThrough(pct);
    setStallStock((prev) => prev.map((item) => ({ ...item, sellThrough: pct })));
  };

  const updateStockItem = (id, field, val) => {
    setStallStock((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === 'name' || field === 'category' ? val : Math.max(0, Number(val) || 0)
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
        name: `New Stall Item ${prev.length}`,
        category: 'Accessories',
        cost: 75,
        price: 229,
        qty: 20,
        sellThrough: 85,
        isSyncedBundle: false
      }
    ]);
  };

  const removeStockItem = (id) => {
    setStallStock((prev) => prev.filter((i) => i.id !== id));
  };

  const runAiCfoAudit = async () => {
    setAiAuditLoading(true);
    try {
      const sysPrompt = `You are a sharp retail exhibition CFO advising a jewellery stall owner at Grand Casa, Siliguri (10,000 footfall, ₹${stallFee} stall fee).
Give 3 ultra-specific, bulleted profit-boosting recommendations based on their exact inventory numbers. Keep it under 90 words, punchy and actionable.`;
      const userPrompt = `Inventory: ${JSON.stringify(
        stallTotals.itemRows.map((r) => ({
          name: r.name,
          cost: r.cost,
          sell: r.price,
          qty: r.qty,
          sellThroughPct: r.sellThrough,
          lineProfitReal: r.lineProfitReal
        }))
      )}. Total Inventory Cost: ₹${stallTotals.totalCost}, Stall Fee: ₹${stallFee}, Realistic Net Take-Home Profit After Stall Fee: ₹${stallTotals.netAfterStallReal}.`;

      const text = await callGeminiTextAPI(sysPrompt, userPrompt);
      setAiAuditReport(text);
    } catch (err) {
      setAiAuditReport(
        `• High-Margin Anchor: Your earrings & rings deliver 200%+ ROI—place a ₹149–₹199 bowl right at the front edge to stop 10,000 walkers.\n• Bundle Bangles + Rings: Offer "Any ₹449 Resin Bangle + ₹179 Ring for ₹549" to raise average bill value above ₹500.\n• Break-Even Safety: You only need ${stallTotals.unitsToBreakEven} pieces sold (${stallTotals.footfallConversionNeeded}% of Grand Casa footfall) to recover your entire ₹${stallTotals.totalOutlay.toLocaleString('en-IN')} outlay!`
      );
    } finally {
      setAiAuditLoading(false);
    }
  };

  const handleGenerateStrategy = async () => {
    if (!strategyPrompt.trim()) return;
    setStrategyLoading(true);
    try {
      const sysPrompt = `You are an expert Indian exhibition jewellery merchandiser for Grand Casa, Siliguri. Provide a concise, high-converting 3-point selling script & pricing tactic for the user's question (under 90 words).`;
      const res = await callGeminiTextAPI(sysPrompt, strategyPrompt);
      setStrategyResponse(res);
    } catch (e) {
      setStrategyResponse(
        `1. The Visual Hook: Place your 2 White & 4 Colours Resin Bangles on an elevated velvet cone under warm LED light.\n2. The Stack Pitch: Hand the customer a matte Wooden bangle (₹249) alongside a glossy Colours bangle (₹449) and offer the pair at ₹599.\n3. The ₹50 Buffer Close: Tag ₹50 higher so when Siliguri shoppers ask for a discount, you happily drop ₹50 and protect 100% of your target profit.`
      );
    } finally {
      setStrategyLoading(false);
    }
  };

  const handleGenerateVisualMockup = async (customTheme) => {
    setImageLoading(true);
    try {
      const prompt =
        customTheme ||
        'A luxury aesthetic pop-up jewellery exhibition stall tabletop display in India featuring glossy colourful resin bangles, white statement bangles on velvet cones, wooden bangles, and warm golden fairy lights, photorealistic retail merchandising';
      const url = await callGeminiImageAPI(prompt);
      setGeneratedImageUrl(url);
    } catch (e) {
      setGeneratedImageUrl(null);
    } finally {
      setImageLoading(false);
    }
  };

  const displayedProfit = (combo) => (rules.safe90Mode ? combo.prof90 : combo.prof100);
  const displayedRevenue = (combo) => (rules.safe90Mode ? combo.rev90 : combo.rev100);
  const stallCoveragePct = activeCombo
    ? Math.min(100, Math.max(0, Math.round((displayedProfit(activeCombo) / Math.max(1, stallFee)) * 100)))
    : 0;

  const STALL_ZONES = {
    front_left: {
      title: 'Zone 1: Front-Left Eye-Catcher (White & Colours Resin)',
      subtitle: 'Elevated velvet cones + warm golden spotlight right at aisle entry',
      items: '1–2 White Resin (₹499) + 4–6 Colours Resin (₹449)',
      why: 'Stops Grand Casa walkers from 8 feet away. High-beauty statement resin pieces create an instant boutique magnet.'
    },
    center_tray: {
      title: 'Zone 2: Center Impulse Tray (₹149–₹249 Studs, Rings & Wooden Stackers)',
      subtitle: 'Open velvet organizer bowls at waist height for zero-hesitation picking',
      items: 'Korean Studs (₹149), Anti-Tarnish Rings (₹179) & Wooden Bangles (₹249)',
      why: 'Generates rapid cash flow with 200%+ markups to pay off your ₹9,000 Grand Casa stall fee quickly.'
    },
    right_mirror: {
      title: 'Zone 3: Right Try-On Mirror Station (Cuffs & Yellow Festive)',
      subtitle: 'Angled tabletop mirror + open wrist tray for instant slip-on testing',
      items: '4–6 Cuff Bangles (₹349) + 4–5 Yellow Resin (₹399)',
      why: '80% of right-handed shoppers gravitate here. Once they see a Cuff on their wrist in the mirror, conversion exceeds 70%.'
    },
    back_riser: {
      title: 'Zone 4: Back Vertical Riser (Necklaces & ₹599 Stack Bundles)',
      subtitle: 'Eye-level vertical display stands + bold "Any Resin + Wood = ₹599" sign',
      items: 'Dainty Neck Chains (₹299) + Bangle & Ring Combo Boxes (₹349)',
      why: 'Increases average order value from ₹349 to ₹599+ by pitching curated wrist-and-neck combinations.'
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-14 selection:bg-amber-500/30">
      {/* 1. CLEAN STICKY HEADER: BRAND, 3 TABS, QUICK INPUTS & PRICES TOGGLE */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/95 border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">StallIQ Pro</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Grand Casa • Siliguri
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                AI Jewellery Stall Command Center • 10,000 Footfall
              </p>
            </div>
          </div>

          {/* 3 Navigation Tabs */}
          <nav className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            {[
              { id: 'optimizer', label: '1. Bangle Mix Optimizer', icon: Layers },
              { id: 'calculator', label: '2. Total Stall Calculator', icon: Calculator },
              { id: 'strategies', label: '3. Selling Playbook & Visuals', icon: Lightbulb }
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    active
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Inputs (Budget / Min Profit / Stall Fee) + Prices & ★ Drawer Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px]">
              <span className="text-slate-400 font-bold">Budget ₹</span>
              <input
                type="number"
                value={budgetCap}
                onChange={(e) => setBudgetCap(Math.max(500, Number(e.target.value) || 0))}
                className="w-14 bg-transparent font-black text-amber-300 focus:outline-none"
              />
              <span className="text-slate-700">|</span>
              <span className="text-slate-400 font-bold">Min Profit ₹</span>
              <input
                type="number"
                value={minProfitFloor}
                onChange={(e) => setMinProfitFloor(Math.max(500, Number(e.target.value) || 0))}
                className="w-14 bg-transparent font-black text-emerald-400 focus:outline-none"
              />
              <span className="text-slate-700">|</span>
              <span className="text-slate-400 font-bold">Stall Fee ₹</span>
              <input
                type="number"
                value={stallFee}
                onChange={(e) => setStallFee(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 bg-transparent font-black text-rose-300 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setShowItemEditor(!showItemEditor)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                showItemEditor
                  ? 'bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Prices & ★</span>
              {showItemEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={resetAll}
              title="Reset to Defaults"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-4 space-y-4">
        {/* ALWAYS-ON SMART AI COMMAND BAR */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-3 shadow-lg">
          <form onSubmit={handleSmartAiSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-wider shrink-0 px-1">
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span>AI Command Bar</span>
            </div>

            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder='Tell AI any custom rule or stock update (e.g. "Max 5 Cuff, Min 2 Colours, Budget 3000" or "Add Nose Pins cost 30 sell 99 qty 30")...'
              className="flex-1 bg-slate-950/90 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={aiLoading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition-all shrink-0"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{aiLoading ? 'Updating...' : 'Apply with AI'}</span>
            </button>
          </form>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-indigo-200/90">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{aiFeedback}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                'Max 5 Cuff, Min 2 Colours, Budget 3000',
                'White cost 250 sell 499, add Nose Pins cost 30 sell 99 qty 30',
                'Even beauty spread, all 6 types included'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAiInput(chip)}
                  className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-slate-800 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* COLLAPSIBLE COMPACT ITEM EDITOR STRIP */}
        {showItemEditor && (
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                Bangle Categories • Wholesale Cost • Sell Price • Beauty ★
              </span>
              <button
                onClick={() => addCat()}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
              >
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.barColor }}
                      />
                      <input
                        type="text"
                        value={cat.name}
                        onChange={(e) => updateCat(cat.id, 'name', e.target.value)}
                        className="bg-transparent text-xs font-bold text-white w-full truncate focus:outline-none"
                      />
                    </div>
                    {categories.length > 2 && (
                      <button
                        onClick={() => removeCat(cat.id)}
                        className="text-slate-600 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-slate-900 rounded-lg px-2 py-1">
                      <div className="text-[9px] text-slate-500">COST</div>
                      <div className="font-bold text-slate-200 flex items-center">
                        ₹
                        <input
                          type="number"
                          value={cat.cost}
                          onChange={(e) => updateCat(cat.id, 'cost', e.target.value)}
                          className="w-full bg-transparent focus:outline-none ml-0.5"
                        />
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg px-2 py-1">
                      <div className="text-[9px] text-slate-500">SELL</div>
                      <div className="font-bold text-amber-300 flex items-center">
                        ₹
                        <input
                          type="number"
                          value={cat.price}
                          onChange={(e) => updateCat(cat.id, 'price', e.target.value)}
                          className="w-full bg-transparent focus:outline-none ml-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400" /> {cat.beauty}
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={cat.beauty}
                      onChange={(e) => updateCat(cat.id, 'beauty', e.target.value)}
                      className="w-20 h-1 bg-slate-800 rounded-lg accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* TAB 1: BANGLE MIX OPTIMIZER (15 SMART COMBINATIONS)                   */}
        {/* ===================================================================== */}
        {activeTab === 'optimizer' && (
          <div className="space-y-4">
            {/* Compact Sliders + Filter Pills Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'allAtLeastOne', label: 'All 6 Included', icon: Layers },
                  { key: 'evenDistribution', label: `Even Spread (Max ${maxPerCategory})`, icon: Scale },
                  { key: 'beautyFirst', label: 'High Beauty ★', icon: Crown },
                  { key: 'maxProfitFocus', label: 'Max Profit ₹', icon: TrendingUp },
                  { key: 'safe90Mode', label: '90% Sold Safe', icon: ShieldCheck }
                ].map((pill) => {
                  const Icon = pill.icon;
                  const active = rules[pill.key];
                  return (
                    <button
                      key={pill.key}
                      onClick={() => toggleRule(pill.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/15'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {active ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">Budget:</span>
                  <span className="font-black text-amber-400">₹{budgetCap}</span>
                  <input
                    type="range"
                    min={1500}
                    max={8000}
                    step={50}
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(Number(e.target.value))}
                    className="w-20 h-1.5 bg-slate-800 rounded-lg accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">Min Profit:</span>
                  <span className="font-black text-emerald-400">₹{minProfitFloor}</span>
                  <input
                    type="range"
                    min={1000}
                    max={6000}
                    step={50}
                    value={minProfitFloor}
                    onChange={(e) => setMinProfitFloor(Number(e.target.value))}
                    className="w-20 h-1.5 bg-slate-800 rounded-lg accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* HERO SELECTED MIX INSPECTOR */}
            {activeCombo && (
              <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25 border-2 border-amber-400/50 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl text-sm font-black bg-amber-400 text-slate-950">
                      {activeCombo.label}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${activeCombo.badgeColor}`}>
                      {activeCombo.badge}
                    </span>
                    {activeCombo.isCustom && (
                      <button
                        onClick={() => setCustomQuantities(null)}
                        className="text-xs font-bold text-amber-300 underline ml-1"
                      >
                        Reset Tweak
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyOrder}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Mix'}</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('calculator')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md"
                    >
                      <span>Open in Total Stall Calculator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 5 SCANNABLE METRIC TILES */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Bangle Cost</div>
                    <div className={`text-2xl font-black mt-0.5 ${activeCombo.cost > budgetCap ? 'text-rose-400' : 'text-white'}`}>
                      ₹{activeCombo.cost.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500">Cap: ₹{budgetCap}</div>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Revenue ({rules.safe90Mode ? '90%' : '100%'})
                    </div>
                    <div className="text-2xl font-black text-slate-100 mt-0.5">
                      ₹{displayedRevenue(activeCombo).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500">{activeCombo.pieces} Total Pieces</div>
                  </div>

                  <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">
                      Net Profit ({rules.safe90Mode ? '90%' : '100%'})
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      +₹{displayedProfit(activeCombo).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {rules.safe90Mode ? `100%: +₹${activeCombo.prof100}` : `90%: +₹${activeCombo.prof90}`}
                    </div>
                  </div>

                  <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase text-amber-300">Beauty Score</div>
                    <div className="text-2xl font-black text-amber-300 mt-0.5 flex items-baseline gap-1.5">
                      <span>{activeCombo.avgBeauty} ★</span>
                      <span className="text-xs font-bold text-slate-400">({activeCombo.pieces} pcs)</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Weighted Appeal</div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">₹{stallFee} Stall Covered</span>
                      <span className="text-emerald-400 font-black">{stallCoveragePct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden my-1.5">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${stallCoveragePct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Remaining Gap: ₹{Math.max(0, stallFee - displayedProfit(activeCombo)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* LIVE + / - QUANTITY TWEAKER PILLS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {categories.map((cat, idx) => {
                    const qty = activeCombo.counts[idx] || 0;
                    return (
                      <div
                        key={cat.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-2xl border ${cat.bgClass}`}
                      >
                        <div className="min-w-0">
                          <div className={`text-xs font-black truncate ${cat.textClass}`}>{cat.name}</div>
                          <div className="text-[10px] text-slate-400">₹{cat.cost}→₹{cat.price}</div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => stepQty(idx, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700/60"
                          >
                            −
                          </button>
                          <span className="text-base font-black text-white w-5 text-center">{qty}</span>
                          <button
                            onClick={() => stepQty(idx, 1)}
                            className="w-6 h-6 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-amber-300 font-bold text-xs flex items-center justify-center border border-slate-700/60"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* VISUAL COMPARISON BAR CHART */}
            {generatedCombos.length > 0 && (
              <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    15 Smart Bangle Mixes — Net Profit Comparison (Click Any Bar)
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    Profit Floor: ₹{minProfitFloor.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={generatedCombos}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 0, bottom: 0 }}
                      onClick={(s) => {
                        if (s?.activePayload?.[0]) {
                          setSelectedComboId(s.activePayload[0].payload.id);
                          setCustomQuantities(null);
                        }
                      }}
                    >
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={11}
                        width={36}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs shadow-xl space-y-1">
                              <div className="font-black text-amber-300">
                                {d.label} • {d.badge}
                              </div>
                              <div className="text-emerald-400 font-bold">
                                Net Profit: +₹{displayedProfit(d).toLocaleString('en-IN')}
                              </div>
                              <div className="text-slate-300">
                                Cost: ₹{d.cost} ({d.pieces} pcs) • {d.avgBeauty} ★
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine x={minProfitFloor} stroke="#10b981" strokeDasharray="3 3" />
                      <Bar
                        dataKey={rules.safe90Mode ? 'prof90' : 'prof100'}
                        radius={[0, 6, 6, 0]}
                        cursor="pointer"
                      >
                        {generatedCombos.map((entry) => {
                          const active = activeCombo?.id === entry.id;
                          return (
                            <Cell
                              key={entry.id}
                              fill={active ? '#fbbf24' : '#10b981'}
                              fillOpacity={active ? 1 : 0.6}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* 15 COMPACT VISUAL OPTION CARDS */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {generatedCombos.map((combo) => {
                const isSelected = activeCombo?.id === combo.id;
                const profitVal = displayedProfit(combo);
                return (
                  <div
                    key={combo.id}
                    onClick={() => {
                      setSelectedComboId(combo.id);
                      setCustomQuantities(null);
                    }}
                    className={`cursor-pointer rounded-2xl p-4 transition-all border flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/30 shadow-xl'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {combo.label}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${combo.badgeColor}`}>
                          {combo.badge}
                        </span>
                      </div>

                      <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {combo.avgBeauty}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Net Profit {rules.safe90Mode ? '(90%)' : ''}
                        </div>
                        <div className="text-2xl font-black text-emerald-400">
                          +₹{profitVal.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Cost • {combo.pieces} Pcs
                        </div>
                        <div className="text-base font-extrabold text-white">
                          ₹{combo.cost.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-950 gap-0.5 p-0.5 border border-slate-800">
                      {categories.map((cat, idx) => {
                        const q = combo.counts[idx] || 0;
                        if (!q) return null;
                        return (
                          <div
                            key={cat.id}
                            style={{
                              width: `${(q / combo.pieces) * 100}%`,
                              backgroundColor: cat.barColor
                            }}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat, idx) => {
                        const q = combo.counts[idx] || 0;
                        if (!q) return null;
                        return (
                          <span
                            key={cat.id}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${cat.bgClass} ${cat.textClass}`}
                          >
                            {q} {cat.shortName || cat.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: TOTAL STALL FINAL CALCULATOR (MASTER INVENTORY & CFO ENGINE)   */}
        {/* ===================================================================== */}
        {activeTab === 'calculator' && (
          <div className="space-y-5">
            {/* Master Financial Dashboard (4 Core CFO Cards + Break-Even Progress) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4">
                <div className="text-[11px] font-bold uppercase text-rose-300">
                  1. Total Capital Outlay
                </div>
                <div className="text-3xl font-black text-white mt-1">
                  ₹{stallTotals.totalOutlay.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ₹{stallTotals.totalCost.toLocaleString('en-IN')} Stock + ₹{stallFee.toLocaleString('en-IN')} Stall Fee
                </div>
              </div>

              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-cyan-300">
                    2. Projected Gross Revenue
                  </span>
                  <span className="text-xs font-black text-cyan-300">{globalSellThrough}% Sold</span>
                </div>
                <div className="text-3xl font-black text-cyan-300 mt-1">
                  ₹{stallTotals.revRealistic.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-slate-400">Sell-Through:</span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={globalSellThrough}
                    onChange={(e) => applyGlobalSellThrough(Number(e.target.value))}
                    className="w-24 h-1.5 bg-slate-800 rounded-lg accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400">100%: ₹{stallTotals.rev100.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-lg shadow-emerald-500/10">
                <div className="text-[11px] font-bold uppercase text-emerald-400">
                  3. Net Take-Home Profit
                </div>
                <div className={`text-3xl font-black mt-1 ${stallTotals.netAfterStallReal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stallTotals.netAfterStallReal >= 0 ? '+' : ''}₹{stallTotals.netAfterStallReal.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Pure Profit <strong className="text-emerald-300">AFTER</strong> Stock & ₹{stallFee.toLocaleString('en-IN')} Stall Paid
                </div>
              </div>

              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4">
                <div className="text-[11px] font-bold uppercase text-amber-300">
                  4. Break-Even & Crowd Target
                </div>
                <div className="text-3xl font-black text-white mt-1">
                  {stallTotals.unitsToBreakEven} <span className="text-sm font-bold text-slate-400">/ {stallTotals.totalUnits} pcs</span>
                </div>
                <div className="text-xs text-emerald-400 font-bold mt-1">
                  Only {stallTotals.footfallConversionNeeded}% of 10,000 Footfall Needed!
                </div>
              </div>
            </section>

            {/* Full Stall Inventory Table + AI CFO Audit Button */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Total Stall Inventory & Profit Table (Synced with Bangle Mix {activeCombo?.label})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Edit cost, selling price, quantity, or expected sell-through % for your entire Grand Casa stall.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={addBlankStockItem}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Stock Item
                  </button>

                  <button
                    onClick={runAiCfoAudit}
                    disabled={aiAuditLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black text-xs shadow-lg"
                  >
                    {aiAuditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>AI Stall CFO Audit</span>
                  </button>
                </div>
              </div>

              {aiAuditReport && (
                <div className="bg-indigo-950/50 border border-indigo-500/40 rounded-2xl p-3.5 text-xs text-indigo-100 whitespace-pre-line leading-relaxed">
                  <div className="font-black text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> AI Stall CFO Profit Recommendations
                  </div>
                  {aiAuditReport}
                </div>
              )}

              {/* Interactive Stock Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400">
                      <th className="py-2.5 px-2">Item / Category</th>
                      <th className="py-2.5 px-2">Cost (₹)</th>
                      <th className="py-2.5 px-2">Sell Price (₹)</th>
                      <th className="py-2.5 px-2">Qty</th>
                      <th className="py-2.5 px-2">Sell-Through %</th>
                      <th className="py-2.5 px-2">Total Cost</th>
                      <th className="py-2.5 px-2">Realistic Rev</th>
                      <th className="py-2.5 px-2">Realistic Profit</th>
                      <th className="py-2.5 px-2">ROI %</th>
                      <th className="py-2.5 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {stallTotals.itemRows.map((row) => (
                      <tr
                        key={row.id}
                        className={row.isSyncedBundle ? 'bg-amber-500/10' : 'hover:bg-slate-950/60'}
                      >
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={row.name}
                            disabled={row.isSyncedBundle}
                            onChange={(e) => updateStockItem(row.id, 'name', e.target.value)}
                            className="bg-transparent font-bold text-white focus:outline-none w-full min-w-[170px]"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            value={row.cost}
                            disabled={row.isSyncedBundle}
                            onChange={(e) => updateStockItem(row.id, 'cost', e.target.value)}
                            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 font-bold text-slate-200"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            value={row.price}
                            disabled={row.isSyncedBundle}
                            onChange={(e) => updateStockItem(row.id, 'price', e.target.value)}
                            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 font-bold text-amber-300"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            value={row.qty}
                            disabled={row.isSyncedBundle}
                            onChange={(e) => updateStockItem(row.id, 'qty', e.target.value)}
                            className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 font-bold text-white"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="range"
                              min={40}
                              max={100}
                              step={5}
                              value={row.sellThrough}
                              onChange={(e) => updateStockItem(row.id, 'sellThrough', e.target.value)}
                              className="w-16 h-1 bg-slate-800 rounded-lg accent-emerald-400 cursor-pointer"
                            />
                            <span className="font-bold text-slate-300 w-9">{row.sellThrough}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-slate-300">
                          ₹{row.lineCost.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-cyan-300">
                          ₹{row.lineRevReal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 font-black text-emerald-400">
                          +₹{row.lineProfitReal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold text-[11px]">
                            {row.roiPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {!row.isSyncedBundle && (
                            <button
                              onClick={() => removeStockItem(row.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Visual Profit Breakdown Bar Chart across Stock Categories */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                Category Cost vs. Realistic Revenue Breakdown
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stallTotals.itemRows}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Bar dataKey="lineCost" name="Wholesale Cost (₹)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="lineRevReal" name="Realistic Revenue (₹)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: SELLING PLAYBOOK & VISUALS (6FT TABLE, PLAYBOOKS & YOUTUBE)    */}
        {/* ===================================================================== */}
        {activeTab === 'strategies' && (
          <div className="space-y-5">
            {/* 1. INTERACTIVE 6FT GRAND CASA STALL TABLE BLUEPRINT (4 CLICKABLE ZONES) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Interactive 6ft Grand Casa Stall Table Blueprint (Click Any of the 4 Zones)
                  </span>
                  <span className="text-[11px] text-slate-400">10,000 Footfall Conversion Layout</span>
                </div>

                {/* Interactive SVG 4-Zone Stall Map */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <svg viewBox="0 0 600 280" className="w-full h-auto select-none">
                    <rect x="20" y="20" width="560" height="205" rx="18" fill="#0f172a" stroke="#334155" strokeWidth="3" />

                    {/* Zone 4: Back Vertical Riser */}
                    <g
                      onClick={() => setSelectedZone('back_riser')}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <rect
                        x="35"
                        y="32"
                        width="530"
                        height="68"
                        rx="12"
                        fill={selectedZone === 'back_riser' ? '#10b981' : '#1e293b'}
                        fillOpacity={selectedZone === 'back_riser' ? '0.25' : '0.9'}
                        stroke="#34d399"
                        strokeWidth={selectedZone === 'back_riser' ? '3' : '1.5'}
                      />
                      <text x="300" y="60" textAnchor="middle" fill="#a7f3d0" fontSize="13" fontWeight="bold">
                        ZONE 4: BACK VERTICAL RISER (NECKLACES & ₹599 STACK BUNDLES)
                      </text>
                      <text x="300" y="80" textAnchor="middle" fill="#f8fafc" fontSize="11">
                        Dainty Chains (₹299) • Bangle + Ring Combo Boxes (₹349) • "Any Resin + Wood = ₹599" Sign
                      </text>
                    </g>

                    {/* Zone 1: Front-Left Eye-Catcher */}
                    <g
                      onClick={() => setSelectedZone('front_left')}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <rect
                        x="35"
                        y="112"
                        width="170"
                        height="98"
                        rx="12"
                        fill={selectedZone === 'front_left' ? '#ec4899' : '#1e293b'}
                        fillOpacity={selectedZone === 'front_left' ? '0.25' : '0.9'}
                        stroke="#f472b6"
                        strokeWidth={selectedZone === 'front_left' ? '3' : '1.5'}
                      />
                      <text x="120" y="142" textAnchor="middle" fill="#fbcfe8" fontSize="12" fontWeight="bold">
                        ZONE 1: FRONT-LEFT
                      </text>
                      <text x="120" y="160" textAnchor="middle" fill="#fbcfe8" fontSize="11" fontWeight="bold">
                        EYE-CATCHER CONES
                      </text>
                      <text x="120" y="182" textAnchor="middle" fill="#f8fafc" fontSize="10">
                        White (₹499) & Colours (₹449)
                      </text>
                    </g>

                    {/* Zone 2: Center Impulse Tray */}
                    <g
                      onClick={() => setSelectedZone('center_tray')}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <rect
                        x="215"
                        y="112"
                        width="170"
                        height="98"
                        rx="12"
                        fill={selectedZone === 'center_tray' ? '#f59e0b' : '#1e293b'}
                        fillOpacity={selectedZone === 'center_tray' ? '0.25' : '0.9'}
                        stroke="#fbbf24"
                        strokeWidth={selectedZone === 'center_tray' ? '3' : '1.5'}
                      />
                      <text x="300" y="142" textAnchor="middle" fill="#fde68a" fontSize="12" fontWeight="bold">
                        ZONE 2: CENTER
                      </text>
                      <text x="300" y="160" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="bold">
                        ₹149–₹249 IMPULSE TRAY
                      </text>
                      <text x="300" y="182" textAnchor="middle" fill="#f8fafc" fontSize="10">
                        Studs, Rings & Wooden (₹249)
                      </text>
                    </g>

                    {/* Zone 3: Right Try-On Mirror Station */}
                    <g
                      onClick={() => setSelectedZone('right_mirror')}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <rect
                        x="395"
                        y="112"
                        width="170"
                        height="98"
                        rx="12"
                        fill={selectedZone === 'right_mirror' ? '#8b5cf6' : '#1e293b'}
                        fillOpacity={selectedZone === 'right_mirror' ? '0.25' : '0.9'}
                        stroke="#c084fc"
                        strokeWidth={selectedZone === 'right_mirror' ? '3' : '1.5'}
                      />
                      <text x="480" y="142" textAnchor="middle" fill="#e9d5ff" fontSize="12" fontWeight="bold">
                        ZONE 3: RIGHT MIRROR
                      </text>
                      <text x="480" y="160" textAnchor="middle" fill="#e9d5ff" fontSize="11" fontWeight="bold">
                        TRY-ON STATION
                      </text>
                      <text x="480" y="182" textAnchor="middle" fill="#f8fafc" fontSize="10">
                        Cuffs (₹349) & Yellow (₹399)
                      </text>
                    </g>

                    <text x="300" y="255" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
                      ← GRAND CASA 10,000 SHOPPER WALKWAY AISLE →
                    </text>
                  </svg>
                </div>
              </div>

              {/* Selected Zone Details Inspector */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-2.5 h-full flex flex-col justify-center">
                  <div className="text-xs font-black uppercase text-amber-400">
                    {STALL_ZONES[selectedZone]?.title || STALL_ZONES.front_left.title}
                  </div>
                  <div className="text-xs font-bold text-slate-300">
                    {STALL_ZONES[selectedZone]?.subtitle || STALL_ZONES.front_left.subtitle}
                  </div>
                  <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-emerald-300 font-bold">
                    Exact Stock: {STALL_ZONES[selectedZone]?.items || STALL_ZONES.front_left.items}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {STALL_ZONES[selectedZone]?.why || STALL_ZONES.front_left.why}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. 4 BATTLE-TESTED EXHIBITION SELLING PLAYBOOK CARDS */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {PLAYBOOK_CARDS.map((card) => (
                <div
                  key={card.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${card.color}`}>
                        {card.badge}
                      </span>
                      <span className="text-[11px] font-extrabold text-emerald-400">{card.metric}</span>
                    </div>
                    <h3 className="text-sm font-black text-white">{card.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* 3. AI VISUAL MOCKUP & CUSTOM STRATEGY GENERATOR */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Custom Strategy Advisor */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Ask AI Sales & Pitch Strategist
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={strategyPrompt}
                    onChange={(e) => setStrategyPrompt(e.target.value)}
                    placeholder="Ask e.g. 'How do I clear unsold bangles in the last 3 hours at Grand Casa?'"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    onClick={handleGenerateStrategy}
                    disabled={strategyLoading}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shrink-0"
                  >
                    {strategyLoading ? 'Thinking...' : 'Get Pitch'}
                  </button>
                </div>
                {strategyResponse && (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {strategyResponse}
                  </div>
                )}
              </div>

              {/* AI Stall Display Image Generator */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> AI Stall Display Visual Generator
                  </span>
                  <button
                    onClick={() => handleGenerateVisualMockup()}
                    disabled={imageLoading}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5"
                  >
                    {imageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>{imageLoading ? 'Rendering Stall...' : 'Generate AI Stall Concept'}</span>
                  </button>
                </div>

                {generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt="AI Generated Stall Mockup"
                    className="w-full h-44 object-cover rounded-2xl border border-slate-800"
                  />
                ) : (
                  <div className="h-36 rounded-2xl bg-slate-950 border border-dashed border-slate-800 flex flex-col items-center justify-center text-xs text-slate-500 p-4 text-center">
                    <span>Click "Generate AI Stall Concept" to render a photorealistic resin & wooden bangle table setup for Grand Casa.</span>
                  </div>
                )}
              </div>
            </section>

            {/* 3. CURATED YOUTUBE EXHIBITION & JEWELLERY STALL VIDEO GUIDES */}
            <section className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Youtube className="w-4 h-4 text-rose-500" /> Curated YouTube Jewellery Stall & Pricing Playbooks
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {CURATED_VIDEOS.map((vid) => (
                  <a
                    key={vid.id}
                    href={vid.queryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`block bg-gradient-to-br ${vid.accent} border rounded-2xl p-4 hover:scale-[1.01] transition-all space-y-2.5`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black uppercase">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-amber-300">{vid.tag}</span>
                      <span className="text-slate-300 flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" /> {vid.duration}
                      </span>
                    </div>
                    <div className="text-sm font-black text-white leading-snug">{vid.title}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{vid.keyTakeaway}</p>
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1 pt-1">
                      <span>Watch on YouTube</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}