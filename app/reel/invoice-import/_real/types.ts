// Reel-specific types. Shapes mirror modules/distribution/supplier-invoices
// (BatchFile / BatchView / ReviewData) but live here so the reel doesn't deep-
// import from the module — keeps the marketing surface decoupled from the
// product's internal types.

export type ReelStep =
  | "bills" // Bills tab (archive of posted bills)
  | "imports-empty" // Imports tab, no files
  | "imports-scanning" // Imports tab, dropzone in "scanning" state
  | "imports-populated" // Imports tab with file rows (the queue)
  | "review" // Review screen for the selected file
  | "imports-reviewed"; // Back to Imports tab after a submit (row marked reviewed)

export type Tab = "bills" | "inbox";

// ---------- Bills archive ----------

export type BillRow = {
  id: string;
  referenceNumber: string;
  supplierName: string;
  invoiceDate: string; // ISO
  totalAmount: number;
  status: "posted" | "draft";
  paymentMethod: string | null;
  receivedAt: string; // human label e.g. "2d ago"
};

// ---------- Bulk landing / Imports tab ----------

export type FileStatus = "reviewed" | "attention" | "needs-review" | "parse-error";

export type FileIssue = { tone: "warn" | "danger"; message: string };

export type BatchFile = {
  id: string;
  name: string;
  supplier: string | null;
  invoiceNumber: string | null;
  lineCount: number;
  totalAmount: number;
  confidence: number; // 0–100
  status: FileStatus;
  issues: FileIssue[];
  elapsedLabel?: string;
};

export type BatchSummary = {
  filesProcessed: number;
  readyToPost: number;
  needsReview: number;
  combinedValue: number;
};

export type BatchView = {
  files: BatchFile[];
  summary: BatchSummary;
};

// ---------- Review screen ----------

export type Supplier = {
  id: string;
  name: string;
  defaultCurrency: string;
  netDays: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  lastCost: number;
};

export type ReviewLineMatchState =
  | { kind: "matched"; productId: string; viaAlias?: boolean; aliasAdded?: boolean }
  | { kind: "candidates"; suggestions: { productId: string; score: number; reason: string }[] }
  | { kind: "unmatched" }
  | { kind: "fee"; account: string };

export type ReviewLine = {
  id: number;
  pdfRowIndex: number;
  description: string;
  qty: number;
  unit: string;
  unitCost: number | null;
  total: number;
  confidence: number; // 0–100
  match: ReviewLineMatchState;
  costDeltaPct?: number; // %, e.g. 25 = +25% vs last cost
  flags?: string[]; // e.g. ["partial-scan"]
};

export type ReviewData = {
  fileId: string;
  fileName: string;
  pages: number;
  parsedInvoiceNumber: string;
  parsedInvoiceDate: string;
  parsedReceiveDate: string;
  declaredTotal: number;
  supplierTypedName: string;
  supplierId: string | null;
  paymentMethod: string;
  notes: string;
  lines: ReviewLine[];
  charges: { id: string; description: string; amount: number; account: string }[];
};

// ---------- Top-level reel state ----------

export type DialogKind =
  | { kind: "none" }
  | { kind: "create-supplier"; prefillName: string }
  | { kind: "create-product"; lineId: number; prefillName: string };

export type Transition =
  | { kind: "none" }
  | { kind: "splash" }
  | { kind: "chapter"; index: number; total: number; title: string; subtitle: string }
  | { kind: "outro" };

export type ReelState = {
  step: ReelStep;
  activeTab: Tab;
  // Imports tab data
  view: BatchView;
  // Active review (when step === "review")
  review: ReviewData | null;
  // Highlighting / hover
  activeLineId: number | null;
  // Cosmetic
  scanningElapsedSeconds: number;
  // Review screen extras
  headerCollapsed: boolean;
  dialog: DialogKind;
  // Reel-only chrome — splash card on open, chapter pill at phase changes,
  // outro at the end. Drawn over the surface, doesn't otherwise affect state.
  transition: Transition;
};
