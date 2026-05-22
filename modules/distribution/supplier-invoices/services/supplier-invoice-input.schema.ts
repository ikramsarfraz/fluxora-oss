import "server-only";

import { z } from "zod";

/**
 * Server-side validation for supplier-invoice write actions. The form
 * (`supplier-invoice-form.schema.ts`) validates a richer client-only
 * shape that includes draft state (weightEntryMode, defaultCaseWeight,
 * etc.); these schemas validate the much narrower SHAPE that hits the
 * server — the final `SupplierInvoiceLineInput`, `…ChargeInput`,
 * `…HeaderInput`. Same enums, same regex rules, but trust-boundary
 * enforcement so a malformed client (or a future direct API caller)
 * can't post bad data.
 *
 * Pattern: every action that takes user input parses against one of
 * these and throws on failure. Failures bubble as
 * `SupplierInvoiceValidationError` with the Zod-formatted issues
 * attached so callers can surface field-level errors if they want.
 */

const uuidSchema = z.string().uuid("Must be a valid UUID.");
/**
 * Validates a YYYY-MM-DD string AND that it represents a real calendar
 * date. `Date.parse` is too lenient — it silently rolls "2026-02-30"
 * over to March 2, so we have to round-trip through UTC and confirm
 * the day-of-month matches what we asked for.
 */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine(
    v => {
      const [yStr, mStr, dStr] = v.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (m < 1 || m > 12 || d < 1 || d > 31) return false;
      const utc = new Date(Date.UTC(y, m - 1, d));
      return (
        utc.getUTCFullYear() === y &&
        utc.getUTCMonth() === m - 1 &&
        utc.getUTCDate() === d
      );
    },
    { message: "Date is not a valid calendar date." },
  );
const moneyStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Must be a decimal with up to 4 fraction digits.");
const positiveMoneyStringSchema = moneyStringSchema.refine(
  v => Number(v) >= 0,
  { message: "Must be greater than or equal to 0." },
);

export const supplierInvoicePaymentMethodEnum = z.enum([
  "cash",
  "check",
  "ach",
  "zelle",
  "credit_card",
]);

export const supplierInvoiceChargeTypeEnum = z.enum([
  "freight",
  "fuel",
  "tax",
  "discount",
  // Meat-supplier categories the AI extractor classifies. Kept distinct
  // (rather than collapsed to "other") so reporting + COGS allocation
  // can treat them on their own — e.g. processing/inspection/cod usually
  // belong in landed cost, taxes don't.
  "processing",
  "inspection",
  "cod",
  "refrigeration",
  "other",
]);

export const supplierInvoiceUnitTypeEnum = z.enum([
  "catch_weight",
  "fixed_case",
  "per_each",
  "per_unit",
]);

export const supplierInvoiceHeaderInputSchema = z.object({
  supplierId: uuidSchema,
  invoiceNumber: z
    .string()
    .max(128, "Invoice number is too long (max 128 characters).")
    .nullable(),
  invoiceDate: isoDateSchema,
  receiveDate: isoDateSchema,
  paymentMethod: supplierInvoicePaymentMethodEnum.nullable().optional(),
  notes: z
    .string()
    .max(2000, "Notes are too long (max 2000 characters).")
    .nullable()
    .optional(),
});

export const supplierInvoiceLineInputSchema = z
  .object({
    id: uuidSchema.optional(),
    productId: uuidSchema,
    quantityCases: z
      .number()
      .int("Cases must be a whole number.")
      .min(1, "Cases must be at least 1."),
    weightLbs: moneyStringSchema,
    unitType: supplierInvoiceUnitTypeEnum,
    unitPrice: positiveMoneyStringSchema,
    /**
     * JSON array string of per-case weights. We don't deep-parse here —
     * receiving.ts's `normalizeSupplierInvoiceLine` re-parses, sums, and
     * canonicalises. We just enforce "if present, must be valid JSON
     * that parses to an array of positive numbers" so the downstream
     * normaliser can trust its input.
     */
    caseWeightsLbs: z
      .string()
      .nullable()
      .optional()
      .refine(
        v => {
          if (v == null || v === "") return true;
          try {
            const parsed = JSON.parse(v) as unknown;
            return (
              Array.isArray(parsed) &&
              parsed.every(n => typeof n === "number" && Number.isFinite(n) && n > 0)
            );
          } catch {
            return false;
          }
        },
        {
          message:
            "caseWeightsLbs must be a JSON array of positive numbers when set.",
        },
      ),
    lotNumberOverride: z
      .string()
      .max(128, "Lot number is too long (max 128 characters).")
      .nullable()
      .optional(),
    expirationDateOverride: isoDateSchema.nullable().optional(),
    /**
     * UOM FK for per_each / per_unit lines. Null for weight modes, where
     * the unit is implicit (lb / cs). Validated as a UUID when present.
     */
    purchaseUnitId: uuidSchema.nullable().optional(),
    /**
     * Snapshot abbreviation rendered in the UI (e.g. "ea", "cs", "gal").
     * Server may also derive this from the UOM table when only the FK is
     * sent — both paths converge in `receiving.ts`.
     */
    purchaseUnitAbbreviation: z
      .string()
      .max(16, "Unit abbreviation is too long (max 16 characters).")
      .nullable()
      .optional(),
    /**
     * Conversion factor from purchase unit to base unit, captured on
     * the line so reports + future inventory-split features can break
     * a "case" back into individual eaches (e.g. 5 cases × 12 ea/case).
     * Persisted on `conversion_to_base_snapshot`. Accepts up to 4
     * fraction digits to support volume conversions (e.g. 0.236 L).
     */
    unitsPerPackage: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal.")
      .refine(v => Number(v) > 0, {
        message: "Units per package must be greater than 0.",
      })
      .nullable()
      .optional(),
  })
  .superRefine((line, ctx) => {
    // catch_weight requires a positive total weight; fixed_case may have
    // 0 (the weight is stamped at the product/lot level later).
    if (line.unitType === "catch_weight") {
      const weight = Number(line.weightLbs);
      if (!Number.isFinite(weight) || weight <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weightLbs"],
          message: "Catch-weight lines need a weight greater than 0.",
        });
      }
    }
    // per_each / per_unit rely on quantityCases as the count field and
    // ignore weight entirely — already validated above by quantityCases.
  });

export const supplierInvoiceChargeInputSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Charge description is required.")
      .max(256, "Charge description is too long (max 256 characters)."),
    chargeType: supplierInvoiceChargeTypeEnum.optional(),
    rate: z
      .string()
      .nullable()
      .optional()
      .refine(
        v => {
          if (v == null || v === "") return true;
          if (!/^\d+(\.\d{1,4})?$/.test(v)) return false;
          const num = Number(v);
          return num >= 0 && num <= 100;
        },
        { message: "Rate must be a percentage between 0 and 100." },
      ),
    includeInInventoryCost: z.boolean().optional(),
    amount: positiveMoneyStringSchema,
  })
  .superRefine((charge, ctx) => {
    // `rate` is only meaningful when chargeType === "tax". Reject a
    // non-empty rate on a non-tax charge — almost certainly a bug in
    // the caller (or a UI that didn't clear the field on type change).
    if (
      charge.chargeType &&
      charge.chargeType !== "tax" &&
      charge.rate != null &&
      charge.rate !== ""
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rate"],
        message: "Rate is only valid on tax charges.",
      });
    }
  });

export const createSupplierInvoiceInputSchema =
  supplierInvoiceHeaderInputSchema.extend({
    lines: z
      .array(supplierInvoiceLineInputSchema)
      .min(1, "An invoice needs at least one line."),
    charges: z.array(supplierInvoiceChargeInputSchema).optional(),
    complete: z.boolean().optional(),
  });

export const updateSupplierInvoiceInputSchema =
  supplierInvoiceHeaderInputSchema.extend({
    id: uuidSchema,
    lines: z
      .array(supplierInvoiceLineInputSchema)
      .min(1, "An invoice needs at least one line."),
    charges: z.array(supplierInvoiceChargeInputSchema).optional(),
  });

export const completeSupplierInvoiceInputSchema = z.object({
  id: uuidSchema,
  lineOverrides: z
    .array(
      z.object({
        lineId: uuidSchema,
        lotNumberOverride: z
          .string()
          .max(128)
          .nullable()
          .optional(),
        expirationDateOverride: isoDateSchema.nullable().optional(),
      }),
    )
    .optional(),
});

/**
 * Sentinel inside the thrown error's `message` so the client (which
 * receives errors from Next.js server actions as plain `Error` —
 * custom classes and named fields get stripped at the RSC boundary)
 * can re-extract the structured issues for field-level rendering.
 * The first line is a short human-readable summary suitable for
 * toasts; the sentinel + JSON live on a separate line afterwards.
 */
export const SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER =
  "__SUPPLIER_INVOICE_VALIDATION_ISSUES__:";

/**
 * Thrown when an action's input fails Zod validation. The Zod issues
 * are attached as `issues` so callers in the same process can use them
 * directly; clients in the browser parse them out of `message` via
 * `parseSupplierInvoiceValidationIssues()` in the client-safe utils.
 */
export class SupplierInvoiceValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const first = issues[0];
    const path = first?.path.join(".") || "request";
    const summary = `${path}: ${first?.message ?? "Invalid input."}${
      issues.length > 1 ? ` (+${issues.length - 1} more)` : ""
    }`;
    super(
      `${summary}\n${SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER}${JSON.stringify(
        issues.map(i => ({ path: i.path, message: i.message })),
      )}`,
    );
    this.name = "SupplierInvoiceValidationError";
    this.issues = issues;
  }
}

/**
 * Helper: parse `input` against `schema`, throw a
 * SupplierInvoiceValidationError on failure. Returns the parsed value
 * on success so callers can use the narrowed/coerced type.
 */
export function validateSupplierInvoiceInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new SupplierInvoiceValidationError(result.error.issues);
  }
  return result.data;
}
