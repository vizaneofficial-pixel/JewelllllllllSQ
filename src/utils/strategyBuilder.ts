import type {
  CategoryGroupResolved,
  DailySalesTracker,
  LayoutPresetStyle,
  ProductBundleSuggestion,
  StallSetupPlan,
  StallType,
  ZoneId,
} from '../types/stall';
import { resolveItemPriceBounds } from './optimizer';

interface FlatProduct {
  id: string;
  name: string;
  categoryName: string;
  cost: number;
  price: number;
  profit: number;
  marginPct: number;
  appeal: number;
  qty: number;
}

function flattenActiveProducts(resolvedGroups: CategoryGroupResolved[]): FlatProduct[] {
  const list: FlatProduct[] = [];
  for (const rg of resolvedGroups) {
    rg.group.categories.forEach((cat, idx) => {
      const price = resolveItemPriceBounds(cat).target;
      const cost = Math.max(0, Number(cat.cost) || 0);
      const qty = rg.activeCombo?.counts[idx] ?? 0;
      const profit = price - cost;
      const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;
      list.push({
        id: cat.id,
        name: cat.name,
        categoryName: rg.group.name,
        cost,
        price,
        profit,
        marginPct,
        appeal: Number(cat.beauty) || 7,
        qty,
      });
    });
  }
  return list;
}

export interface PlacementAdviceItem {
  id: string;
  question: string;
  recommendation: string;
  items: string[];
  tag: string;
}

export function buildPlacementRecommendations(
  resolvedGroups: CategoryGroupResolved[],
  stallSetup: StallSetupPlan
): PlacementAdviceItem[] {
  const products = flattenActiveProducts(resolvedGroups);
  const stocked = products.filter((p) => p.qty > 0);
  const pool = stocked.length > 0 ? stocked : products;
  const totalPieces = stocked.reduce((s, p) => s + p.qty, 0);
  const areaSqFt = Math.max(1, stallSetup.widthFt * stallSetup.depthFt);
  const density = totalPieces / areaSqFt;

  if (pool.length === 0) {
    return [
      {
        id: 'empty',
        question: 'Add products to unlock layout advice',
        recommendation: 'Add items in Stock Planner so Stall Setup can assign eye-level, impulse, and premium zones from your real catalogue.',
        items: [],
        tag: 'Setup',
      },
    ];
  }

  const byAppeal = [...pool].sort((a, b) => b.appeal - a.appeal || b.price - a.price);
  const byPriceAsc = [...pool].sort((a, b) => a.price - b.price);
  const byPriceDesc = [...pool].sort((a, b) => b.price - a.price);
  const byProfitDesc = [...pool].sort((a, b) => b.profit - a.profit);

  const heroItems = byAppeal.slice(0, 2);
  const eyeLevelItems = byProfitDesc.slice(0, 3);
  const counterItems = byPriceAsc.slice(0, 2);
  const premiumItems = byPriceDesc.slice(0, 2);
  const categoryNames = resolvedGroups.map((rg) => rg.group.name);

  const crowdNote =
    density > 2.2
      ? `You have ${totalPieces} pcs across ${stallSetup.widthFt}×${stallSetup.depthFt} ft (${areaSqFt} sq ft) — display ~50% on table and keep rest in under-table storage to avoid clutter.`
      : density > 1.2
      ? `${totalPieces} pcs fits comfortably on a ${stallSetup.widthFt}×${stallSetup.depthFt} ft stall; use 2-tier risers and keep 30% open breathing space.`
      : `${totalPieces} pcs on ${stallSetup.widthFt}×${stallSetup.depthFt} ft gives generous gallery spacing — group in curated trios with clear price tents.`;

  return [
    {
      id: 'notice_first',
      question: 'What should customers notice first?',
      recommendation: `Place your highest-appeal items (${heroItems.map((i) => `${i.name} · ${i.appeal.toFixed(1)}★`).join(', ')}) at the outer front edge angled toward approaching foot traffic.`,
      items: heroItems.map((i) => i.name),
      tag: 'Front Hook',
    },
    {
      id: 'eye_level',
      question: 'Which products belong at eye level?',
      recommendation: `Elevate your strongest rupee-profit pieces (${eyeLevelItems.map((i) => `${i.name} +₹${Math.round(i.profit)}/pc`).join(', ')}) on back risers so shoppers spot them from 6–8 ft away.`,
      items: eyeLevelItems.map((i) => i.name),
      tag: 'Eye Level',
    },
    {
      id: 'counter_items',
      question: 'What goes near the payment counter?',
      recommendation: `Keep your most accessible add-ons (${counterItems.map((i) => `${i.name} ₹${Math.round(i.price)}`).join(', ')}) right beside the UPI QR stand for quick last-minute basket lifts.`,
      items: counterItems.map((i) => i.name),
      tag: 'Counter Add-On',
    },
    {
      id: 'group_together',
      question: 'Which products should be grouped together?',
      recommendation:
        categoryNames.length > 1
          ? `Create visual mini-stories pairing ${categoryNames[0]} with ${categoryNames[1]} side-by-side so shoppers naturally build matching sets.`
          : `Group ${categoryNames[0]} by colour/style gradient from entry (₹${Math.round(byPriceAsc[0].price)}) to hero (₹${Math.round(byPriceDesc[0].price)}) so comparison feels effortless.`,
      items: categoryNames.slice(0, 3),
      tag: 'Grouping',
    },
    {
      id: 'attract_attention',
      question: 'Which products pull passers-by in?',
      recommendation: `Use ${heroItems[0].name} (₹${Math.round(heroItems[0].price)}) under warm focused light plus one bold price card for ${counterItems[0].name} ("Starts at ₹${Math.round(counterItems[0].price)}") to stop foot traffic.`,
      items: [heroItems[0].name, counterItems[0].name],
      tag: 'Traffic Stopper',
    },
    {
      id: 'bundle_ready',
      question: 'Which items work best for bundles?',
      recommendation: `Pair a core piece like ${byAppeal[0].name} with an affordable companion like ${counterItems[0].name} on a shared tray labeled with a single combo price.`,
      items: [byAppeal[0].name, counterItems[0].name],
      tag: 'Bundles',
    },
    {
      id: 'premium_display',
      question: 'How should expensive items be displayed?',
      recommendation: `Showcase ${premiumItems.map((i) => `${i.name} (₹${Math.round(i.price)})`).join(' & ')} on lined risers or near the staff side—limit to 1–2 display units each and keep backups in storage.`,
      items: premiumItems.map((i) => i.name),
      tag: 'Premium Care',
    },
    {
      id: 'avoid_overcrowding',
      question: 'How to avoid looking overcrowded?',
      recommendation: crowdNote,
      items: [`${stallSetup.widthFt}×${stallSetup.depthFt} ft`, `${totalPieces} pcs`],
      tag: 'Density',
    },
  ];
}

