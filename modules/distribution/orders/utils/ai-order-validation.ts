// Pure validation and cost-control utilities for AI sales-order extraction.
// No server-only import — safe to use in tests and shared contexts.
//
// Mirrors the structure of [../../supplier-invoices/utils/ai-validation.ts]:
// a strict Zod schema (doubles as the OpenAI structured-output binding),
// a post-validation pass that does business sanitisation Zod can't express,
// and a couple of cost-bound truncation helpers.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Allow-list
// ---------------------------------------------------------------------------

// Mirrors AI_UNIT_OF_MEASURE_ALLOWLIST in supplier-invoices/utils/ai-validation.ts
// — kept as a parallel const because cross-module value imports between
// distribution domains are discouraged. If this drifts, both lists should
// move to modules/shared/ in a follow-up.
export const AI_ORDER_UNIT_ALLOWLIST = [
  "lb",
  "kg",
  "oz",
  "ea",
  "cs",
  "case",
  "bx",
  "box",
  "bag",
  "gal",
  "L",
  "fl oz",
  "pk",
  "pack",
  "ct",
] as const;
export type AiOrderUnit = (typeof AI_ORDER_UNIT_ALLOWLIST)[number];

// ---------------------------------------------------------------------------
// Zod schemas — bound to OpenAI strict structured outputs, so EVERY field
// must be in `required` and use `.nullable()` rather than `.optional()`.
// ---------------------------------------------------------------------------

const AiOrderLineSchema = z.object({
  productHint: z.string(),
  qty: z.number().nullable(),
  unit: z.string().nullable(),
  weightLbs: z.number().nullable(),
  priceHint: z.number().nullable(),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(100),
});

export const AiOrderExtractionResultSchema = z.object({
  customerHint: z.string().nullable(),
  requestedDate: z.string().nullable(),
  lines: z.array(AiOrderLineSchema),
  customerNotes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  reasoning: z.string(),
});

export type ValidatedOrderExtractionResult = z.infer<
  typeof AiOrderExtractionResultSchema
>;
export type ValidatedOrderExtractionLine =
  ValidatedOrderExtractionResult["lines"][number];

// ---------------------------------------------------------------------------
// Cost-control constants + helpers
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_ORDER_TEXT_CHARS = 8_000;
export const DEFAULT_MAX_CUSTOMER_CANDIDATES = 50;
export const DEFAULT_MAX_ORDER_PRODUCT_CANDIDATES = 75;

// Order messages are short — WhatsApp / SMS / email body. 8K chars is far
// beyond a realistic message; anything bigger is almost certainly a forwarded
// thread or a copy-pasted catalog. Truncating from the END preserves the
// most recent (and usually the actual order) context.
export function truncateOrderText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

export function limitOrderProductCandidates<
  T extends { id: string; name: string },
>(candidates: T[], maxCount: number): T[] {
  if (candidates.length <= maxCount) return candidates;
  return candidates.slice(0, maxCount);
}

export function limitCustomerCandidates<T extends { id: string; name: string }>(
  candidates: T[],
  maxCount: number,
): T[] {
  if (candidates.length <= maxCount) return candidates;
  return candidates.slice(0, maxCount);
}

// ---------------------------------------------------------------------------
// User-message builder — keeps the prompt + serialised context in one place
// so the test fixtures match what the live SDK call sends.
// ---------------------------------------------------------------------------

