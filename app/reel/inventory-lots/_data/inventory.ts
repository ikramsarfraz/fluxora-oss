// Mock data for the inventory + lot ledger reel. Centered on Atlantic
// salmon as the drill-down product, with lots aged so the timeline reads:
// one expiring lot (amber), two fresh (green). Plus a small inventory list
// of other SKUs to populate the overview.

export type LotStatus = "fresh" | "expiring-soon" | "drained";

export type Lot = {
  number: string;
  receivedDaysAgo: number;
  expiresInDays: number;
  qtyOriginal: number;
  qtyRemaining: number;
  cost: number;
  status: LotStatus;
};

export type InventoryItem = {
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  lotCount: number;
  expiringSoonLots: number;
  avgCost: number;
  daysOfStock: number;
  lots?: Lot[];
};

export const SALMON_LOTS: Lot[] = [
  {
    number: "L-1245",
    receivedDaysAgo: 6,
    expiresInDays: 2,
    qtyOriginal: 30,
    qtyRemaining: 18,
    cost: 7.2,
    status: "expiring-soon",
  },
  {
    number: "L-1259",
    receivedDaysAgo: 3,
    expiresInDays: 5,
    qtyOriginal: 30,
    qtyRemaining: 24,
    cost: 7.4,
    status: "fresh",
  },
  {
    number: "L-1271",
    receivedDaysAgo: 1,
    expiresInDays: 7,
    qtyOriginal: 30,
    qtyRemaining: 30,
    cost: 7.55,
    status: "fresh",
  },
];

export const INVENTORY: InventoryItem[] = [
  {
    sku: "ATL-SAL-04",
    name: "Atlantic salmon — 4 lb fillets",
    unit: "lb",
    onHand: 72,
    lotCount: 3,
    expiringSoonLots: 1,
    avgCost: 7.38,
    daysOfStock: 4,
    lots: SALMON_LOTS,
  },
  {
    sku: "WAG-RIB-08",
    name: "Wagyu ribeye — 8 oz",
    unit: "ea",
    onHand: 38,
    lotCount: 3,
    expiringSoonLots: 0,
    avgCost: 23.0,
    daysOfStock: 9,
  },
  {
    sku: "TOM-HEI-CS",
    name: "Heirloom tomatoes — case",
    unit: "case",
    onHand: 15,
    lotCount: 2,
    expiringSoonLots: 1,
    avgCost: 22.3,
    daysOfStock: 3,
  },
  {
    sku: "OIL-OLI-1G",
    name: "EVOO — 1 gallon",
    unit: "ea",
    onHand: 24,
    lotCount: 1,
    expiringSoonLots: 0,
    avgCost: 18.5,
    daysOfStock: 22,
  },
  {
    sku: "CHE-PAR-08",
    name: "Parmigiano-Reggiano — 8 oz wedge",
    unit: "ea",
    onHand: 46,
    lotCount: 2,
    expiringSoonLots: 0,
    avgCost: 9.4,
    daysOfStock: 14,
  },
  {
    sku: "MIC-BLU-CR",
    name: "Microgreens — blue pea — crate",
    unit: "crate",
    onHand: 9,
    lotCount: 1,
    expiringSoonLots: 1,
    avgCost: 14.2,
    daysOfStock: 2,
  },
  {
    sku: "BUT-EUR-1LB",
    name: "European butter — 1 lb",
    unit: "lb",
    onHand: 64,
    lotCount: 3,
    expiringSoonLots: 0,
    avgCost: 6.8,
    daysOfStock: 11,
  },
  {
    sku: "BRE-SOR-LOA",
    name: "Sourdough loaf",
    unit: "ea",
    onHand: 32,
    lotCount: 1,
    expiringSoonLots: 0,
    avgCost: 4.2,
    daysOfStock: 5,
  },
  {
    sku: "EGG-PAS-DOZ",
    name: "Pasture eggs — dozen",
    unit: "doz",
    onHand: 110,
    lotCount: 2,
    expiringSoonLots: 0,
    avgCost: 3.85,
    daysOfStock: 8,
  },
];

export type Movement = {
  kind: "received" | "shipped" | "adjustment";
  qty: number;
  ref: string;
  lotNumber: string;
  whenLabel: string;
};

/** Movement ledger for the salmon SKU. Most recent first. */
export const SALMON_MOVEMENTS: Movement[] = [
  {
    kind: "received",
    qty: 30,
    ref: "PO-4421",
    lotNumber: "L-1271",
    whenLabel: "1 day ago",
  },
  {
    kind: "shipped",
    qty: -8,
    ref: "SO-2845",
    lotNumber: "L-1245",
    whenLabel: "1 day ago",
  },
  {
    kind: "received",
    qty: 30,
    ref: "PO-4408",
    lotNumber: "L-1259",
    whenLabel: "3 days ago",
  },
  {
    kind: "shipped",
    qty: -6,
    ref: "SO-2841",
    lotNumber: "L-1259",
    whenLabel: "3 days ago",
  },
  {
    kind: "shipped",
    qty: -14,
    ref: "SO-2839",
    lotNumber: "L-1245",
    whenLabel: "4 days ago",
  },
  {
    kind: "received",
    qty: 30,
    ref: "PO-4392",
    lotNumber: "L-1245",
    whenLabel: "6 days ago",
  },
];

/** Sparkline data — on-hand over the past 14 days. */
export const SALMON_ONHAND_TREND = [
  44, 46, 38, 32, 30, 28, 58, 50, 44, 38, 64, 80, 74, 72,
];

export const SUMMARY = {
  skuCount: 73,
  onHandValue: 84212,
  expiringSoonCount: 3,
  expiringSoonLots: 4,
};
