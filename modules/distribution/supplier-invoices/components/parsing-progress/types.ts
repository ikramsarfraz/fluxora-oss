export type StageStatus = "done" | "running" | "queued";

export type ParseStage = {
  id: string;
  label: string;
  status: StageStatus;
  /** Small detail line under the stage label. Rendered in mono when the stage is running. */
  detail?: string;
  /** Right-side time. Use `live` while running, e.g. `0.6s` when done, empty when queued. */
  time?: string;
};

export type StreamingLineState = "parsed" | "parsing" | "pending";

export type StreamingLine = {
  id: number;
  state: StreamingLineState;
  /** Raw OCR text. Omit when state is `pending`. */
  raw?: string;
  /** Formatted total (e.g. `$370.73`). Only shown when state is `parsed`. */
  total?: string;
};

export type PreviewHeader = {
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  total?: string;
};

export type ParseJobView = {
  fileName: string;
  fileSizeLabel: string;
  uploadedLabel: string;
  elapsedSeconds: number;
  overallProgress: number;
  stages: ParseStage[];
  header: PreviewHeader;
  lines: StreamingLine[];
  /** "6 of 9" — pre-formatted so the caller controls phrasing. */
  lineCountLabel: string;
  averageParseLabel?: string;
};
