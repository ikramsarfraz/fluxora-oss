// Pure constants — no server-only imports, safe to import from tests.
//
// Receipts are far simpler than supplier invoices (no line-item table, no
// catch_weight / fixed_case dance, no per-supplier alias resolution) so this
// prompt + schema is intentionally smaller than `vision-prompts.ts` in the
// supplier-invoices module. We extract only what the expense form needs to
// prefill — vendor, date, total — plus a couple of soft hints.

import { z } from "zod";

export const RECEIPT_EXTRACTION_SYSTEM_PROMPT = `
You visually read business expense receipts. The file is provided as either a
PDF or an image; read it VISUALLY and return only what's clearly printed.

ABSOLUTE RULES:
- Never invent a vendor name, date, or amount. Return null for anything you
  cannot read with confidence.
- Preserve exact numeric values — never round, never reformat.
- The "total" is the FINAL amount charged (tax + tip included). If a tip is
  written in by hand on top of a card slip, include it.

FIELD GUIDANCE:
- vendorName: the business name printed at the top of the receipt (e.g.
  "Shell", "Costco Wholesale", "Acme Hardware"). NOT the cashier name, not the
  address, not the credit card brand. Strip trailing "STORE #1234" / location
  qualifiers.
- transactionDate: ISO YYYY-MM-DD. Convert "05/14/2026", "May 14 2026",
  "14-MAY-26" etc. Assume US M/D/Y when ambiguous. If only "12:43 PM" is
  visible (no date), return null.
- totalAmount: a positive decimal string with 2 decimal places (e.g.
  "42.18"). Strip currency symbols. If multiple totals appear (subtotal,
  tax, total) pick the FINAL/grand total.
- currency: ISO 4217 (e.g. "USD", "CAD", "EUR") if a currency symbol or
  code is printed; null otherwise. Most US receipts only show "$" → "USD".
- paymentMethodHint: one of "card", "cash", "check", "ach", "other" when
  clearly indicated ("VISA ****1234", "CASH", "CHECK #102"); null when
  unclear. This is a HINT — the user picks the final value in the form.

confidence (0-100):
- > 80 only when vendor, date, and total are all clearly visible.
- < 50 if the receipt is partially cropped, glare-blocked, or the date /
  total can't be read.
`.trim();

/**
 * Strict structured-outputs schema. The OpenAI SDK's `zodResponseFormat`
 * helper requires every field to be present, so optional fields are modeled
 * as nullable rather than `.optional()`.
 */
export const ReceiptExtractionPayloadSchema = z
  .object({
    vendorName: z.string().nullable(),
    transactionDate: z.string().nullable(),
    totalAmount: z.string().nullable(),
    currency: z.string().nullable(),
    paymentMethodHint: z
      .enum(["card", "cash", "check", "ach", "other"])
      .nullable(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
  })
  .strict();

export type ReceiptExtractionPayload = z.infer<
  typeof ReceiptExtractionPayloadSchema
>;

export function buildReceiptUserMessage(args: { filename: string }): string {
  return [
    `Filename: ${args.filename}`,
    "",
    "Visually read this receipt and return the structured fields. Return ONLY valid JSON matching the schema.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Post-validation — defensive shaping the SDK can't enforce, e.g. ISO-date
// normalization and amount sanity. Returns null when the payload should be
// treated as a failure even though the SDK parse succeeded.
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export function validateReceiptPayload(
  raw: unknown,
): ReceiptExtractionPayload | null {
  const parsed = ReceiptExtractionPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;

  // Date format guard — model occasionally returns "2026" or "May 2026"; we
  // want a real ISO date or null, not partial junk. Same shape as the
  // supplier-invoice validator.
  if (data.transactionDate !== null && !ISO_DATE_RE.test(data.transactionDate)) {
    return { ...data, transactionDate: null };
  }
  // Total format guard — must be a plain positive decimal. Strip commas (the
  // prompt forbids them but model adherence is imperfect on international
  // receipts).
  let total = data.totalAmount;
  if (total !== null) {
    total = total.replace(/,/g, "");
    if (!AMOUNT_RE.test(total) || Number(total) < 0) total = null;
  }
  // Vendor — strip surrounding whitespace + collapse internal runs. An empty
  // string after trim collapses to null so the form doesn't render a blank
  // prefill chip.
  let vendor = data.vendorName;
  if (vendor !== null) {
    vendor = vendor.trim().replace(/\s+/g, " ");
    if (vendor.length === 0) vendor = null;
  }

  return {
    ...data,
    vendorName: vendor,
    totalAmount: total,
  };
}
