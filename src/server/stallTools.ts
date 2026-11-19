import { Type, type FunctionDeclaration } from '@google/genai';
import type { AccountAiContext, PlannerSnapshot } from '../types/stall.js';

export const STALL_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'add_products_to_inventory',
    description:
      'Add one or more products to the active project inventory and create any missing categories automatically. Use this whenever the user asks to add products, create a category with products, or add multiple products in one message. NEVER invent selling prices, quantities, or appeal ratings the user did not provide. If product name or purchase cost is missing, do NOT call this tool—ask one short follow-up question instead.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        defaultCategoryName: {
          type: Type.STRING,
          description:
            'Optional category name to create or reuse for items that do not specify their own categoryName (e.g. "Hair Accessories", "Bangles", "Jewellery").',
        },
        items: {
          type: Type.ARRAY,
          description: 'List of one or more products to add to the active project.',
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Product name (e.g. "Oxidised Silver Bangles", "Pearl Hair Clips").',
              },
              categoryName: {
                type: Type.STRING,
                description: 'Optional category name for this specific product.',
              },
              purchaseCost: {
                type: Type.NUMBER,
                description: 'Purchase / wholesale cost per piece in INR.',
              },
              sellingPrice: {
                type: Type.NUMBER,
                description: 'Optional expected selling price per piece in INR. OMIT if user did not mention it.',
              },
              quantity: {
                type: Type.NUMBER,
                description: 'Optional planned quantity to purchase. OMIT if user did not mention it.',
              },
              appealRating: {
                type: Type.NUMBER,
                description:
                  'Optional visual appeal / beauty rating from 1 to 5 (5 = highest visual appeal). OMIT if user did not mention it.',
              },
              notes: {
                type: Type.STRING,
                description: 'Optional short product note.',
              },
            },
            required: ['name', 'purchaseCost'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'configure_planner',
    description:
      'Update any category, product, budget, optimization goal, event detail, stall size/type/layout arrangement, or active section in StallIQ: switch or create a category, set event name/location/date/visitors, set budget cap, min profit target, stall rent, pick one of the optimization goals, edit/remove products, set custom quantities, select combination rank 1-30, update stall dimensions/type/layout preset, or navigate between Overview, Categories & Products (optimizer), Stall Setup (strategies), and Market Research (research).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryGroupName: {
          type: Type.STRING,
          description:
            'Name of the product category to switch to, create, or edit (e.g. "Bangles", "Jewellery", "Hair Accessories"). Defaults to the active category.',
        },
        createCategoryGroup: {
          type: Type.BOOLEAN,
          description:
            'Set true to create a new category when categoryGroupName does not match an existing one.',
        },
        eventName: {
          type: Type.STRING,
          description: 'Name of the exhibition, pop-up, market, or business.',
        },
        eventLocation: {
          type: Type.STRING,
          description: 'City or venue location of the event.',
        },
        eventDate: {
          type: Type.STRING,
          description: 'Optional date or weekend of the event.',
        },
        expectedFootfall: {
          type: Type.NUMBER,
          description: 'Estimated number of visitors expected at the event.',
        },
        budgetCap: {
          type: Type.NUMBER,
          description: 'Stock purchase budget limit in INR for the targeted category.',
        },
        minProfitFloor: {
          type: Type.NUMBER,
          description: 'Minimum target profit in INR for combination generation.',
        },
        stallFee: {
          type: Type.NUMBER,
          description: 'Event stall rent or booth fee in INR.',
        },
        maxPerCategory: {
          type: Type.NUMBER,
          description: 'Maximum quantity cap per product when balanced spread is enabled.',
        },
        globalSellThrough: {
          type: Type.NUMBER,
          description: 'Expected sell-through percentage across stock (50-100).',
        },
        objective: {
          type: Type.STRING,
          description:
            "Stock combination goal. One of: 'best_overall', 'highest_profit', 'balanced_variety', 'lowest_risk', 'best_appeal', 'best_budget_use', 'conservative_sales', 'high_footfall', 'small_budget'.",
        },
        stallWidthFt: {
          type: Type.NUMBER,
          description: 'Stall width in feet (e.g. 6, 8, 10).',
        },
        stallDepthFt: {
          type: Type.NUMBER,
          description: 'Stall depth in feet (e.g. 4, 6, 10).',
        },
        stallType: {
          type: Type.STRING,
          description:
            "Physical stall format: 'tabletop', 'corner_booth', 'open_canopy', or 'indoor_kiosk'.",
        },
        layoutStyle: {
          type: Type.STRING,
          description:
            "Stall layout arrangement preset: 'classic_u' (Classic U-Display), 'open_gallery' (Open Browse Gallery), or 'counter_focus' (High-Traffic Counter).",
        },
        arrangeStallLayout: {
          type: Type.BOOLEAN,
          description:
            'Set true when the user asks to arrange or optimize their stall layout zones based on current categories.',
        },
        allAtLeastOne: {
          type: Type.BOOLEAN,
          description: 'Include at least 1 unit of every product in this category.',
        },
        evenDistribution: {
          type: Type.BOOLEAN,
          description: 'Spread quantities evenly across products.',
        },
        beautyFirst: {
          type: Type.BOOLEAN,
          description: 'Prioritize highest customer appeal score.',
        },
        maxProfitFocus: {
          type: Type.BOOLEAN,
          description: 'Prioritize maximum expected profit.',
        },
        safe90Mode: {
          type: Type.BOOLEAN,
          description: 'Prioritize conservative sell-through safety.',
        },
        replaceCategories: {
          type: Type.BOOLEAN,
          description:
            'Set true ONLY when replacing the entire list of products inside the targeted category; false to update matching products or add new ones.',
        },
        categories: {
          type: Type.ARRAY,
          description: 'Products inside the category with purchase cost, optional selling price, optional planned quantity, and optional appeal.',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              shortName: { type: Type.STRING },
              cost: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              beauty: { type: Type.NUMBER },
              plannedQty: { type: Type.NUMBER },
              notes: { type: Type.STRING },
            },
            required: ['name'],
          },
        },
        removeItemNames: {
          type: Type.ARRAY,
          description: 'Names of products to remove from the targeted category.',
          items: { type: Type.STRING },
        },
        customQuantities: {
          type: Type.ARRAY,
          description: 'Exact product quantities to set for the active category mix.',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              qty: { type: Type.NUMBER },
            },
            required: ['name', 'qty'],
          },
        },
        selectComboRank: {
          type: Type.NUMBER,
          description: 'Select one of the ranked combinations (1 to 30).',
        },
        navigateToTab: {
          type: Type.STRING,
          description:
            "Switch visible workspace section: 'overview' (Overview), 'optimizer' (Categories & Products), 'strategies' (Stall Setup), or 'research' (Market Research).",
        },
        focusSection: {
          type: Type.STRING,
          description:
            "Optional section to bring into view: 'overview_totals', 'overview_cards', 'overview_costs', 'categories', 'budget', 'combos', 'playbook_layout', 'playbook_approaches', or 'research_workspace'.",
        },
      },
    },
  },
  {
    name: 'manage_inventory_stock',
    description:
      'Update stall event expenses and extra stock items: add/update/remove exhibition event expenses (Display Risers, Packaging, Travel, Lighting), add/edit/remove extra stock items, adjust stall rent or expected sell-through %, or open Overview.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        replaceStock: {
          type: Type.BOOLEAN,
          description: 'If true, replaces all extra manual stock rows with the supplied items list.',
        },
        items: {
          type: Type.ARRAY,
          description: 'Extra standalone stock rows to add or update.',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              cost: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              qty: { type: Type.NUMBER },
              sellThrough: { type: Type.NUMBER },
            },
            required: ['name'],
          },
        },
        eventCosts: {
          type: Type.ARRAY,
          description: 'Add, update, or remove non-rent event expenses (e.g. Display Stands, Packaging, Travel).',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              cost: { type: Type.NUMBER },
              remove: { type: Type.BOOLEAN },
            },
            required: ['name'],
          },
        },
        removeItemNames: {
          type: Type.ARRAY,
          description: 'Names of extra stock or event expense items to remove.',
          items: { type: Type.STRING },
        },
        activeMixLotQty: {
          type: Type.NUMBER,
          description: 'Lot multiplier for synced category bundles.',
        },
        globalSellThrough: {
          type: Type.NUMBER,
          description: 'Expected sell-through % (50-100).',
        },
        stallFee: {
          type: Type.NUMBER,
          description: 'Event stall rent / booth fee in INR.',
        },
        expectedFootfall: {
          type: Type.NUMBER,
          description: 'Expected total visitors.',
        },
        navigateToTab: {
          type: Type.STRING,
          description: "Switch section: 'overview', 'optimizer', 'strategies', or 'research'.",
        },
        focusSection: {
          type: Type.STRING,
          description: "Optional section to scroll into view: 'overview_totals', 'overview_cards', or 'overview_costs'.",
        },
      },
    },
  },
  {
    name: 'get_supplier_order',
    description:
      'Generate a clean supplier-ready purchase order (wholesale unit cost, quantities, subtotals, and total purchase cost ONLY — never includes selling prices or expected profit) for one category or the full stall.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: {
          type: Type.STRING,
          description: "'full_order' for all categories or 'active_category' for one category.",
        },
        categoryName: {
          type: Type.STRING,
          description: 'Optional specific category name when requesting one category order.',
        },
      },
    },
  },
  {
    name: 'save_stock_plan',
    description: 'Save the current active stock plan / combination with a custom label for later comparison.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Short label for the saved plan (e.g. "Conservative Mix", "Festive Plan").',
        },
        categoryName: {
          type: Type.STRING,
          description: 'Optional category name to save; defaults to active category.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_purchase_progress',
    description:
      'Mark a product in the purchase checklist as not_ordered, ordered, or received, optionally recording the supplier name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: { type: Type.STRING, description: 'Product name to update.' },
        status: {
          type: Type.STRING,
          description: "One of: 'not_ordered', 'ordered', 'received'.",
        },
        supplierName: { type: Type.STRING, description: 'Optional supplier name.' },
        categoryName: { type: Type.STRING, description: 'Optional category name.' },
      },
      required: ['itemName', 'status'],
    },
  },
  {
    name: 'record_actual_sale',
    description:
      'Record real event/shop sales (kept strictly separate from pre-event estimates).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: { type: Type.STRING, description: 'Product or summary label sold.' },
        qtySold: { type: Type.NUMBER, description: 'Number of pieces sold.' },
        saleAmount: { type: Type.NUMBER, description: 'Total actual sales revenue in INR.' },
        dayLabel: { type: Type.STRING, description: 'Optional day label (e.g. "Day 1").' },
      },
      required: ['itemName', 'qtySold', 'saleAmount'],
    },
  },
  {
    name: 'get_live_plan_summary',
    description:
      'Read the complete live project state: project name, event details, categories, products, planned quantities, active combinations, stock cost, expected sales & profit, event expenses, purchase progress, actual sales, and saved account memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'save_ai_memory',
    description:
      'Save ONLY durable, long-term merchant preferences and business context under the logged-in user account: preferred product categories, stall type/size, target price range, profit goals, or recurring event habits. NEVER save raw chat transcripts or one-off temporary chatter.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memories: {
          type: Type.ARRAY,
          description: 'Concise factual memories to store for this merchant account.',
          items: {
            type: Type.OBJECT,
            properties: {
              fact: {
                type: Type.STRING,
                description: 'Clear, concise fact under 200 characters.',
              },
              category: {
                type: Type.STRING,
                description: "One of: 'inventory', 'pricing', 'event', 'preference', 'strategy'.",
              },
            },
            required: ['fact', 'category'],
          },
        },
      },
      required: ['memories'],
    },
  },
];