export interface LayoutPresetDefinition {
  id: LayoutPresetStyle;
  name: string;
  summary: string;
  recommendedType: StallType;
  zoneMap: (categoryNames: string[]) => Partial<Record<ZoneId, string[]>>;
}

export const LAYOUT_PRESETS: LayoutPresetDefinition[] = [
  {
    id: 'classic_u',
    name: 'Classic U-Display',
    summary: 'Front hook left, impulse center, billing counter right, premium risers at back.',
    recommendedType: 'tabletop',
    zoneMap: (cats) => ({
      front_left: cats.slice(0, 1),
      center_tray: cats.slice(1, 2).length ? cats.slice(1, 2) : cats.slice(0, 1),
      right_mirror: cats.slice(2, 3).length ? cats.slice(2, 3) : cats.slice(-1),
      back_riser: cats.slice(0, 2),
    }),
  },
  {
    id: 'open_gallery',
    name: 'Open Browse Gallery',
    summary: 'Wide walk-in browse flow with hero showcases on both wings and elevated back wall.',
    recommendedType: 'corner_booth',
    zoneMap: (cats) => ({
      front_left: cats.slice(0, 2),
      center_tray: cats.slice(-1),
      right_mirror: cats.slice(1, 2).length ? cats.slice(1, 2) : cats.slice(0, 1),
      back_riser: cats,
    }),
  },
  {
    id: 'counter_focus',
    name: 'High-Traffic Counter',
    summary: 'Fast impulse tray front-and-center with quick billing & bundle upsells beside payment.',
    recommendedType: 'indoor_kiosk',
    zoneMap: (cats) => ({
      front_left: cats.slice(1, 2).length ? cats.slice(1, 2) : cats.slice(0, 1),
      center_tray: cats.slice(0, 2),
      right_mirror: cats.slice(0, 1),
      back_riser: cats.slice(-2),
    }),
  },
];