export function buildOrderExtractionUserMessage(args: {
  rawText: string;
  /** ISO YYYY-MM-DD — used by the prompt to resolve "tomorrow"/"Tuesday"/etc. */
  today: string;
  candidateCustomers: Array<{ id: string; name: string }>;
  candidateProducts: Array<{ id: string; name: string; sku: string | null }>;
}): string {
  const customers = args.candidateCustomers.length
    ? args.candidateCustomers.map(c => `- ${c.name}`).join("\n")
    : "(none — propose a new customer or leave null)";

  const products = args.candidateProducts.length
    ? args.candidateProducts
        .map(p => (p.sku ? `- ${p.name} (sku: ${p.sku})` : `- ${p.name}`))
        .join("\n")
    : "(none — leave productHint as the customer's verbatim phrase)";

  return [
    `Today is ${args.today}. Resolve all relative dates against this.`,
    "",
    "Known customers (preferred names to match):",
    customers,
    "",
    "Product catalog (informational — use these names for matching when the customer's hint is ambiguous):",
    products,
    "",
    "Customer message:",
    "```",
    args.rawText,
    "```",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Post-validation
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Sanitise the AI's `customerHint`: same shape as
// `sanitizeSupplierName` in supplier-invoices — strip pure-numeric / money
// tokens, require at least two alphabetic characters.
export function sanitizeCustomerHint(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[\s$£€]*-?\d[\d.,\s]*$/.test(trimmed)) return null;

  const letterCount = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  if (letterCount < 2) return null;

  return trimmed;
}

export function sanitizeUnit(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  const allowed = AI_ORDER_UNIT_ALLOWLIST.map(u => u.toLowerCase());
  return allowed.includes(lowered) ? trimmed : null;
}

function backfillOptionalLineFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const patched: Record<string, unknown> = { ...obj };

  if (Array.isArray(obj.lines)) {
    patched.lines = obj.lines.map(line => {
      if (!line || typeof line !== "object") return line;
      const lineObj = line as Record<string, unknown>;
      const next: Record<string, unknown> = { ...lineObj };
      if (!("qty" in next)) next.qty = null;
      if (!("unit" in next)) next.unit = null;
      if (!("weightLbs" in next)) next.weightLbs = null;
      if (!("priceHint" in next)) next.priceHint = null;
      if (!("notes" in next)) next.notes = null;
      if (!("confidence" in next)) next.confidence = 0;
      return next;
    });
  }

  if (!("warnings" in patched)) patched.warnings = [];
  if (!("reasoning" in patched)) patched.reasoning = "";

  return patched;
}

export function validateOrderExtractionResult(
  raw: unknown,
): ValidatedOrderExtractionResult | null {
  const result = AiOrderExtractionResultSchema.safeParse(
    backfillOptionalLineFields(raw),
  );
  if (!result.success) return null;

  const data = result.data;

  data.confidence = Math.round(Math.min(100, Math.max(0, data.confidence)));
  data.customerHint = sanitizeCustomerHint(data.customerHint);

  // requestedDate: only accept strict ISO YYYY-MM-DD. The model is instructed
  // to return that format, but it occasionally echoes the raw message format
  // ("next Tuesday"). Rather than re-parse here (date parsing belongs to
  // its own well-tested helper), reject anything non-ISO so the form's
  // optional date field stays empty — the human reviewer will set it.
  if (data.requestedDate && !ISO_DATE_RE.test(data.requestedDate)) {
    data.requestedDate = null;
  }

  // Drop phantom lines: empty productHint or non-positive qty. The prompt
  // tells the model to omit those entirely; this is a defense in depth.
  data.lines = data.lines
    .filter(line => line.productHint.trim().length > 0)
    .filter(line => line.qty !== null && line.qty > 0)
    .map(line => ({
      ...line,
      productHint: line.productHint.trim(),
      unit: sanitizeUnit(line.unit),
      // Negative or zero weights are nonsensical — coerce to null.
      weightLbs:
        line.weightLbs !== null && line.weightLbs > 0 ? line.weightLbs : null,
      // Negative prices are nonsensical; zero is suspicious but legal
      // (gift line). Allow ≥ 0.
      priceHint:
        line.priceHint !== null && line.priceHint >= 0 ? line.priceHint : null,
      notes: line.notes && line.notes.trim().length > 0 ? line.notes : null,
      confidence: Math.round(Math.min(100, Math.max(0, line.confidence))),
    }));

  // Collapse whitespace-only notes to null so the UI never has to special-
  // case "empty string vs null".
  if (data.customerNotes && data.customerNotes.trim().length === 0) {
    data.customerNotes = null;
  }
  if (data.internalNotes && data.internalNotes.trim().length === 0) {
    data.internalNotes = null;
  }

  return data;
}
