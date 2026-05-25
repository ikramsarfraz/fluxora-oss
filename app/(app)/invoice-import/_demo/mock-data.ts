import type {
  DemoState,
  ImportedInvoice,
  LineItem,
  Product,
  Supplier,
  UploadedFile,
} from "./types";

export const SEED_PRODUCTS: Product[] = [
  {
    id: "prod_widget_12",
    sku: "WID-12-BLK",
    name: "Widget — 12 inch, black",
    category: "Hardware",
    unit: "each",
    lastCost: 8.4,
    currentStock: 184,
  },
  {
    id: "prod_widget_8",
    sku: "WID-08-BLK",
    name: "Widget — 8 inch, black",
    category: "Hardware",
    unit: "each",
    lastCost: 6.1,
    currentStock: 312,
  },
  {
    id: "prod_bracket_l",
    sku: "BRK-L-STL",
    name: "L-Bracket — steel, large",
    category: "Hardware",
    unit: "each",
    lastCost: 3.25,
    currentStock: 68,
  },
  {
    id: "prod_fastener_kit",
    sku: "FST-KIT-100",
    name: "Fastener kit — 100ct assorted",
    category: "Hardware",
    unit: "box",
    lastCost: 14.5,
    currentStock: 22,
  },
  {
    id: "prod_grease_can",
    sku: "GRS-LUB-32",
    name: "Multi-purpose grease — 32oz",
    category: "Consumables",
    unit: "each",
    lastCost: 11.2,
    currentStock: 41,
  },
  {
    id: "prod_belt_a52",
    sku: "BLT-A52-V",
    name: "V-belt — A52",
    category: "Drive components",
    unit: "each",
    lastCost: 9.15,
    currentStock: 17,
  },
  {
    id: "prod_motor_mount",
    sku: "MM-1HP-STD",
    name: "Motor mount — 1HP standard",
    category: "Drive components",
    unit: "each",
    lastCost: 24.0,
    currentStock: 8,
  },
  {
    id: "prod_seal_kit_b",
    sku: "SEAL-B-KIT",
    name: "Shaft seal kit — series B",
    category: "Drive components",
    unit: "box",
    lastCost: 18.75,
    currentStock: 14,
  },
  {
    id: "prod_zip_ties",
    sku: "ZT-08-100",
    name: "Zip ties — 8in, 100ct",
    category: "Consumables",
    unit: "box",
    lastCost: 4.6,
    currentStock: 56,
  },
  {
    id: "prod_oil_drum",
    sku: "OIL-SAE-30",
    name: "SAE 30 oil — 5 gal",
    category: "Consumables",
    unit: "each",
    lastCost: 38.5,
    currentStock: 12,
  },
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup_apex",
    name: "Apex Industrial Supply",
    defaultCurrency: "USD",
    netDays: 30,
  },
  {
    id: "sup_meridian",
    name: "Meridian Parts Co.",
    defaultCurrency: "USD",
    netDays: 15,
  },
  {
    id: "sup_dunbar",
    name: "Dunbar & Sons Hardware",
    defaultCurrency: "USD",
    netDays: 45,
  },
];

export const INITIAL_FILE: UploadedFile = {
  id: "file_inv2847",
  filename: "INV-2847 Northwind.pdf",
  sizeBytes: 218_443,
  pages: 2,
  stage: "queued",
  progress: 0,
};

export const SECONDARY_FILE: UploadedFile = {
  id: "file_inv2848",
  filename: "INV-2851 Apex backorder.pdf",
  sizeBytes: 96_104,
  pages: 1,
  stage: "queued",
  progress: 0,
};

function lineItem(partial: Partial<LineItem> & Pick<LineItem, "id" | "description" | "qty" | "unitCost" | "total">): LineItem {
  return {
    pdfRowIndex: 0,
    kind: "inventory",
    matchState: "unmatched",
    matchedProductId: null,
    suggestions: [],
    confidence: 0,
    ...partial,
  };
}

