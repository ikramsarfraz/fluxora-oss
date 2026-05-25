// Mock data for the sales-order + FIFO reel. The story: Anchor Tavern calls
// in their weekly seafood order. Three line items, each pulling from a
// realistic stack of lots so the FIFO allocation reads as obviously
// oldest-first.

export type Customer = {
  name: string;
  abbreviation: string;
  city: string;
  state: string;
  tier: string;
  terms: string;
  lifetimeRevenue: string;
  lastOrder: string;
  notes: string;
};

export const CUSTOMER: Customer = {
  name: "Anchor Tavern",
  abbreviation: "ANC",
  city: "Tiburon",
  state: "CA",
  tier: "Tier 2",
  terms: "Net 7",
  lifetimeRevenue: "$42,180",
  lastOrder: "3 days ago",
  notes:
    "Calls every Tuesday. Prefers older lots — happy to take expiring stock at the tier price.",
};

export type Lot = {
  number: string;
  receivedDaysAgo: number;
  qtyRemaining: number; // lbs or units, depending on the product
  cost: number; // $/unit
};

export type Product = {
  sku: string;
  name: string;
  unit: string; // "lb" / "case" / "ea"
  tierPrice: number; // $/unit at customer's tier
  /** Lots are listed in receipt order (oldest first). FIFO pulls from the top. */
  lots: Lot[];
  /** Quantity the customer ordered. Drives the FIFO allocation. */
  orderQty: number;
};

export const PRODUCTS: Product[] = [
  {
    sku: "ATL-SAL-04",
    name: "Atlantic salmon — 4 lb fillets",
    unit: "lb",
    tierPrice: 11.5,
    orderQty: 32,
    lots: [
      { number: "L-1245", receivedDaysAgo: 6, qtyRemaining: 18, cost: 7.2 },
      { number: "L-1259", receivedDaysAgo: 3, qtyRemaining: 24, cost: 7.4 },
      { number: "L-1271", receivedDaysAgo: 1, qtyRemaining: 30, cost: 7.55 },
    ],
  },
  {
    sku: "WAG-RIB-08",
    name: "Wagyu ribeye — 8 oz portion",
    unit: "ea",
    tierPrice: 32.0,
    orderQty: 14,
    lots: [
      { number: "L-1198", receivedDaysAgo: 9, qtyRemaining: 6, cost: 22.5 },
      { number: "L-1233", receivedDaysAgo: 4, qtyRemaining: 12, cost: 23.0 },
      { number: "L-1268", receivedDaysAgo: 2, qtyRemaining: 20, cost: 23.4 },
    ],
  },
  {
    sku: "TOM-HEI-CS",
    name: "Heirloom tomatoes — case",
    unit: "case",
    tierPrice: 38.0,
    orderQty: 8,
    lots: [
      { number: "L-1252", receivedDaysAgo: 4, qtyRemaining: 5, cost: 22.0 },
      { number: "L-1266", receivedDaysAgo: 2, qtyRemaining: 10, cost: 22.5 },
    ],
  },
];

/** Walks the FIFO algorithm — oldest lot first — to allocate `qty` units. */
export function allocateFifo(
  lots: Lot[],
  qty: number,
): { lotNumber: string; pulled: number; cost: number }[] {
  const allocation: { lotNumber: string; pulled: number; cost: number }[] = [];
  let remaining = qty;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const pulled = Math.min(lot.qtyRemaining, remaining);
    if (pulled > 0) {
      allocation.push({
        lotNumber: lot.number,
        pulled,
        cost: lot.cost,
      });
      remaining -= pulled;
    }
  }
  return allocation;
}

/** Weighted-average cost of an allocation, in $/unit. */
export function avgCost(
  allocation: { pulled: number; cost: number }[],
): number {
  if (allocation.length === 0) return 0;
  const totalCost = allocation.reduce((acc, a) => acc + a.pulled * a.cost, 0);
  const totalQty = allocation.reduce((acc, a) => acc + a.pulled, 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

export const ORDER_NUMBER = "SO-2847";
export const ORDER_DATE = "May 19, 2026";
