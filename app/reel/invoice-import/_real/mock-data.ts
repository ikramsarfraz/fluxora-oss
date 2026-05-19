import type {
  BillRow,
  BatchFile,
  BatchView,
  Product,
  ReelState,
  ReviewData,
  Supplier,
} from "./types";

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: "sup_apex", name: "Apex Industrial Supply", defaultCurrency: "USD", netDays: 30 },
  { id: "sup_meridian", name: "Meridian Parts Co.", defaultCurrency: "USD", netDays: 15 },
  { id: "sup_dunbar", name: "Dunbar & Sons Hardware", defaultCurrency: "USD", netDays: 45 },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: "prod_widget_12", sku: "WID-12-BLK", name: "Widget — 12 inch, black", category: "Hardware", unit: "each", lastCost: 8.4 },
  { id: "prod_widget_8", sku: "WID-08-BLK", name: "Widget — 8 inch, black", category: "Hardware", unit: "each", lastCost: 6.1 },
  { id: "prod_bracket_l", sku: "BRK-L-STL", name: "L-Bracket — steel, large", category: "Hardware", unit: "each", lastCost: 3.25 },
  { id: "prod_fastener_kit", sku: "FST-KIT-100", name: "Fastener kit — 100ct assorted", category: "Hardware", unit: "box", lastCost: 14.5 },
  { id: "prod_belt_a52", sku: "BLT-A52-V", name: "V-belt — A52", category: "Drive components", unit: "each", lastCost: 9.15 },
  { id: "prod_grease_can", sku: "GRS-LUB-32", name: "Multi-purpose grease — 32oz", category: "Consumables", unit: "each", lastCost: 11.2 },
];

// Bills archive — posted bills already in the system. Stays static through the reel.
export const MOCK_BILLS: BillRow[] = [
  {
    id: "bill_2841",
    referenceNumber: "INV-2841",
    supplierName: "Apex Industrial Supply",
    invoiceDate: "2026-05-08",
    totalAmount: 1_204.5,
    status: "posted",
    paymentMethod: "ACH",
    receivedAt: "4d ago",
  },
  {
    id: "bill_2839",
    referenceNumber: "INV-2839",
    supplierName: "Meridian Parts Co.",
    invoiceDate: "2026-05-06",
    totalAmount: 462.18,
    status: "posted",
    paymentMethod: "Check",
    receivedAt: "6d ago",
  },
  {
    id: "bill_2837",
    referenceNumber: "INV-2837",
    supplierName: "Dunbar & Sons Hardware",
    invoiceDate: "2026-05-02",
    totalAmount: 2_188.4,
    status: "posted",
    paymentMethod: "ACH",
    receivedAt: "10d ago",
  },
  {
    id: "bill_2834",
    referenceNumber: "INV-2834",
    supplierName: "Apex Industrial Supply",
    invoiceDate: "2026-04-28",
    totalAmount: 894.0,
    status: "posted",
    paymentMethod: "ACH",
    receivedAt: "14d ago",
  },
  {
    id: "bill_2829",
    referenceNumber: "INV-2829",
    supplierName: "Meridian Parts Co.",
    invoiceDate: "2026-04-22",
    totalAmount: 1_316.95,
    status: "posted",
    paymentMethod: "Wire",
    receivedAt: "20d ago",
  },
];

// The freshly-scanned file once the dropzone drops it. Starts with low
// confidence + supplier missing + some issues — the reel resolves these via
// the autopilot.
export const FRESH_FILE: BatchFile = {
  id: "file_inv2847",
  name: "INV-2847 Northwind.pdf",
  supplier: null, // supplier was not in the existing catalog
  invoiceNumber: "INV-2847",
  lineCount: 9,
  totalAmount: 1_325.5,
  confidence: 67,
  status: "needs-review",
  issues: [
    { tone: "warn", message: "1 line missing cost" },
    { tone: "warn", message: "2 product matches need confirming" },
  ],
  elapsedLabel: "just now",
};

// Companion files that come up in the same batch. Surfaced as a queue
// carousel on the review screen so the user can tell they're working through
// a batch, not a one-off file.
export const QUEUE_FILES: BatchFile[] = [
  FRESH_FILE,
  {
    id: "file_inv4471",
    name: "INV-4471 Apex backorder.pdf",
    supplier: "Apex Industrial Supply",
    invoiceNumber: "INV-4471",
    lineCount: 4,
    totalAmount: 412.6,
    confidence: 94,
    status: "attention",
    issues: [{ tone: "warn", message: "Cost up 8% vs last bill" }],
    elapsedLabel: "1m ago",
  },
  {
    id: "file_inv8812",
    name: "INV-8812 Meridian May.pdf",
    supplier: "Meridian Parts Co.",
    invoiceNumber: "INV-8812",
    lineCount: 6,
    totalAmount: 884.0,
    confidence: 91,
    status: "needs-review",
    issues: [{ tone: "warn", message: "1 line missing cost" }],
    elapsedLabel: "1m ago",
  },
];

