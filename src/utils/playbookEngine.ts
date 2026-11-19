import type {
  BangleCategory,
  BangleCombo,
  CategoryGroupResolved,
  CategorySalesApproach,
  PlaybookZoneInfo,
  StockCategoryGroup,
  VideoGuide,
  ZoneId,
} from '../types/stall';

interface FlattenedProduct {
  groupId: string;
  groupName: string;
  item: BangleCategory;
  qty: number;
  marginRupees: number;
}

function collectActiveProducts(resolvedGroups: CategoryGroupResolved[]): FlattenedProduct[] {
  const items: FlattenedProduct[] = [];
  resolvedGroups.forEach(({ group, activeCombo }) => {
    group.categories.forEach((item, idx) => {
      const qty = activeCombo ? activeCombo.counts[idx] ?? 0 : 1;
      items.push({
        groupId: group.id,
        groupName: group.name,
        item,
        qty,
        marginRupees: Math.max(0, item.price - item.cost),
      });
    });
  });
  return items;
}

function formatProductList(list: FlattenedProduct[], fallback: string): string {
  if (list.length === 0) return fallback;
  return list
    .slice(0, 3)
    .map((p) => `${p.qty > 0 ? `${p.qty}x ` : ''}${p.item.shortName || p.item.name} (₹${p.item.price})`)
    .join(' · ');
}

export function buildDynamicStallZones(
  eventName: string,
  expectedFootfall: number,
  stallFee: number,
  resolvedGroups: CategoryGroupResolved[]
): Record<ZoneId, PlaybookZoneInfo> {
  const venueLabel = eventName?.trim() || 'your event';
  const allProducts = collectActiveProducts(resolvedGroups).filter((p) => p.qty > 0);
  const pool =
    allProducts.length > 0 ? allProducts : collectActiveProducts(resolvedGroups);

  const byAppeal = [...pool].sort(
    (a, b) => b.item.beauty - a.item.beauty || b.item.price - a.item.price
  );
  const byImpulsePrice = [...pool].sort(
    (a, b) => a.item.price - b.item.price || b.marginRupees - a.marginRupees
  );
  const byMidTier = [...pool].sort(
    (a, b) =>
      Math.abs(a.item.price - 350) - Math.abs(b.item.price - 350) ||
      b.item.beauty - a.item.beauty
  );
  const byHighTicket = [...pool].sort(
    (a, b) => b.item.price - a.item.price || b.marginRupees - a.marginRupees
  );

  const heroItems = byAppeal.slice(0, 2);
  const impulseItems = byImpulsePrice
    .filter((p) => !heroItems.some((h) => h.item.id === p.item.id))
    .slice(0, 3);
  const sideItems = byMidTier
    .filter(
      (p) =>
        !heroItems.some((h) => h.item.id === p.item.id) &&
        !impulseItems.some((i) => i.item.id === p.item.id)
    )
    .slice(0, 2);
  const backItems = byHighTicket
    .filter(
      (p) =>
        !impulseItems.some((i) => i.item.id === p.item.id) &&
        !sideItems.some((s) => s.item.id === p.item.id)
    )
    .slice(0, 2);

  const feeNote =
    stallFee > 0
      ? `to help cover ₹${stallFee.toLocaleString('en-IN')} stall costs early`
      : 'to build steady early cashflow';

  return {
    front_left: {
      id: 'front_left',
      shortTitle: 'Front Aisle Hook',
      placementLabel: 'FRONT-LEFT · EYE CATCHER',
      title: 'Front-Left · High-Appeal Focal Display',
      subtitle: `Spotlight top-rated items where ${venueLabel} passersby look first`,
      items: formatProductList(heroItems, 'Your highest-appeal hero products'),
      why: `Places your strongest visual items (${heroItems[0]?.item.beauty.toFixed(1) || '8.5'}/10 appeal) right along the ${expectedFootfall.toLocaleString('en-IN')}-visitor aisle to stop foot traffic.`,
      imageUrl: '/src/assets/images/display_velvet_cones_1795002552295.jpg',
    },
    center_tray: {
      id: 'center_tray',
      shortTitle: 'Center Impulse Pick',
      placementLabel: 'FRONT-CENTER · QUICK PICK',
      title: 'Center · Low-Friction Impulse Zone',
      subtitle: 'Easy-reach trays or baskets for fast first purchases',
      items: formatProductList(
        impulseItems.length > 0 ? impulseItems : byImpulsePrice.slice(0, 2),
        'Lower-priced quick-pick items'
      ),
      why: `Accessible ₹${byImpulsePrice[0]?.item.price || 149}–₹${byImpulsePrice[Math.min(1, byImpulsePrice.length - 1)]?.item.price || 249} entry prices encourage browsers to pick up an item quickly ${feeNote}.`,
      imageUrl: '/src/assets/images/display_impulse_tray_1795002552653.jpg',
    },
    right_mirror: {
      id: 'right_mirror',
      shortTitle: 'Side Interaction Station',
      placementLabel: 'SIDE · TRY / TEST STATION',
      title: 'Side · Hands-On Try / Sample Station',
      subtitle: 'Dedicated counter space for sizing, testing, or pairing items',
      items: formatProductList(
        sideItems.length > 0 ? sideItems : byMidTier.slice(0, 2),
        'Mid-range signature items'
      ),
      why: 'Giving shoppers a dedicated spot on the side edge to hold, compare, or try pieces increases commitment without blocking the center aisle.',
      imageUrl: '/src/assets/images/display_mirror_station_1795002552364.jpg',
    },
    back_riser: {
      id: 'back_riser',
      shortTitle: 'Back Bundle Riser',
      placementLabel: 'BACK · ELEVATED SETS',
      title: 'Back · Elevated Riser & Multi-Item Sets',
      subtitle: 'Eye-level vertical risers showcasing higher-value bundles',
      items: formatProductList(
        backItems.length > 0 ? backItems : byHighTicket.slice(0, 2),
        'Higher-value signature items & paired sets'
      ),
      why: 'Vertical elevation makes the stall visible from across the hall and anchors multi-item bundle signage above table clutter.',
      imageUrl: '/src/assets/images/display_tiered_riser_1795002552402.jpg',
    },
  };
}

