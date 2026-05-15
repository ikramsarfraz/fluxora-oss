// Pure validation and cost-control utilities for AI invoice extraction.
// No server-only import — safe to use in tests and shared contexts.

import { z } from "zod";

import { parseInvoiceDate } from "./invoice-date-parsing";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

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
  unitType: z.enum(["catch_weight", "fixed_case"]).nullable(),
  notes: z.string().nullable(),
});

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
  if (!Array.isArray(obj.lines)) return obj;
  return {
    ...obj,
    lines: obj.lines.map(line => {
      if (!line || typeof line !== "object") return line;
      const lineObj = line as Record<string, unknown>;
      const patched: Record<string, unknown> = { ...lineObj };
      if (!("caseWeights" in patched)) patched.caseWeights = null;
      if (!("vendorProductDescription" in patched))
        patched.vendorProductDescription = null;
      return patched;
    }),
  };
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

    const raw = line.caseWeights ?? null;
    if (raw === null) {
      return { ...line, vendorProductDescription: dedupedDescription, caseWeights: null };
    }

    const filtered = raw.filter(w => Number.isFinite(w) && w > 0);
    if (filtered.length === 0) {
      return { ...line, vendorProductDescription: dedupedDescription, caseWeights: null };
    }

    // Tolerate caseWeights even when quantityCases is null — the merge step
    // can adopt the array length as the case count.
    if (line.quantityCases !== null && filtered.length !== line.quantityCases) {
      return { ...line, vendorProductDescription: dedupedDescription, caseWeights: null };
    }

    return {
      ...line,
      vendorProductDescription: dedupedDescription,
      caseWeights: filtered,
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