export function buildProductBundles(
  resolvedGroups: CategoryGroupResolved[],
  customDiscountPct?: number
): ProductBundleSuggestion[] {
  const products = flattenActiveProducts(resolvedGroups).filter(
    (p) => p.price > 0 && p.cost > 0
  );
  if (products.length < 2) return [];

  const byAppeal = [...products].sort((a, b) => b.appeal - a.appeal || b.profit - a.profit);
  const byPriceAsc = [...products].sort((a, b) => a.price - b.price);
  const byPriceDesc = [...products].sort((a, b) => b.price - a.price);

  const pairs: Array<{ id: string; title: string; a: FlatProduct; b: FlatProduct; reason: string }> = [];

  // 1. Hero + Entry Add-On (best all-round basket lift)
  const hero = byAppeal[0];
  const addon = byPriceAsc.find((p) => p.id !== hero.id) || byAppeal[1];
  if (hero && addon) {
    pairs.push({
      id: 'bundle_hero_addon',
      title: 'Hero + Quick Add-On Combo',
      a: hero,
      b: addon,
      reason: `Pairs your top-appeal draw (${hero.name}) with an easy ₹${Math.round(addon.price)} impulse add-on.`,
    });
  }

  // 2. Cross-category pairing (if multiple categories exist)
  if (resolvedGroups.length >= 2) {
    const catA = products
      .filter((p) => p.categoryName === resolvedGroups[0].group.name)
      .sort((a, b) => b.appeal - a.appeal)[0];
    const catB = products
      .filter((p) => p.categoryName === resolvedGroups[1].group.name)
      .sort((a, b) => b.profit - a.profit)[0];
    if (catA && catB && catA.id !== catB.id) {
      pairs.push({
        id: 'bundle_cross_cat',
        title: `${resolvedGroups[0].group.name} + ${resolvedGroups[1].group.name} Set`,
        a: catA,
        b: catB,
        reason: `Cross-sells across two categories to raise average order value without cutting core margin.`,
      });
    }
  }

  // 3. Value Pair (2 affordable fast-movers)
  if (byPriceAsc.length >= 2) {
    const p1 = byPriceAsc[0];
    const p2 = byPriceAsc[1];
    if (!pairs.some((x) => (x.a.id === p1.id && x.b.id === p2.id) || (x.a.id === p2.id && x.b.id === p1.id))) {
      pairs.push({
        id: 'bundle_value_duo',
        title: 'Pick-Any-2 Entry Deal',
        a: p1,
        b: p2,
        reason: `Lowers decision friction for browsing shoppers and speeds up unit velocity.`,
      });
    }
  }

  // 4. Premium Anchor Set
  if (byPriceDesc.length >= 2) {
    const top1 = byPriceDesc[0];
    const top2 = byPriceDesc.find((p) => p.id !== top1.id && p.id !== addon?.id) || byPriceDesc[1];
    if (top1 && top2 && !pairs.some((x) => x.a.id === top1.id && x.b.id === top2.id)) {
      pairs.push({
        id: 'bundle_premium',
        title: 'Statement Gift Set',
        a: top1,
        b: top2,
        reason: `Packages higher-ticket pieces as a ready gift set with strong rupee profit per sale.`,
      });
    }
  }

  return pairs.slice(0, 4).map((pair) => {
    const combinedCost = pair.a.cost + pair.b.cost;
    const combinedSellingPrice = pair.a.price + pair.b.price;
    const rawProfit = combinedSellingPrice - combinedCost;

    // Safe default discount: at most 10% of selling price AND never more than 35% of gross profit
    let discountAmount: number;
    if (typeof customDiscountPct === 'number' && Number.isFinite(customDiscountPct)) {
      discountAmount = Math.round((combinedSellingPrice * Math.max(0, customDiscountPct)) / 100);
    } else {
      const target10Pct = Math.round(combinedSellingPrice * 0.1);
      const maxSafeDiscount = Math.max(0, Math.floor(rawProfit * 0.35));
      discountAmount = Math.min(target10Pct, maxSafeDiscount);
      // Round nicely to nearest ₹10 if >= 20
      if (discountAmount >= 20) {
        discountAmount = Math.floor(discountAmount / 10) * 10;
      }
    }

    const bundlePrice = Math.max(0, combinedSellingPrice - discountAmount);
    const estimatedProfit = bundlePrice - combinedCost;
    const marginPct =
      bundlePrice > 0 ? Math.round((estimatedProfit / bundlePrice) * 1000) / 10 : 0;
    const isProfitable = estimatedProfit > 0;

    return {
      id: pair.id,
      title: pair.title,
      items: [
        { name: pair.a.name, cost: pair.a.cost, price: pair.a.price },
        { name: pair.b.name, cost: pair.b.cost, price: pair.b.price },
      ],
      combinedCost,
      combinedSellingPrice,
      bundlePrice,
      discountAmount,
      estimatedProfit,
      marginPct,
      isProfitable,
      warning: !isProfitable
        ? `Warning: A ₹${discountAmount} discount makes this bundle unprofitable (loss of ₹${Math.abs(estimatedProfit)}). Lower the discount.`
        : marginPct < 20
        ? `Caution: Margin drops to ${marginPct}% after this discount.`
        : undefined,
      reason: pair.reason,
    };
  });
}