export const NORTHWIND_INVOICE: ImportedInvoice = {
  id: "inv_2847",
  fileId: "file_inv2847",
  filename: "INV-2847 Northwind.pdf",
  supplierName: "Northwind Trading Co.",
  supplierId: null,
  invoiceNumber: "INV-2847",
  invoiceDate: "2026-05-12",
  dueDate: "2026-06-11",
  currency: "USD",
  declaredTotal: 1_325.5,
  headerIssues: [],
  status: "ready",
  lines: [
    lineItem({
      id: "line_1",
      pdfRowIndex: 0,
      description: "Widget 12in BLK",
      qty: 48,
      unitCost: 8.4,
      total: 403.2,
      matchState: "auto-matched",
      matchedProductId: "prod_widget_12",
      confidence: 0.97,
      rawMatchHint: "alias: Widget 12in BLK",
    }),
    lineItem({
      id: "line_2",
      pdfRowIndex: 1,
      description: "Widget 8in BLK — partial scan",
      qty: 36,
      unitCost: null,
      total: 0,
      matchState: "auto-matched",
      matchedProductId: "prod_widget_8",
      confidence: 0.94,
      rawMatchHint: "alias: Widget 8in BLK",
    }),
    lineItem({
      id: "line_3",
      pdfRowIndex: 2,
      description: "L-Bracket Steel LRG",
      qty: 24,
      unitCost: 3.95,
      total: 94.8,
      matchState: "suggested",
      matchedProductId: null,
      confidence: 0.78,
      suggestions: [
        { productId: "prod_bracket_l", score: 0.86, reason: "Name similarity" },
        { productId: "prod_motor_mount", score: 0.31, reason: "Same category" },
      ],
    }),
    lineItem({
      id: "line_4",
      pdfRowIndex: 3,
      description: "Acme Fastener Variety Pack 100",
      qty: 6,
      unitCost: 14.85,
      total: 89.1,
      matchState: "suggested",
      matchedProductId: null,
      confidence: 0.62,
      suggestions: [
        { productId: "prod_fastener_kit", score: 0.71, reason: "Description match" },
        { productId: "prod_zip_ties", score: 0.28, reason: "Same category" },
      ],
    }),
    lineItem({
      id: "line_5",
      pdfRowIndex: 4,
      description: "Pneumatic actuator — 1.5\" stroke, model NW-PA15",
      qty: 4,
      unitCost: 62.5,
      total: 250.0,
      matchState: "unmatched",
      matchedProductId: null,
      confidence: 0.18,
      newProductDraft: {
        name: "Pneumatic actuator — 1.5\" stroke",
        sku: "PA-1.5-NW",
        category: "Drive components",
        unit: "each",
        cost: 62.5,
      },
    }),
    lineItem({
      id: "line_6",
      pdfRowIndex: 5,
      description: "V-belt A52",
      qty: 10,
      unitCost: 11.45,
      total: 114.5,
      matchState: "auto-matched",
      matchedProductId: "prod_belt_a52",
      confidence: 0.99,
      rawMatchHint: "alias: V-belt A52",
    }),
    lineItem({
      id: "line_7",
      pdfRowIndex: 6,
      description: "Freight & handling",
      qty: 1,
      unitCost: 84.0,
      total: 84.0,
      kind: "non-inventory",
      matchState: "non-inventory",
      nonInventoryCategory: "shipping",
      expenseAccount: "5210 — Freight in",
      confidence: 0.96,
    }),
    lineItem({
      id: "line_8",
      pdfRowIndex: 7,
      description: "Fuel surcharge",
      qty: 1,
      unitCost: 18.5,
      total: 18.5,
      kind: "non-inventory",
      matchState: "non-inventory",
      nonInventoryCategory: "fees",
      expenseAccount: "5215 — Fuel surcharges",
      confidence: 0.92,
    }),
    lineItem({
      id: "line_9",
      pdfRowIndex: 8,
      description: "Pallet deposit (refundable)",
      qty: 2,
      unitCost: 25.0,
      total: 50.0,
      kind: "non-inventory",
      matchState: "non-inventory",
      nonInventoryCategory: "other",
      expenseAccount: "1810 — Deposits held",
      confidence: 0.88,
    }),
  ],
};

export function createInitialState(): DemoState {
  return {
    step: "inventory",
    files: [],
    invoices: [],
    selectedInvoiceId: null,
    saveSummary: null,
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    suppliers: SEED_SUPPLIERS.map((s) => ({ ...s })),
    highlightedLineId: null,
  };
}

export function lineSubtotal(line: LineItem): number {
  if (line.unitCost == null) return 0;
  return Number((line.unitCost * line.qty).toFixed(2));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
