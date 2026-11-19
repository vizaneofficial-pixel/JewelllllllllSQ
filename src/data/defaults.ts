import type {
  BangleCategory,
  PlaybookCard,
  StallStockItem,
  StockCategoryGroup,
  VideoGuide,
  ZoneId,
} from '../types/stall';

export const INITIAL_CATEGORIES: BangleCategory[] = [
  {
    id: 'white',
    name: 'White (Resin)',
    shortName: 'White',
    cost: 280,
    price: 499,
    beauty: 9.5,
    barColor: '#94A3B8',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'colours',
    name: 'Colours (Resin)',
    shortName: 'Colours',
    cost: 210,
    price: 449,
    beauty: 9.0,
    barColor: '#BE185D',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'yellow',
    name: 'Yellow (Resin)',
    shortName: 'Yellow',
    cost: 180,
    price: 399,
    beauty: 8.2,
    barColor: '#D97706',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'cuff',
    name: 'Cuff',
    shortName: 'Cuff',
    cost: 150,
    price: 349,
    beauty: 7.8,
    barColor: '#6D28D9',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'silver_gold',
    name: 'Silver Gold (Basic)',
    shortName: 'Silver Gold',
    cost: 120,
    price: 299,
    beauty: 5.5,
    barColor: '#0F5E54',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'wooden',
    name: 'Wooden (Small)',
    shortName: 'Wooden',
    cost: 100,
    price: 249,
    beauty: 5.0,
    barColor: '#9A3412',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
];

export const INITIAL_JEWELLERY_ITEMS: BangleCategory[] = [
  {
    id: 'kundan_set',
    name: 'Kundan Choker',
    shortName: 'Kundan',
    cost: 340,
    price: 749,
    beauty: 9.5,
    barColor: '#B45309',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'oxidized_jhumka',
    name: 'Oxidized Jhumka',
    shortName: 'Jhumka',
    cost: 140,
    price: 349,
    beauty: 9.0,
    barColor: '#0F5E54',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'dainty_chain',
    name: 'Dainty Neck Chain',
    shortName: 'Chain',
    cost: 170,
    price: 399,
    beauty: 8.6,
    barColor: '#15803D',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'korean_studs',
    name: 'Korean Studs',
    shortName: 'Studs',
    cost: 90,
    price: 229,
    beauty: 8.2,
    barColor: '#BE123C',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'tarnish_rings',
    name: 'Anti-Tarnish Ring',
    shortName: 'Rings',
    cost: 110,
    price: 259,
    beauty: 8.0,
    barColor: '#6D28D9',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'pearl_bracelet',
    name: 'Pearl Bracelet',
    shortName: 'Pearl',
    cost: 130,
    price: 299,
    beauty: 7.8,
    barColor: '#0369A1',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
];

export const INITIAL_MISC_ITEMS: BangleCategory[] = [
  {
    id: 'cotton_kurti',
    name: 'Cotton Kurti',
    shortName: 'Kurti',
    cost: 250,
    price: 599,
    beauty: 9.2,
    barColor: '#0F5E54',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'mini_polaroids',
    name: 'Polaroid Pack',
    shortName: 'Polaroid',
    cost: 60,
    price: 159,
    beauty: 8.8,
    barColor: '#BE185D',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'hair_claws',
    name: 'Pastel Hair Claw',
    shortName: 'Hair Claw',
    cost: 75,
    price: 189,
    beauty: 8.4,
    barColor: '#0369A1',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'silk_scrunchies',
    name: 'Silk Scrunchie',
    shortName: 'Scrunchie',
    cost: 50,
    price: 129,
    beauty: 7.9,
    barColor: '#B45309',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
  {
    id: 'canvas_totes',
    name: 'Canvas Tote Bag',
    shortName: 'Tote',
    cost: 120,
    price: 279,
    beauty: 8.2,
    barColor: '#6D28D9',
    textClass: 'text-[#13201E]',
    bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]',
  },
];

export const GROUP_ACCENT_COLORS = [
  '#B45309',
  '#0F5E54',
  '#9D174D',
  '#15803D',
  '#4338CA',
  '#0369A1',
  '#B91C1C',
];

export const INITIAL_CATEGORY_GROUPS: StockCategoryGroup[] = [
  {
    id: 'grp_bangles',
    name: 'Bangles',
    accentColor: '#B45309',
    budgetCap: 3000,
    minProfitFloor: 3100,
    maxPerCategory: 6,
    minColoursRule: 1,
    rules: {
      allAtLeastOne: true,
      evenDistribution: true,
      beautyFirst: false,
      maxProfitFocus: false,
      safe90Mode: false,
    },
    categories: INITIAL_CATEGORIES,
    selectedComboId: 'c_1',
    customQuantities: null,
  },
  {
    id: 'grp_jewellery',
    name: 'Jewellery',
    accentColor: '#0F5E54',
    budgetCap: 6000,
    minProfitFloor: 6500,
    maxPerCategory: 8,
    minColoursRule: 1,
    rules: {
      allAtLeastOne: true,
      evenDistribution: true,
      beautyFirst: false,
      maxProfitFocus: false,
      safe90Mode: false,
    },
    categories: INITIAL_JEWELLERY_ITEMS,
    selectedComboId: 'c_1',
    customQuantities: null,
  },
  {
    id: 'grp_misc',
    name: 'Misc & Lifestyle',
    accentColor: '#9D174D',
    budgetCap: 2000,
    minProfitFloor: 2200,
    maxPerCategory: 6,
    minColoursRule: 1,
    rules: {
      allAtLeastOne: true,
      evenDistribution: true,
      beautyFirst: false,
      maxProfitFocus: false,
      safe90Mode: false,
    },
    categories: INITIAL_MISC_ITEMS,
    selectedComboId: 'c_1',
    customQuantities: null,
  },
];

export const EXTRA_CATEGORY_STYLES = [
  { barColor: '#0F5E54', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
  { barColor: '#B45309', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
  { barColor: '#0369A1', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
  { barColor: '#BE123C', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
  { barColor: '#6D28D9', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
  { barColor: '#15803D', textClass: 'text-[#13201E]', bgClass: 'bg-[#FAF8F3] border-[#D9E2DC]' },
];

export interface CategoryTemplate {
  id: string;
  label: string;
  name: string;
  budgetCap: number;
  minProfitFloor: number;
  items: Array<{
    name: string;
    cost: number;
    price: number;
    beauty: number;
  }>;
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    id: 'custom',
    label: 'Blank Custom',
    name: 'Custom Stock',
    budgetCap: 3000,
    minProfitFloor: 2000,
    items: [
      { name: 'Item 1', cost: 150, price: 300, beauty: 8.0 },
      { name: 'Item 2', cost: 100, price: 220, beauty: 7.5 },
    ],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    name: 'Clothing',
    budgetCap: 6000,
    minProfitFloor: 4500,
    items: [
      { name: 'Printed Tee', cost: 220, price: 499, beauty: 8.5 },
      { name: 'Cotton Kurti', cost: 340, price: 699, beauty: 9.0 },
      { name: 'Dupatta / Scarf', cost: 140, price: 329, beauty: 8.0 },
      { name: 'Canvas Tote', cost: 120, price: 279, beauty: 7.5 },
    ],
  },
  {
    id: 'crafts',
    label: 'Crafts',
    name: 'Handmade Crafts',
    budgetCap: 4000,
    minProfitFloor: 3200,
    items: [
      { name: 'Scented Candle', cost: 130, price: 299, beauty: 9.0 },
      { name: 'Macrame Keychain', cost: 65, price: 169, beauty: 8.2 },
      { name: 'Painted Coaster Set', cost: 150, price: 349, beauty: 8.5 },
      { name: 'Crochet Charm', cost: 90, price: 219, beauty: 8.0 },
    ],
  },
  {
    id: 'photos',
    label: 'Photos & Prints',
    name: 'Photos & Prints',
    budgetCap: 2500,
    minProfitFloor: 2200,
    items: [
      { name: 'A4 Art Print', cost: 45, price: 149, beauty: 9.0 },
      { name: 'Polaroid Pack', cost: 55, price: 159, beauty: 8.5 },
      { name: 'Sticker Sheet', cost: 25, price: 89, beauty: 8.0 },
      { name: 'Framed Mini Print', cost: 160, price: 379, beauty: 9.2 },
    ],
  },
  {
    id: 'food',
    label: 'Food & Treats',
    name: 'Packaged Food',
    budgetCap: 3500,
    minProfitFloor: 2500,
    items: [
      { name: 'Brownie Box', cost: 85, price: 199, beauty: 9.0 },
      { name: 'Cookie Jar', cost: 120, price: 269, beauty: 8.5 },
      { name: 'Spiced Trail Mix', cost: 70, price: 169, beauty: 7.5 },
      { name: 'Cold Brew Bottle', cost: 60, price: 149, beauty: 8.0 },
    ],
  },
];

export const CATEGORY_SUGGESTIONS = [
  'Bangles',
  'Jewellery',
  'Accessories',
  'Clothing',
  'Home & Lifestyle',
];

export const SALE_SCALE_PRESETS = [
  {
    id: 'mini_popup',
    label: 'Mini Pop-Up',
    eventName: 'Weekend Pop-Up',
    expectedFootfall: 1200,
    budgetCap: 1500,
    minProfitFloor: 1400,
    stallFee: 1500,
    maxPerCategory: 5,
  },
  {
    id: 'standard_stall',
    label: 'Standard Exhibition',
    eventName: 'Exhibition Stall',
    expectedFootfall: 5000,
    budgetCap: 5000,
    minProfitFloor: 4500,
    stallFee: 8000,
    maxPerCategory: 8,
  },
  {
    id: 'mega_expo',
    label: 'Large Expo',
    eventName: 'Festive Lifestyle Expo',
    expectedFootfall: 20000,
    budgetCap: 15000,
    minProfitFloor: 16000,
    stallFee: 20000,
    maxPerCategory: 20,
  },
  {
    id: 'wholesale_fair',
    label: 'Trade Fair',
    eventName: 'Regional Trade Fair',
    expectedFootfall: 40000,
    budgetCap: 50000,
    minProfitFloor: 55000,
    stallFee: 40000,
    maxPerCategory: 50,
  },
];

export const INITIAL_STALL_STOCK: StallStockItem[] = [
  {
    id: 's_bangles',
    name: 'Selected Bangle Mix (17 pcs)',
    category: 'Bangles',
    cost: 2990,
    price: 6583,
    qty: 1,
    sellThrough: 90,
    isSyncedBundle: true,
    unitPieces: 17,
    groupId: 'grp_bangles',
  },
  {
    id: 's_jhumka',
    name: 'Oxidized Jhumkas',
    category: 'Earrings',
    cost: 65,
    price: 199,
    qty: 25,
    sellThrough: 90,
    isSyncedBundle: false,
  },
  {
    id: 's_korean',
    name: 'Korean Studs & Hoops',
    category: 'Earrings',
    cost: 45,
    price: 149,
    qty: 30,
    sellThrough: 90,
    isSyncedBundle: false,
  },
  {
    id: 's_rings',
    name: 'Anti-Tarnish Rings',
    category: 'Rings',
    cost: 55,
    price: 179,
    qty: 25,
    sellThrough: 85,
    isSyncedBundle: false,
  },
  {
    id: 's_chains',
    name: 'Dainty Neck Chains',
    category: 'Necklaces',
    cost: 95,
    price: 299,
    qty: 15,
    sellThrough: 85,
    isSyncedBundle: false,
  },
  {
    id: 's_combos',
    name: 'Bangle + Ring Combo Boxes',
    category: 'Bundles',
    cost: 140,
    price: 349,
    qty: 10,
    sellThrough: 85,
    isSyncedBundle: false,
  },
];

export const PLAYBOOK_CARDS: PlaybookCard[] = [
  {
    id: 'p1',
    number: '01',
    title: 'The ₹50 Bargaining Cushion',
    desc: 'Tag Colours at ₹499 and White at ₹549, then offer a "₹50 Exhibition Special" to close immediately at ₹449 and ₹499 with 100% of planned margin intact.',
    metric: '+35% Close Rate',
    imageUrl: '/src/assets/images/display_velvet_cones_1795002552295.jpg',
    imageAlt: 'White and colourful resin bangles arranged on dark velvet cones under spotlight',
  },
  {
    id: 'p2',
    number: '02',
    title: 'Gloss + Matte ₹599 Stack Bundle',
    desc: 'Pair 1 glossy Colours Resin (₹210 cost / ₹449 sell) with 1 matte Wooden Stacker (₹100 cost / ₹249 sell) for ₹599. Combined cost is ₹310—pocketing +₹289 in one sale.',
    metric: '₹289 Net / Pair',
    imageUrl: '/src/assets/images/display_tiered_riser_1795002552402.jpg',
    imageAlt: 'Tiered wooden riser displaying curated jewellery boxes and layered chains',
  },
  {
    id: 'p3',
    number: '03',
    title: 'The Mirror Trap Placement',
    desc: 'Place an angled brass tabletop mirror on the right edge next to ₹349 Cuffs and ₹399 Yellow Festive bangles. Wrist try-ons lift conversion past 70%.',
    metric: '2.4x Try-On Lift',
    imageUrl: '/src/assets/images/display_mirror_station_1795002552364.jpg',
    imageAlt: 'Angled brass tabletop mirror beside hammered cuffs and yellow resin bangles',
  },
  {
    id: 'p4',
    number: '04',
    title: 'Final-4-Hour Bundle Clearance',
    desc: 'In the closing hours, switch signage to "Any Bangle + Any ₹179 Ring for ₹499". A ₹210 Colours + ₹55 Ring yields +₹234 cash with zero unsold stock.',
    metric: 'Zero Dead Stock',
    imageUrl: '/src/assets/images/display_impulse_tray_1795002552653.jpg',
    imageAlt: 'Sectioned walnut and velvet trays with rings, studs, and oxidized jhumkas',
  },
];

export const CURATED_VIDEOS: VideoGuide[] = [
  {
    id: 'v1',
    title: 'Jewellery Stall Display & Tiered Riser Aesthetics for Exhibitions',
    tag: 'Display Setup',
    duration: '6 min guide',
    keyTakeaway:
      'Use tiered velvet cones and wood risers at eye level so aisle walkers 6–8 feet away lock onto your White & Colours hero pieces first.',
    queryUrl: 'https://www.youtube.com/results?search_query=jewellery+exhibition+stall+display+ideas+india',
  },
  {
    id: 'v2',
    title: 'How to Price & Bundle Fashion Jewellery at Pop-Up Fairs',
    tag: 'Pricing Psychology',
    duration: '8 min strategy',
    keyTakeaway:
      'Anchor the top tray with ₹499 statement pieces and keep "Any 2 for ₹599" stackers at wrist height to lift average bill size.',
    queryUrl: 'https://www.youtube.com/results?search_query=how+to+price+jewellery+for+pop+up+stall+india',
  },
  {
    id: 'v3',
    title: 'Turning Exhibition Footfall into Instant Sales: Booth Scripts',
    tag: 'Crowd Conversion',
    duration: '5 min playbook',
    keyTakeaway:
      'Skip "Can I help you?" — hand browsers a mirror and suggest "Try stacking this matte wooden piece beside the glossy resin."',
    queryUrl: 'https://www.youtube.com/results?search_query=craft+fair+booth+setup+and+selling+tips+jewelry',
  },
];

export const STALL_ZONES: Record<
  ZoneId,
  {
    title: string;
    subtitle: string;
    items: string;
    why: string;
    imageUrl: string;
  }
> = {
  front_left: {
    title: 'Zone 1 · Front-Left Eye-Catcher',
    subtitle: 'Elevated focal display + warm spotlight right at aisle entry',
    items: 'Your highest-appeal statement pieces',
    why: 'Stops aisle walkers from 6–8 feet away. High-appeal signature items act as an instant magnet.',
    imageUrl: '/src/assets/images/display_velvet_cones_1795002552295.jpg',
  },
  center_tray: {
    title: 'Zone 2 · Center Impulse Tray',
    subtitle: 'Open organizer bowls at waist height for easy browsing',
    items: 'Accessible everyday picks & impulse add-ons',
    why: 'Drives rapid volume early on Day 1 to build momentum toward covering your stall costs.',
    imageUrl: '/src/assets/images/display_impulse_tray_1795002552653.jpg',
  },
  right_mirror: {
    title: 'Zone 3 · Right Try-On Station',
    subtitle: 'Angled tabletop mirror + open tray for instant testing',
    items: 'Mid-tier bestsellers & try-on friendly items',
    why: 'Most right-handed shoppers pause here. Hands-on try-ons lift close rates significantly.',
    imageUrl: '/src/assets/images/display_mirror_station_1795002552364.jpg',
  },
  back_riser: {
    title: 'Zone 4 · Back Vertical Riser',
    subtitle: 'Eye-level vertical display stands + simple combo price card',
    items: 'Curated pairings & higher-ticket gift sets',
    why: 'Raises average bill size by framing ready-to-buy paired sets at eye level.',
    imageUrl: '/src/assets/images/display_tiered_riser_1795002552402.jpg',
  },
};