export function buildCategorySalesApproaches(
  group: StockCategoryGroup,
  combos: BangleCombo[],
  activeCombo: BangleCombo | null,
  eventName: string
): CategorySalesApproach[] {
  const venueLabel = eventName?.trim() || 'your event';
  const items = group.categories;
  if (items.length === 0) return [];

  const sortedByBeauty = [...items].sort((a, b) => b.beauty - a.beauty);
  const sortedByMargin = [...items].sort(
    (a, b) => (b.price - b.cost) / Math.max(1, b.price) - (a.price - a.cost) / Math.max(1, a.price)
  );
  const sortedByLowPrice = [...items].sort((a, b) => a.price - b.price);
  const sortedByHighPrice = [...items].sort((a, b) => b.price - a.price);

  const hero = sortedByBeauty[0];
  const marginStar = sortedByMargin[0];
  const entryItem = sortedByLowPrice[0];
  const anchorItem = sortedByHighPrice[0];

  const topAppealCombo = [...combos].sort((a, b) => b.avgBeauty - a.avgBeauty)[0];
  const topProfitCombo = [...combos].sort((a, b) => b.prof100 - a.prof100)[0];
  const safeCombo = [...combos].sort((a, b) => b.prof90 - a.prof90)[0];

  const bundlePairCost = Math.round(hero.cost + entryItem.cost);
  const rawPairPrice = hero.price + entryItem.price;
  const bundlePrice = Math.max(
    bundlePairCost + 40,
    Math.round((rawPairPrice * 0.88) / 10) * 10 - 1
  );
  const bundleProfit = bundlePrice - bundlePairCost;

  const approaches: CategorySalesApproach[] = [
    {
      id: `${group.id}_hero_lead`,
      title: `Lead with ${hero.name} as the Aisle Magnet`,
      summary: `Display ${hero.name} (${hero.beauty.toFixed(1)}/10 appeal, ₹${hero.price}) at front-eye level to draw ${venueLabel} visitors to ${group.name}.`,
      tag: 'Crowd Pull',
      metric: `${hero.beauty.toFixed(1)}★ Hero`,
      actionLabel: 'Use this idea',
      action: topAppealCombo
        ? { type: 'select_combo_rank', groupId: group.id, comboId: topAppealCombo.id }
        : { type: 'prioritize_rule', groupId: group.id, rule: 'beautyFirst' },
    },
    {
      id: `${group.id}_bundle_pair`,
      title: `Two-Piece Bundle: ${hero.shortName || hero.name} + ${entryItem.shortName || entryItem.name}`,
      summary: `Offer ${hero.shortName || hero.name} + ${entryItem.shortName || entryItem.name} together for ₹${bundlePrice} instead of ₹${rawPairPrice}, yielding +₹${bundleProfit} profit per bundle.`,
      tag: 'Avg Bill Lift',
      metric: `+₹${bundleProfit} / pair`,
      actionLabel: 'Use this idea',
      action: {
        type: 'add_cfo_bundle',
        name: `${group.name} Bundle (${hero.shortName || hero.name} + ${entryItem.shortName || entryItem.name})`,
        category: group.name,
        cost: bundlePairCost,
        price: bundlePrice,
        qty: 5,
      },
    },
    {
      id: `${group.id}_entry_hook`,
      title: `Low-Barrier Entry Tray at ₹${entryItem.price}`,
      summary: `Keep ${entryItem.name} (₹${entryItem.cost} cost → ₹${entryItem.price} price) right at hand level so cautious shoppers start a basket easily.`,
      tag: 'Fast Turnover',
      metric: `₹${entryItem.price} Entry`,
    },
    {
      id: `${group.id}_margin_focus`,
      title: `Spotlight High-Margin ${marginStar.name}`,
      summary: `${marginStar.name} carries a ${Math.round(
        ((marginStar.price - marginStar.cost) / Math.max(1, marginStar.price)) * 100
      )}% gross margin—prioritize its share inside your ₹${group.budgetCap.toLocaleString('en-IN')} budget.`,
      tag: 'Margin Boost',
      metric: topProfitCombo
        ? `+₹${topProfitCombo.prof100.toLocaleString('en-IN')}`
        : `₹${marginStar.price - marginStar.cost} / pc`,
      actionLabel: 'Use this idea',
      action: topProfitCombo
        ? { type: 'select_combo_rank', groupId: group.id, comboId: topProfitCombo.id }
        : { type: 'prioritize_rule', groupId: group.id, rule: 'maxProfitFocus' },
    },
    {
      id: `${group.id}_anchor_cushion`,
      title: `Price Anchor with ${anchorItem.name} (₹${anchorItem.price})`,
      summary: `Show ${anchorItem.name} clearly priced at ₹${anchorItem.price} beside mid-tier options so standard pieces look high-value.`,
      tag: 'Price Framing',
      metric: `₹${anchorItem.price} Anchor`,
    },
    {
      id: `${group.id}_conservative_guard`,
      title: 'Protect Cashflow with 80% Sell-Through Stress Test',
      summary: `Stress-test ${group.name} at 80% sell-through so unsold ${group.name.toLowerCase()} pieces never squeeze your event profit margin.`,
      tag: 'Risk Control',
      metric: safeCombo ? `80% Buffer` : 'Risk Check',
      actionLabel: 'Use this idea',
      action: { type: 'set_sell_through', groupId: group.id, pct: 80 },
    },
  ];

  if (activeCombo && activeCombo.cost <= group.budgetCap) {
    approaches.push({
      id: `${group.id}_packaging_upsell`,
      title: `Budget Reusable ${group.name} Display & Gift Packaging`,
      summary: `Allocate ₹400 in event costs for clean labels and reusable packaging to lift perceived value for ${group.name} buyers.`,
      tag: 'Presentation',
      metric: '₹400 Setup',
      actionLabel: 'Use this idea',
      action: {
        type: 'add_event_cost',
        name: `${group.name} Display & Packaging`,
        amount: 400,
      },
    });
  }

  return approaches.slice(0, 10);
}

