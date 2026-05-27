// Types for parseSalesOrderTextAction. Split out of the action file so the
// action's `"use server"` boundary stays pure (only async function exports)
// — matches the convention used by every other actions file in the repo.

import type { AiOrderExtractionErrorCode } from "../services/ai-order-extraction";
import type { CustomerMatchCandidate } from "../services/customer-matching";

export type ParseSalesOrderTextLine = {
  productHint: string;
  qty: number;
  unit: string | null;
  weightLbs: number | null;
  priceHint: number | null;
  notes: string | null;
  confidence: number;
};

export type ParseSalesOrderTextResult = {
  status: "success" | "failed";
  customer: {
    /** Non-null only when the deterministic matcher cleared the auto-fill
     *  threshold (currently 80). Below that, the form should leave the
     *  customer field empty and let the user pick from `candidates`. */
    suggestedId: string | null;
    candidates: CustomerMatchCandidate[];
    /** The AI's raw hint — useful to show as helper text when no match
     *  was confident enough to auto-fill. */
    hint: string | null;
    confidence: number;
  };
  /** ISO YYYY-MM-DD or null. */
  requestedDate: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  lines: ParseSalesOrderTextLine[];
  /** Overall extraction confidence (0-100). */
  confidence: number;
  warnings: string[];
  errorCode: AiOrderExtractionErrorCode | null;
  errorMessage: string | null;
};
