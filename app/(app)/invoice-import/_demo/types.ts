export type DemoStep =
  | "inventory"
  | "upload"
  | "scanning"
  | "queue"
  | "review"
  | "saving"
  | "saved";

export const DEMO_STEPS: { id: DemoStep; label: string; index: number; total: number }[] = [
  { id: "inventory", label: "Inventory", index: 1, total: 11 },
  { id: "upload", label: "Upload invoices", index: 2, total: 11 },
  { id: "scanning", label: "Scanning", index: 3, total: 11 },
  { id: "queue", label: "Review queue", index: 4, total: 11 },
  { id: "review", label: "Review invoice", index: 5, total: 11 },
  { id: "saving", label: "Save", index: 10, total: 11 },
  { id: "saved", label: "Inventory — updated", index: 11, total: 11 },
];

export type Unit = "each" | "box" | "case" | "lb" | "kg";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: Unit;
  lastCost: number;
  currentStock: number;
  recentlyUpdated?: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  defaultCurrency: string;
  netDays: number;
};

export type ProductSuggestion = {
  productId: string;
  score: number;
  reason: string;
};

export type MatchState =
  | "auto-matched"
  | "suggested"
  | "unmatched"
  | "created"
  | "non-inventory";

export type NonInventoryCategory = "shipping" | "fees" | "tax" | "other";

export type NewProductDraft = {
  name: string;
  sku: string;
  category: string;
  unit: Unit;
  cost: number;
};

export type LineIssueCode =
  | "missing-cost"
  | "qty-zero"
  | "cost-spike"
  | "low-confidence"
  | "currency-mismatch";

export type LineIssue = {
  type: "error" | "warning";
  code: LineIssueCode;
  message: string;
  detail?: string;
};

export type LineKind = "inventory" | "non-inventory";

export type LineItem = {
  id: string;
  pdfRowIndex: number;
  description: string;
  qty: number;
  unitCost: number | null;
  total: number;
  kind: LineKind;
  matchState: MatchState;
  matchedProductId: string | null;
  suggestions: ProductSuggestion[];
  aliasAdded?: boolean;
  newProductDraft?: NewProductDraft;
  nonInventoryCategory?: NonInventoryCategory;
  expenseAccount?: string;
  confidence: number;
  rawMatchHint?: string;
};

export type HeaderIssueCode =
  | "no-supplier"
  | "total-mismatch"
  | "duplicate-invoice"
  | "currency-mismatch";

export type HeaderIssue = {
  type: "error" | "warning";
  code: HeaderIssueCode;
  message: string;
  detail?: string;
};

export type FileScanStage =
  | "queued"
  | "scanning"
  | "extracting"
  | "matching"
  | "ready";

export type UploadedFile = {
  id: string;
  filename: string;
  sizeBytes: number;
  pages: number;
  stage: FileScanStage;
  progress: number;
};

export type ImportedInvoice = {
  id: string;
  fileId: string;
  filename: string;
  supplierName: string;
  supplierId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  declaredTotal: number;
  lines: LineItem[];
  headerIssues: HeaderIssue[];
  status: "ready" | "reviewing" | "saved";
};

export type SaveSummary = {
  invoiceNumber: string;
  supplierName: string;
  productsCreated: number;
  productsUpdated: number;
  aliasesAdded: number;
  nonInventoryPosted: number;
  totalAmount: number;
};

export type DemoState = {
  step: DemoStep;
  files: UploadedFile[];
  invoices: ImportedInvoice[];
  selectedInvoiceId: string | null;
  saveSummary: SaveSummary | null;
  products: Product[];
  suppliers: Supplier[];
  highlightedLineId: string | null;
};