export interface PricingIdeaItem {
  id: string;
  tier: string;
  headline: string;
  detail: string;
  priceTag: string;
}

export function buildPricingIdeas(
  resolvedGroups: CategoryGroupResolved[]
): PricingIdeaItem[] {
  const products = flattenActiveProducts(resolvedGroups).filter((p) => p.price > 0);
  if (products.length === 0) return [];

  const sorted = [...products].sort((a, b) => a.price - b.price);
  const entry = sorted[0];
  const mid = sorted[Math.floor(sorted.length / 2)];
  const premium = sorted[sorted.length - 1];

  const ideas: PricingIdeaItem[] = [
    {
      id: 'entry_hook',
      tier: 'Entry Hook',
      headline: `Lead signage with "Starts at ₹${Math.round(entry.price)}"`,
      detail: `${entry.name} (cost ₹${entry.cost}, profit +₹${Math.round(entry.profit)}) lowers hesitation and invites browsers to stop.`,
      priceTag: `₹${Math.round(entry.price)}`,
    },
    {
      id: 'core_anchor',
      tier: 'Core Value',
      headline: `Center display around ₹${Math.round(mid.price)} bestsellers`,
      detail: `${mid.name} sits in the middle price band (${mid.marginPct}% margin) where most exhibition buyers convert.`,
      priceTag: `₹${Math.round(mid.price)}`,
    },
    {
      id: 'premium_anchor',
      tier: 'Price Anchor',
      headline: `Anchor with ${premium.name} at ₹${Math.round(premium.price)}`,
      detail: `Showing your ₹${Math.round(premium.price)} statement piece makes ₹${Math.round(mid.price)} items feel instantly affordable.`,
      priceTag: `₹${Math.round(premium.price)}`,
    },
  ];

  // Safe multi-buy check
  const safeMultiProfit = entry.price * 2 - 20 - entry.cost * 2;
  if (safeMultiProfit > 0) {
    ideas.push({
      id: 'multi_buy',
      tier: 'Multi-Buy',
      headline: `2 for ₹${Math.round(entry.price * 2 - 20)} on ${entry.name}`,
      detail: `Saves buyer ₹20 while still preserving +₹${Math.round(safeMultiProfit)} net profit per pair.`,
      priceTag: `2 for ₹${Math.round(entry.price * 2 - 20)}`,
    });
  }

  return ideas;
}

export interface InteractionScript {
  stage: string;
  line: string;
}

