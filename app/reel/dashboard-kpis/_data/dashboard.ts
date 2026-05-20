// Mock data for the dashboard KPIs reel. Numbers chosen so they read as a
// realistic Tuesday morning at a Bay Area seafood + specialty-foods
// distributor: a few overdue customers, healthy margin, some risk in
// inventory.

export type Kpi = {
  key: string;
  label: string;
  /** Final numeric value to count up to. */
  value: number;
  /** "money" | "count" | "percent" — drives formatting. */
  format: "money" | "count" | "percent";
  /** Optional delta vs. previous period, expressed as percent points. */
  deltaPct?: number;
  /** Plain-English period label e.g. "vs. last Tue". */
  deltaLabel?: string;
};

export const TODAY_LABEL = "Tuesday, May 19, 2026";
export const GREETING = "Good morning, Sarah.";

export const KPIS: Kpi[] = [
  {
    key: "revenue",
    label: "Revenue today",
    value: 4287,
    format: "money",
    deltaPct: 12.4,
    deltaLabel: "vs. last Tue",
  },
  {
    key: "openOrders",
    label: "Open orders",
    value: 18,
    format: "count",
    deltaPct: 5.9,
    deltaLabel: "vs. last Tue",
  },
  {
    key: "ar",
    label: "Outstanding AR",
    value: 42180,
    format: "money",
    deltaPct: -3.1,
    deltaLabel: "WTD",
  },
  {
    key: "margin",
    label: "Margin",
    value: 42.7,
    format: "percent",
    deltaPct: 1.4,
    deltaLabel: "vs. 30d avg",
  },
];

// 30 days of revenue (oldest → newest) in dollars. Weekly weekend dips so
// the chart reads like a real distributor's week-over-week cadence.
export const REVENUE_TREND: number[] = [
  3420, 3870, 4180, 3950, 4220, 2380, 1820, 4080, 4310, 4520, 4380, 4150,
  2510, 1920, 4220, 4710, 4880, 4450, 4720, 2640, 2010, 4350, 4920, 5180,
  4860, 4710, 2780, 2240, 4480, 4287,
];

export type AgingBucket = {
  label: string;
  amount: number;
  invoices: number;
  tone: "good" | "warn" | "danger" | "neutral";
};

export const AGING: AgingBucket[] = [
  {
    label: "Current",
    amount: 24180,
    invoices: 14,
    tone: "good",
  },
  {
    label: "1–30",
    amount: 12400,
    invoices: 8,
    tone: "neutral",
  },
  {
    label: "31–60",
    amount: 4200,
    invoices: 3,
    tone: "warn",
  },
  {
    label: "61–90",
    amount: 1400,
    invoices: 1,
    tone: "danger",
  },
];

export const AR_TOTAL = AGING.reduce((s, b) => s + b.amount, 0);

export type CustomerOwed = {
  name: string;
  city: string;
  outstanding: number;
  oldestInvoiceDays: number;
};

export const TOP_OWING_CUSTOMERS: CustomerOwed[] = [
  {
    name: "Anchor Tavern",
    city: "Tiburon",
    outstanding: 6480,
    oldestInvoiceDays: 38,
  },
  {
    name: "Magnolia Diner",
    city: "Berkeley",
    outstanding: 5210,
    oldestInvoiceDays: 24,
  },
  {
    name: "Lighthouse Cafe",
    city: "San Francisco",
    outstanding: 4880,
    oldestInvoiceDays: 67,
  },
  {
    name: "Vine Street Trattoria",
    city: "San Francisco",
    outstanding: 4120,
    oldestInvoiceDays: 18,
  },
  {
    name: "Ferry Plaza Cafe",
    city: "San Francisco",
    outstanding: 3640,
    oldestInvoiceDays: 11,
  },
];

export type TopSku = {
  sku: string;
  name: string;
  units: number;
  marginPct: number;
  unitsDelta: number;
};

export const TOP_MARGIN_SKUS: TopSku[] = [
  {
    sku: "WAG-RIB-08",
    name: "Wagyu ribeye — 8 oz",
    units: 64,
    marginPct: 51.2,
    unitsDelta: 18,
  },
  {
    sku: "TOM-HEI-CS",
    name: "Heirloom tomatoes — case",
    units: 41,
    marginPct: 47.8,
    unitsDelta: 12,
  },
  {
    sku: "ATL-SAL-04",
    name: "Atlantic salmon — 4 lb fillets",
    units: 188,
    marginPct: 42.4,
    unitsDelta: -3,
  },
  {
    sku: "CHE-PAR-08",
    name: "Parmigiano-Reggiano — 8 oz wedge",
    units: 96,
    marginPct: 38.9,
    unitsDelta: 6,
  },
  {
    sku: "BUT-EUR-1LB",
    name: "European butter — 1 lb",
    units: 124,
    marginPct: 34.1,
    unitsDelta: 4,
  },
];

export type Spotlight = {
  badge: string;
  title: string;
  detail: string;
  tone: "success" | "warning" | "info";
};

export const SPOTLIGHTS: Spotlight[] = [
  {
    badge: "Today's biggest win",
    title: "Olive Branch Catering · 51% margin",
    detail:
      "Wagyu + heirloom run, 12-line order, posted at 7:42 AM. Tier 1 pricing held.",
    tone: "success",
  },
  {
    badge: "Watch this",
    title: "Lighthouse Cafe · 67 days overdue",
    detail:
      "$4,880 sitting past 60 days. Last reach-out logged Apr 28 — nudge today?",
    tone: "warning",
  },
  {
    badge: "Stock at risk",
    title: "Atlantic salmon · L-1245 expires in 2 days",
    detail:
      "18 lb on hand. Anchor Tavern usually clears it — pre-offer at tier price?",
    tone: "info",
  },
];
