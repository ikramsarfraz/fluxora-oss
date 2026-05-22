// Pure validation and cost-control utilities for AI invoice extraction.
// No server-only import — safe to use in tests and shared contexts.

import { z } from "zod";

import { parseInvoiceDate } from "./invoice-date-parsing";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Closed allow-list of unit-of-measure abbreviations the AI is permitted
 * to emit. A server-side resolver maps these (case-insensitively) onto
 * `units_of_measure` rows; anything outside this list collapses to null.
 * Kept small on purpose — adding entries here without a matching seed
 * row will produce orphan abbreviations the form can't render cleanly.
 */
export const AI_UNIT_OF_MEASURE_ALLOWLIST = [
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
export type AiUnitOfMeasure = (typeof AI_UNIT_OF_MEASURE_ALLOWLIST)[number];

// Schema doubles as the OpenAI strict structured-output schema (via
// `zodResponseFormat`). Strict mode forbids `.optional()` and requires every
// property to appear in `required`, so `caseWeights` is `.nullable()` —
// the model emits an array or explicit null, never an omitted key.
const AiInvoiceLineSchema = z.object({
  vendorProductName: z.string(),
  vendorProductDescription: z.string().nullable(),
  quantityCases: z.number().nullable(),
  quantityWeight: z.number().nullable(),
  caseWeights: z.array(z.number()).nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number().nullable(),
  unitType: z
    .enum(["catch_weight", "fixed_case", "per_each", "per_unit"])
    .nullable(),
  /**
   * Free-string UOM (e.g. "case", "gal", "ea"). Validated against the
   * allow-list in `validateExtractionResult` rather than via z.enum so
   * pre-prompt fixtures and stricter prompts can coexist without
   * breaking the strict-output schema requirements.
   */
  unitOfMeasure: z.string().nullable(),
  notes: z.string().nullable(),
});

// NOTE on pack size:
// We previously asked the AI to emit `unitsPerPackage` as a top-level
// schema field. The strict structured-output binding intermittently
// returned a null/empty response on real bills with that field present
// (suspect: model output exceeded the response-format constraints when
// the prompt also grew the unitOfMeasure + per_each/per_unit guidance).
// Moved to a deterministic regex pass on `vendorProductDescription` in
// `extractPackSizeFromDescription` (utils/pack-size.ts) so the AI's
// contract stays minimal AND we still recover the pack size from
// patterns the prompt already encourages it to keep in the description
// ("24 (11 oz) cans per case", "12 PK", "case of 24"). The product's
// default purchase-unit conversion still pre-fills the form when the
// description doesn't carry the pack info.

/**
 * Fee taxonomy. Meat invoices typically carry a small finite set of
 * non-inventory charges; categorizing each lets reports break out COGS
 * overhead by type and lets the charges table flag freight separately
 * from processing.
 */
export const FEE_CATEGORIES = [
  "fuel",
  "freight",
  "processing",
  "inspection",
  "cod",
  "refrigeration",
  "other",
] as const;
export type FeeCategory = (typeof FEE_CATEGORIES)[number];

export const AiExtractionResultSchema = z.object({
  supplierName: z.string().nullable(),
  supplierInvoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  totalAmount: z.number().nullable(),
  subtotal: z.number().nullable(),
  fees: z.array(
    z.object({
      description: z.string(),
      amount: z.number(),
      category: z.enum(FEE_CATEGORIES).nullable(),
    }),
  ),
  lines: z.array(AiInvoiceLineSchema),
  confidence: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  reasoning: z.string(),
});

const AiProductMatchSchema = z.object({
  vendorProductName: z.string(),
  suggestedProductId: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

export const AiProductMatchResultSchema = z.object({
  matches: z.array(AiProductMatchSchema),
});

// Inferred TypeScript types from the Zod schemas — used by the provider
// implementation so types and validation stay in sync.
export type ValidatedExtractionResult = z.infer<typeof AiExtractionResultSchema>;
export type ValidatedProductMatchResult = z.infer<typeof AiProductMatchResultSchema>;
export type ValidatedProductMatch = z.infer<typeof AiProductMatchSchema>;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// A "supplier name" is a business identity, not a number, weight, or money
// amount. The model occasionally pulls a value from a weight or amount column
// into this field; reject anything that doesn't look like a business name.
export function sanitizeSupplierName(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Pure numeric / weight / money tokens (e.g. "12.50", "$45.00", "160.00 lbs").
  if (/^[\s$£€]*-?\d[\d.,\s]*(?:\s*(?:lb|lbs|kg|oz|ea|each|cs|case|cases|pcs?))?[\s$]*$/i.test(trimmed)) {
    return null;
  }

  // Must contain at least two alphabetic characters — otherwise it's not a name.
  const letterCount = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  if (letterCount < 2) return null;

  return trimmed;
}

// OpenAI strict structured outputs require every property to be in `required`,
// so the schema can't mark caseWeights or vendorProductDescription `.optional()`.
// To keep the validator permissive — older prompts and unit-test fixtures omit
// these fields entirely — we backfill them as null on raw lines before handing
// them to Zod. Data from the strict OpenAI path is unaffected because the
// fields are already present.
function backfillOptionalLineFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const patched: Record<string, unknown> = { ...obj };

  if (Array.isArray(obj.lines)) {
    patched.lines = obj.lines.map(line => {
      if (!line || typeof line !== "object") return line;
      const lineObj = line as Record<string, unknown>;
      const next: Record<string, unknown> = { ...lineObj };
      if (!("caseWeights" in next)) next.caseWeights = null;
      if (!("vendorProductDescription" in next))
        next.vendorProductDescription = null;
      // unitOfMeasure was added with the per_each / per_unit modes — older
      // prompts and fixtures don't emit it, so default to null so strict
      // schema validation still passes.
      if (!("unitOfMeasure" in next)) next.unitOfMeasure = null;
      return next;
    });
  }

  // Backfill `category` on fees so older fixtures + pre-taxonomy AI
  // responses still validate. New AI responses will set it explicitly.
  if (Array.isArray(obj.fees)) {
    patched.fees = obj.fees.map(fee => {
      if (!fee || typeof fee !== "object") return fee;
      const feeObj = fee as Record<string, unknown>;
      if (!("category" in feeObj)) {
        return { ...feeObj, category: null };
      }
      return feeObj;
    });
  }

  return patched;
}

export function validateExtractionResult(raw: unknown): ValidatedExtractionResult | null {
  const result = AiExtractionResultSchema.safeParse(backfillOptionalLineFields(raw));
  if (!result.success) return null;

  const data = result.data;

  // Post-parse sanity checks beyond Zod's type system:
  // Confidence must be a whole-number-ish value (model sometimes returns floats).
  data.confidence = Math.round(Math.min(100, Math.max(0, data.confidence)));

  // Drop garbage supplier names (numeric values picked from the table).
  data.supplierName = sanitizeSupplierName(data.supplierName);

  // The form requires strict ISO YYYY-MM-DD but the model often echoes the
  // invoice's printed format ("5/14/2026", "May 14, 2026"). Normalize here
  // so the AI text flow yields ISO before reaching the form.
  data.invoiceDate = parseInvoiceDate(data.invoiceDate);

  // Drop phantom lines: when the model can't read a row clearly it sometimes
  // emits a line with an empty / whitespace name. Those propagate downstream
  // as "Line N" placeholders in the Review UI — block them at the source.
  data.lines = data.lines.filter(line => line.vendorProductName.trim().length > 0);

  // Allow-list lowered for case-insensitive matching. Anything outside
  // the list (or a non-string value) collapses to null so the form
  // doesn't render unparseable abbreviations.
  const uomAllowlist = new Set(
    AI_UNIT_OF_MEASURE_ALLOWLIST.map(u => u.toLowerCase()),
  );
  function sanitizeUnitOfMeasure(raw: unknown): string | null {
    if (raw == null) return null;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return uomAllowlist.has(trimmed.toLowerCase()) ? trimmed : null;
  }

  // Pack-size sanitizer was inlined here when we briefly asked the AI
  // for `unitsPerPackage` as a top-level schema field. That broke
  // OpenAI's strict structured-output reliability on real bills, so
  // pack-size now lives in a deterministic regex pass over
  // `vendorProductDescription` — see `extractPackSizeFromDescription`.

  // Normalize each line's caseWeights: `undefined` → `null`, and drop arrays
  // whose length disagrees with quantityCases (likely a model misread).
  // Also collapse whitespace-only descriptions to null so the UI never has
  // to special-case "empty string vs null".
  data.lines = data.lines.map(line => {
    const description =
      line.vendorProductDescription && line.vendorProductDescription.trim().length > 0
        ? line.vendorProductDescription.trim()
        : null;
    // A description that just repeats the name is noise — suppress it so we
    // don't render the same string twice in the Review row.
    const dedupedDescription =
      description && description.toLowerCase() === line.vendorProductName.trim().toLowerCase()
        ? null
        : description;

    const unitOfMeasure = sanitizeUnitOfMeasure(line.unitOfMeasure);

    const raw = line.caseWeights ?? null;
    if (raw === null) {
      return {
        ...line,
        vendorProductDescription: dedupedDescription,
        caseWeights: null,
        unitOfMeasure,
      };
    }

    const filtered = raw.filter(w => Number.isFinite(w) && w > 0);
    if (filtered.length === 0) {
      return {
        ...line,
        vendorProductDescription: dedupedDescription,
        caseWeights: null,
        unitOfMeasure,
      };
    }

    // Tolerate caseWeights even when quantityCases is null — the merge step
    // can adopt the array length as the case count.
    if (line.quantityCases !== null && filtered.length !== line.quantityCases) {
      return {
        ...line,
        vendorProductDescription: dedupedDescription,
        caseWeights: null,
        unitOfMeasure,
      };
    }

    return {
      ...line,
      vendorProductDescription: dedupedDescription,
      caseWeights: filtered,
      unitOfMeasure,
    };
  });

  // Reject completely empty extractions — if lines and fees are both empty and
  // confidence is 0, it's probably a failed call rather than a valid "no items" invoice.
  if (data.lines.length === 0 && data.fees.length === 0 && data.confidence === 0) {
    return null;
  }

  return data;
}

export function validateProductMatchResult(
  raw: unknown,
  expectedVendorNames: string[],
): ValidatedProductMatchResult | null {
  const result = AiProductMatchResultSchema.safeParse(raw);
  if (!result.success) return null;

  const data = result.data;

  // Ensure every expected vendor name has a corresponding match (AI may omit some).
  // Fill missing ones with null matches rather than crashing.
  const returned = new Map(data.matches.map(m => [m.vendorProductName, m]));
  const fullMatches: ValidatedProductMatch[] = expectedVendorNames.map(name => {
    const existing = returned.get(name);
    if (existing) return existing;
    return {
      vendorProductName: name,
      suggestedProductId: null,
      confidence: 0,
      reasoning: "AI did not return a match for this product.",
    };
  });

  return { matches: fullMatches };
}

// ---------------------------------------------------------------------------
// Cost controls
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_INVOICE_TEXT_CHARS = 30_000;
export const DEFAULT_MAX_PRODUCT_CANDIDATES = 75;

export function truncateInvoiceText(
  text: string,
  maxChars: number = DEFAULT_MAX_INVOICE_TEXT_CHARS,
): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  return truncated + "\n[... invoice text truncated for length ...]";
}

export function limitProductCandidates<T extends { id: string; name: string }>(
  products: T[],
  max: number = DEFAULT_MAX_PRODUCT_CANDIDATES,
): T[] {
  if (products.length <= max) return products;
  // Keep first `max` — caller should pre-sort by relevance if possible.
  return products.slice(0, max);
}

// ---------------------------------------------------------------------------
// Safe JSON parse
// ---------------------------------------------------------------------------

export function safeParseJson(text: string): unknown | null {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Model sometimes wraps with markdown fences — try stripping them.
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Build user messages for AI calls
// ---------------------------------------------------------------------------

// Richer product candidate — optional fields used when available
export type AiProductCandidate = {
  id: string;
  name: string;
  sku: string | null;
  categoryNames?: string[];
  knownAliases?: string[];
};

function formatProductCandidate(p: AiProductCandidate): string {
  const parts: string[] = [`  ${p.id}: ${p.name}`];
  if (p.sku) parts[0] += ` (SKU: ${p.sku})`;
  if (p.categoryNames && p.categoryNames.length > 0) {
    parts[0] += ` [${p.categoryNames.join(", ")}]`;
  }
  if (p.knownAliases && p.knownAliases.length > 0) {
    parts[0] += ` [a.k.a.: ${p.knownAliases.join(", ")}]`;
  }
  return parts[0];
}

export function buildInvoiceExtractionUserMessage(args: {
  filename: string;
  extractedText: string;
  supplierHints: string[];
  candidateSuppliers: Array<{ id: string; name: string }>;
  candidateProducts: AiProductCandidate[];
}): string {
  const parts: string[] = [];

  parts.push(`Filename: ${args.filename}`);

  if (args.supplierHints.length > 0) {
    parts.push(`\nSupplier hints from document: ${args.supplierHints.join(", ")}`);
  }

  if (args.candidateSuppliers.length > 0) {
    parts.push(
      "\nKnown suppliers (match supplierName to one of these, or null):\n" +
        args.candidateSuppliers.map(s => `  ${s.id}: ${s.name}`).join("\n"),
    );
  }

  if (args.candidateProducts.length > 0) {
    parts.push(
      "\nKnown products (attempt to identify line items from these, by ID):\n" +
        args.candidateProducts.map(formatProductCandidate).join("\n"),
    );
  }

  parts.push(
    "\n--- INVOICE TEXT ---\n" + args.extractedText + "\n--- END INVOICE TEXT ---",
  );

  parts.push("\nReturn ONLY valid JSON matching the required schema.");

  return parts.join("\n");
}

export function buildProductMatchUserMessage(args: {
  vendorProductNames: string[];
  candidateProducts: AiProductCandidate[];
}): string {
  const vendorList = args.vendorProductNames
    .map((n, i) => `${i + 1}. "${n}"`)
    .join("\n");

  const catalogList = args.candidateProducts.map(formatProductCandidate).join("\n");

  return [
    "Match each vendor product name to the most likely internal catalog product.",
    "",
    "VENDOR NAMES TO MATCH:",
    vendorList,
    "",
    "INTERNAL PRODUCT CATALOG (use exact IDs from this list):",
    catalogList,
    "",
    "Return ONLY valid JSON. Use null for suggestedProductId when not confident.",
    "You MUST only use product IDs from the list above.",
  ].join("\n");
}