export function buildCustomerInteractionScripts(
  resolvedGroups: CategoryGroupResolved[],
  eventName: string
): InteractionScript[] {
  const products = flattenActiveProducts(resolvedGroups);
  const cats = resolvedGroups.map((rg) => rg.group.name);
  const mainCat = cats[0] || 'collection';
  const secondCat = cats[1];
  const sorted = [...products].filter((p) => p.price > 0).sort((a, b) => a.price - b.price);
  const entry = sorted[0];
  const hero = [...products].sort((a, b) => b.appeal - a.appeal)[0];

  return [
    {
      stage: 'Attract passer-by',
      line: entry
        ? `"Quick look — fresh ${mainCat} starting at ₹${Math.round(entry.price)} for ${eventName}!"`
        : `"Take a quick look at our curated ${mainCat} table!"`,
    },
    {
      stage: 'Warm greeting',
      line: `"Welcome in! Feel free to pick up and try anything — are you browsing for yourself or a gift?"`,
    },
    {
      stage: 'Spot their need',
      line: hero
        ? `"If you want everyday wear, look left; if you want a standout piece, ${hero.name} has been our eye-catcher."`
        : `"Are you leaning toward light everyday pieces or something statement?"`,
    },
    {
      stage: 'Suggest a pair',
      line: secondCat
        ? `"That pairs nicely with our ${secondCat} right beside it — together I can do a neat combo price."`
        : `"Most people pair this with one of our ₹${entry ? Math.round(entry.price) : 250} pieces — saves a bit as a duo."`,
    },
    {
      stage: 'Natural close',
      line: `"Shall I pack this in a protective pouch? We take UPI right here on the right."`,
    },
  ];
}

export interface DailyTargetMetrics {
  sellingDays: number;
  dailyRevenueTarget: number;
  dailyBreakEvenRevenue: number;
  dailyPiecesTarget: number;
  dailyBreakEvenPieces: number;
  totalRevenueTarget: number;
  actualRevenue: number | null;
  actualPieces: number | null;
  revenueProgressPct: number | null;
  piecesProgressPct: number | null;
  remainingRevenueToTarget: number | null;
}

export function calculateDailyTargets(params: {
  expectedRevenue: number;
  breakEvenSalesAmount: number;
  totalPieces: number;
  breakEvenPieces: number;
  tracker?: DailySalesTracker;
}): DailyTargetMetrics {
  const sellingDays = Math.max(1, Math.min(30, Math.round(params.tracker?.sellingDays || 2)));
  const totalRevenueTarget = Math.max(0, Math.round(params.expectedRevenue));
  const dailyRevenueTarget = Math.round(totalRevenueTarget / sellingDays);
  const dailyBreakEvenRevenue = Math.round(Math.max(0, params.breakEvenSalesAmount) / sellingDays);
  const dailyPiecesTarget = Math.max(0, Math.ceil(params.totalPieces / sellingDays));
  const dailyBreakEvenPieces = Math.max(0, Math.ceil(params.breakEvenPieces / sellingDays));

  const actualRevenue =
    typeof params.tracker?.actualRevenueEntered === 'number' &&
    Number.isFinite(params.tracker.actualRevenueEntered) &&
    params.tracker.actualRevenueEntered >= 0
      ? params.tracker.actualRevenueEntered
      : null;

  const actualPieces =
    typeof params.tracker?.actualPiecesEntered === 'number' &&
    Number.isFinite(params.tracker.actualPiecesEntered) &&
    params.tracker.actualPiecesEntered >= 0
      ? params.tracker.actualPiecesEntered
      : null;

  const revenueProgressPct =
    actualRevenue !== null && totalRevenueTarget > 0
      ? Math.min(100, Math.round((actualRevenue / totalRevenueTarget) * 100))
      : null;

  const piecesProgressPct =
    actualPieces !== null && params.totalPieces > 0
      ? Math.min(100, Math.round((actualPieces / params.totalPieces) * 100))
      : null;

  const remainingRevenueToTarget =
    actualRevenue !== null ? Math.max(0, totalRevenueTarget - actualRevenue) : null;

  return {
    sellingDays,
    dailyRevenueTarget,
    dailyBreakEvenRevenue,
    dailyPiecesTarget,
    dailyBreakEvenPieces,
    totalRevenueTarget,
    actualRevenue,
    actualPieces,
    revenueProgressPct,
    piecesProgressPct,
    remainingRevenueToTarget,
  };
}
