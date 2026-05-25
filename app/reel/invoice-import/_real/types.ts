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

export type FeeCategory =
  | "fuel"
  | "freight"
  | "processing"
  | "inspection"
  | "cod"
  | "refrigeration"
  | "other";

export type ReviewLineMatchState =
  | {
      kind: "matched";
      productId: string;
      productName: string;
      sku: string;
      score: number;
      warning?: boolean;
      viaAlias?: boolean;
      aliasAdded?: boolean;
    }
  | {
      kind: "candidates";
      suggestions: { productId: string; productName: string; sku: string; score: number }[];
    }
  | { kind: "unmatched" }
  | { kind: "fee"; account: string };

export type ReviewLine = {
  id: number;
  pdfRowIndex: number;
  raw: string; // raw OCR text — production renders as the monospace "RawText" line
  description: string;
  qty: number;
  unit: string;
  unitCost: number | null;
  total: number;
  cases: number;
  weight: number; // in lbs, 0 for fee lines
  unitPrice: number; // $ per case or per lb
  confidence: number; // 0–100
  match: ReviewLineMatchState;
  feeCategory?: FeeCategory; // only when match.kind === "fee"
  costDeltaPct?: number; // %, e.g. 25 = +25% vs last cost
  flags?: string[]; // e.g. ["partial-scan"]
};

// Price-change banner data
export type PriceDeviation = {
  productId: string;
  productName: string;
  lastUnitPrice: number;
  parsedUnitPrice: number;
  deviationPct: number;
};

// Duplicate-invoice banner data
export type DuplicateMatch = {
  id: string;
  referenceNumber: string;
  invoiceDate: string;
  totalAmount: string;
  status: string;
  matchedBy?: "invoice_number" | "date_and_total";
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
  priceDeviations: PriceDeviation[];
  duplicateMatches: DuplicateMatch[];
};

// Review filter — controls the line-items segmented filter
export type ReviewFilter = "all" | "needs" | "matched" | "fees";

export type ReviewCounts = {
  total: number;
  matched: number;
  needsReview: number;
  fees: number;
};

// ---------- Top-level reel state ----------

export type DialogKind =
  | { kind: "none" }
  | { kind: "create-supplier"; prefillName: string }
  | { kind: "create-product"; lineId: number; prefillName: string };

export type Transition =
  | { kind: "none" }
  | { kind: "splash" }
  | {
      kind: "explainer";
      eyebrow: string;
      title: string;
      body: string;
      visual: ExplainerVisual;
    }
  | { kind: "chapter"; index: number; total: number; title: string; subtitle: string }
  | { kind: "interstitial"; icon: InterstitialIcon; title: string; body: string }
  | { kind: "outro" };

export type InterstitialIcon =
  | "check" // green checkmark
  | "sparkle" // forest sparkle
  | "package" // box icon (post / inventory updated)
  | "scan"; // OCR / scanning glyph

/** Decorative glyph trio shown at the top of an explainer card. */
export type ExplainerVisual =
  | "pdf-to-stock" // PDF → arrow → Boxes (frames the whole flow)
  | "ai-match" // Sparkles surrounded by candidate chips (matching story)
  | "five-effects" // single button → five fanning-out outcome icons (submit story)
  | "memory"; // database/repeat glyph (next time is faster)

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
  // When true, the open dialog shows its "Creating…" pending state. The
  // autopilot flips this between the cursor click and the actual close so
  // the user visibly sees the dialog react before disappearing.
  dialogPending: boolean;
  // Reel-only chrome — splash card on open, chapter pill at phase changes,
  // outro at the end. Drawn over the surface, doesn't otherwise affect state.
  transition: Transition;
};
