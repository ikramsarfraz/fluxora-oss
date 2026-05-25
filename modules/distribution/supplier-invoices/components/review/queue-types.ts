/**
 * Shape used by the Review Queue Carousel. One entry per pending bulk-import
 * file in the user's batch. Derived in `use-review-queue` from
 * `StoredBulkImportEntry` (localStorage) + the underlying `PipelineResult`.
 */
export type QueueEntry = {
  /** localStorage key — `fluxora:bulk-import:…`. Doubles as the queue card id. */
  key: string;
  fileName: string;
  /** Short label for the queue card row 1 (supplier name or filename fallback). */
  supplierShort: string;
  /** Short label for the queue card row 2 (invoice # or "no invoice #"). */
  invoiceShort: string;
  /** Bill total in dollars — used in queue card row 2. */
  total: number;
  /** Total number of product + fee lines for the L{n} pip. */
  lineCount: number;
  /** Lines that still need a product match (drives the "n to fix" status). */
  needsReviewCount: number;
  /** True when the parser matched a known supplier — drives the yellow dot. */
  supplierMatched: boolean;
  /** Resolved supplier id when matched — used to look up the supplier-
   *  performance badge that hints at how messy this invoice is likely to be
   *  before the user opens it. Null when the supplier is still unmatched. */
  supplierId?: string | null;
};