export function emptyView(): BatchView {
  return {
    files: [],
    summary: { filesProcessed: 0, readyToPost: 0, needsReview: 0, combinedValue: 0 },
  };
}

export function batchView(): BatchView {
  return {
    files: QUEUE_FILES,
    summary: {
      filesProcessed: QUEUE_FILES.length,
      readyToPost: 0,
      needsReview: QUEUE_FILES.filter((f) => f.status !== "reviewed").length,
      combinedValue: QUEUE_FILES.reduce((s, f) => s + f.totalAmount, 0),
    },
  };
}

export function reviewedFileView(): BatchView {
  const reviewed = QUEUE_FILES.map((f) =>
    f.id === FRESH_FILE.id
      ? {
          ...f,
          supplier: "Northwind Trading Co.",
          confidence: 99,
          status: "reviewed" as const,
          issues: [],
        }
      : f,
  );
  return {
    files: reviewed,
    summary: {
      filesProcessed: reviewed.length,
      readyToPost: reviewed.filter((f) => f.status === "reviewed").length,
      needsReview: reviewed.filter((f) => f.status !== "reviewed").length,
      combinedValue: reviewed.reduce((s, f) => s + f.totalAmount, 0),
    },
  };
}

export const REVIEW_DATA: ReviewData = {
  fileId: FRESH_FILE.id,
  fileName: FRESH_FILE.name,
  pages: 2,
  parsedInvoiceNumber: "INV-2847",
  parsedInvoiceDate: "2026-05-12",
  parsedReceiveDate: "2026-05-12",
  declaredTotal: 1_325.5,
  supplierTypedName: "Northwind Trading Co.",
  supplierId: null,
  paymentMethod: "ACH",
  notes: "",
  lines: [
    {
      id: 1,
      pdfRowIndex: 0,
      description: "Widget 12in BLK",
      qty: 48,
      unit: "each",
      unitCost: 8.4,
      total: 403.2,
      confidence: 97,
      match: { kind: "matched", productId: "prod_widget_12", viaAlias: true },
    },
    {
      id: 2,
      pdfRowIndex: 1,
      description: "Widget 8in BLK — partial scan",
      qty: 36,
      unit: "each",
      unitCost: null,
      total: 0,
      confidence: 78,
      match: { kind: "matched", productId: "prod_widget_8", viaAlias: true },
      flags: ["partial-scan"],
    },
    {
      id: 3,
      pdfRowIndex: 2,
      description: "L-Bracket Steel LRG",
      qty: 24,
      unit: "each",
      unitCost: 3.95,
      total: 94.8,
      confidence: 78,
      match: {
        kind: "candidates",
        suggestions: [
          { productId: "prod_bracket_l", score: 86, reason: "Name match" },
        ],
      },
    },
    {
      id: 4,
      pdfRowIndex: 3,
      description: "Acme Fastener Variety Pack 100",
      qty: 6,
      unit: "box",
      unitCost: 14.85,
      total: 89.1,
      confidence: 62,
      match: {
        kind: "candidates",
        suggestions: [
          { productId: "prod_fastener_kit", score: 71, reason: "Description match" },
        ],
      },
    },
    {
      id: 5,
      pdfRowIndex: 4,
      description: 'Pneumatic actuator — 1.5" stroke, model NW-PA15',
      qty: 4,
      unit: "each",
      unitCost: 62.5,
      total: 250.0,
      confidence: 18,
      match: { kind: "unmatched" },
    },
    {
      id: 6,
      pdfRowIndex: 5,
      description: "V-belt A52",
      qty: 10,
      unit: "each",
      unitCost: 11.45,
      total: 114.5,
      confidence: 99,
      match: { kind: "matched", productId: "prod_belt_a52", viaAlias: true },
      costDeltaPct: 25,
    },
    {
      id: 7,
      pdfRowIndex: 6,
      description: "Freight & handling",
      qty: 1,
      unit: "each",
      unitCost: 84.0,
      total: 84.0,
      confidence: 96,
      match: { kind: "fee", account: "5210 — Freight in" },
    },
    {
      id: 8,
      pdfRowIndex: 7,
      description: "Fuel surcharge",
      qty: 1,
      unit: "each",
      unitCost: 18.5,
      total: 18.5,
      confidence: 92,
      match: { kind: "fee", account: "5215 — Fuel surcharges" },
    },
    {
      id: 9,
      pdfRowIndex: 8,
      description: "Pallet deposit (refundable)",
      qty: 2,
      unit: "each",
      unitCost: 25.0,
      total: 50.0,
      confidence: 88,
      match: { kind: "fee", account: "1810 — Deposits held" },
    },
  ],
  charges: [],
};

export function initialReelState(): ReelState {
  return {
    step: "bills",
    activeTab: "bills",
    view: emptyView(),
    review: null,
    activeLineId: null,
    scanningElapsedSeconds: 0,
    headerCollapsed: false,
    dialog: { kind: "none" },
  };
}

export function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