export function buildDynamicLearningResources(
  eventName: string,
  resolvedGroups: CategoryGroupResolved[]
): VideoGuide[] {
  const venueHint = eventName?.trim() || 'pop-up market';
  const primaryGroup = resolvedGroups[0]?.group;
  const secondaryGroup = resolvedGroups[1]?.group;

  const primaryName = primaryGroup?.name || 'retail stall';
  const secondaryName = secondaryGroup?.name || primaryName;

  const encode = (q: string) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

  return [
    {
      id: 'res_display',
      title: `${primaryName} Table Display & Vertical Riser Layout Ideas`,
      tag: `${primaryName} Merchandising`,
      duration: 'YouTube Topic Search',
      keyTakeaway: `Explore practical tabletop spacing, lighting, and eye-level riser setups tailored for ${primaryName} at ${venueHint}.`,
      queryUrl: encode(`${primaryName} pop up stall display layout ideas`),
    },
    {
      id: 'res_pricing',
      title: `Pricing & Multi-Item Bundles for ${secondaryName}`,
      tag: 'Pricing & Bundles',
      duration: 'YouTube Topic Search',
      keyTakeaway: `Compare bundle pricing signs and fast-moving price anchors for ${secondaryName} without eroding margins.`,
      queryUrl: encode(`${secondaryName} pop up booth pricing and bundle strategy`),
    },
    {
      id: 'res_conversion',
      title: `${primaryName} Shopper Opening Lines & Stall Conversion`,
      tag: 'Shopper Conversion',
      duration: 'Topic Search',
      keyTakeaway: `Explore natural greeting prompts and hands-on side-counter conversion ideas suited for ${primaryName} at ${venueHint}.`,
      queryUrl: encode(`${primaryName} pop up booth conversion and customer engagement tips`),
    },
  ];
}