export function formatAccountContextBlock(accountContext?: AccountAiContext): string {
  if (!accountContext) {
    return 'Account Context: Local preview without cloud account memory. Do not claim to remember past cloud sessions.';
  }
  const preferredName =
    accountContext.preferredName?.trim() ||
    accountContext.displayName?.trim().split(/\s+/)[0] ||
    'Merchant';
  const identityParts = [
    `Preferred Name="${preferredName}"`,
    accountContext.displayName ? `Account Name="${accountContext.displayName}"` : null,
    accountContext.businessName ? `Brand="${accountContext.businessName}"` : null,
    accountContext.preferredScale ? `Default Scale="${accountContext.preferredScale}"` : null,
  ].filter(Boolean);

  const memoryLines = (accountContext.memories || [])
    .slice(0, 20)
    .map((m) => `- [${m.category}] ${m.fact}`)
    .join('\n');

  return `Private Signed-In User Context (${identityParts.join(', ')}):
Address this merchant naturally by their Preferred Name ("${preferredName}") when helpful.
Saved durable preferences & facts for this user ONLY:
${memoryLines || 'No saved account memories yet.'}`;
}

export function buildVoiceCoachSystemInstruction(
  snapshot?: PlannerSnapshot,
  accountContext?: AccountAiContext
): string {
  const projectLabel = snapshot?.projectMeta?.name || snapshot?.eventName || 'Active Project';
  const projectType = snapshot?.projectMeta?.type || 'exhibition_stall';
  const groupsSummary =
    snapshot?.categoryGroups && snapshot.categoryGroups.length > 0
      ? ` Categories=${JSON.stringify(
          snapshot.categoryGroups.map((g) => ({
            name: g.name,
            active: g.id === snapshot.activeGroupId,
            budgetCap: g.budgetCap,
            objective: g.objective || 'best_overall',
            selectedComboId: g.selectedComboId,
            products: g.categories.map((c) => ({
              name: c.name,
              purchaseCost: c.cost,
              sellingPrice: c.price > 0 ? c.price : 'not set',
              plannedQty: c.plannedQty ?? null,
              appealOutOf5: Math.min(5, Math.max(1, Math.round(c.beauty / 2))),
            })),
          }))
        )}.`
      : ' Categories=[] (no categories or products added yet).';

  const eventCostsSummary = snapshot?.stallStock
    ? ` EventExpenses=${JSON.stringify(
        snapshot.stallStock
          .filter((s) => s.itemType === 'event_cost')
          .map((s) => ({ name: s.name, cost: s.cost }))
      )}.`
    : '';

  const purchaseEntries = Object.values(snapshot?.purchaseProgress || {});
  const purchaseSummary =
    purchaseEntries.length > 0
      ? ` PurchaseChecklist=${purchaseEntries.filter((p) => p.status === 'received').length} received, ${purchaseEntries.filter((p) => p.status === 'ordered').length} ordered.`
      : '';

  const salesCount = (snapshot?.actualSales || []).length;
  const salesTotal = (snapshot?.actualSales || []).reduce(
    (s, r) => s + r.qtySold * r.actualPricePerUnit,
    0
  );
  const salesSummary =
    salesCount > 0 ? ` ActualSalesRecorded=${salesCount} entries totalling ₹${salesTotal}.` : '';

  const setupSummary = snapshot?.stallSetup
    ? ` StallSetup=${snapshot.stallSetup.widthFt}x${snapshot.stallSetup.depthFt}ft (${snapshot.stallSetup.stallType}, style=${snapshot.stallSetup.layoutStyle || 'classic_u'}).`
    : '';

  const researchSummary =
    Array.isArray(snapshot?.marketResearch) && snapshot.marketResearch.length > 0
      ? ` SavedResearch=${snapshot.marketResearch.length} checks (${snapshot.marketResearch.filter((r) => r.grounded).length} web-grounded).`
      : '';

  const stateContext = snapshot
    ? `Current active project: Project="${projectLabel}" (${projectType}), Event/Business="${snapshot.eventName}"${
        snapshot.eventLocation ? ` (${snapshot.eventLocation})` : ''
      }, Expected Visitors=${snapshot.expectedFootfall > 0 ? snapshot.expectedFootfall : 'not added yet'}, Stall Rent=${
        snapshot.stallFee > 0 ? `₹${snapshot.stallFee}` : 'not added yet'
      }, Active Section="${snapshot.activeTab}".${groupsSummary}${eventCostsSummary}${purchaseSummary}${salesSummary}${setupSummary}${researchSummary}`
    : 'No live workspace state synced yet.';

  const memoryBlock = formatAccountContextBlock(accountContext);

  return `You are StallIQ Coach, a warm, practical small-business & exhibition stall advisor with FULL control over the user's currently active project across Overview, Categories & Products (optimizer), Stall Setup (strategies), and Market Research (research).

${memoryBlock}

${stateContext}

CRITICAL RULES:
1. Speak in plain, everyday small-business language. NEVER use corporate accounting jargon like "CFO", "EBITDA", "contribution margin", or "capital efficiency". Say "expected sales", "stock cost", "event expenses", "expected profit", and "estimated final profit".
2. INVENTORY BUILDER: Whenever the user asks to add products or create categories + products (including multiple items in one message), immediately call 'add_products_to_inventory'.
   - NEVER invent selling prices, quantities, or appeal ratings the user did not mention. Omit optional fields they didn't provide.
   - If the product name or purchase cost is missing, do NOT call 'add_products_to_inventory'—ask ONE brief follow-up question for the missing cost or product name.
   - Only confirm saved products AFTER the tool call succeeds, clearly listing what was added (product name, category, purchase cost, quantity if given, and appeal out of 5 if given).
3. NO FAKE OR DEMO DATA: Never mention or assume "Grand Casa", 10,000 footfall, ₹9,000 rent, or products that are not in the user's live workspace above.
4. SUPPLIER ORDERS: Whenever the user asks to copy, generate, show, or prepare a supplier order or purchase order (full or category), you MUST call the 'get_supplier_order' tool—never write an order summary in prose without calling 'get_supplier_order', because the tool attaches the 1-click Copy Supplier Order card. Supplier orders include ONLY product name, quantity, purchase cost, and subtotals—never selling price or profit.
5. CONFIRMATION RULE: If a tool returns { requiresConfirmation: true }, explain the proposed change clearly and tell the user to click Confirm to apply it.
6. HONESTY RULE: Never invent market research numbers, competitor prices, demand statistics, or fake URLs. Point the user to Market Research for live web-grounded checks.
7. PRIVACY & MEMORY: Use Preferred Name naturally when signed in. Only save durable long-term preferences via 'save_ai_memory' (never raw chat transcripts).
8. Keep replies concise (2-4 crisp sentences) with zero markdown asterisks.`;
}
