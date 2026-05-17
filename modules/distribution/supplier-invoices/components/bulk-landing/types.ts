export type BatchFileStatus =
  | "reviewed"
  | "attention"
  | "needs-review"
  /** Server-side parse failed (AI connection error, refusal, etc.). The row
   *  is in the queue so the user knows where their upload went; the only
   *  current recovery is to re-upload the PDF. The Re-parse handler that
   *  would retry against the same R2 object is parked — tracked separately. */
  | "parse-error";

export type BatchFileIssue = {
  /** Tone of the icon — `warn` (orange) or `danger` (red). */
  tone: "warn" | "danger";
  message: string;
};

export type BatchFile = {
  id: string;
  name: string;
  /** Supplier display name; null when the parse couldn't resolve one. */
  supplier: string | null;
  /** Invoice number from the PDF; null when not extracted. */
  invoiceNumber: string | null;
  lineCount: number;
  totalAmount: number;
  /** 0–100. */
  confidence: number;
  status: BatchFileStatus;
  issues: BatchFileIssue[];
  /** Free-form relative-time label, e.g. "2m ago". */
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

export type BatchFilter = "all" | "needs" | "reviewed";
