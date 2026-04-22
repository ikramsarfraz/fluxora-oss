import * as z from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const moneyString = z
  .string()
  .trim()
  .refine(v => v === "" || /^\d+(\.\d{1,4})?$/.test(v), {
    message: "Must be a valid amount.",
  });

// All string fields use plain `z.string()` (never `.default()` + `.optional()`)
// so that the zod *input* and *output* types stay identical. react-hook-form's
// generic `Resolver` needs these to match to compile cleanly.
export const supplierInvoiceLineSchema = z
  .object({
    id: z.string().optional(),
    productId: z.string().uuid("Product is required."),
    unitType: z.enum(["catch_weight", "fixed_case"]),
    quantityCases: z
      .string()
      .trim()
      .refine(v => /^\d+$/.test(v), { message: "Whole number required." }),
    weightLbs: moneyString,
    unitPrice: moneyString,
    lotNumberOverride: z.string().trim().max(128),
    expirationDateOverride: z
      .string()
      .trim()
      .refine(v => v === "" || isoDateRegex.test(v), {
        message: "Invalid date.",
      }),
  })
  .refine(
    line =>
      line.unitType === "fixed_case"
        ? Number(line.quantityCases) > 0
        : Number(line.weightLbs) > 0,
    {
      path: ["weightLbs"],
      message: "Enter a positive weight (catch-weight) or case count.",
    },
  );

export type SupplierInvoiceLineValues = z.infer<
  typeof supplierInvoiceLineSchema
>;

export const supplierInvoiceFormSchema = z
  .object({
    supplierId: z.string().uuid("Supplier is required."),
    invoiceNumber: z
      .string()
      .trim()
      .min(1, "Invoice number is required.")
      .max(64),
    invoiceDate: z
      .string()
      .trim()
      .regex(isoDateRegex, "Invoice date is required."),
    receiveDate: z
      .string()
      .trim()
      .regex(isoDateRegex, "Receive date is required."),
    paymentMethod: z
      .enum(["cash", "check", "ach", "zelle", "credit_card"])
      .nullable(),
    notes: z.string(),
    lines: z
      .array(supplierInvoiceLineSchema)
      .min(1, "Add at least one line."),
  })
  .refine(data => data.receiveDate >= data.invoiceDate, {
    path: ["receiveDate"],
    message: "Receive date must be on or after the invoice date.",
  });

export type SupplierInvoiceFormValues = z.infer<
  typeof supplierInvoiceFormSchema
>;

export function emptyLine(): SupplierInvoiceLineValues {
  return {
    productId: "",
    unitType: "catch_weight",
    quantityCases: "1",
    weightLbs: "0",
    unitPrice: "0",
    lotNumberOverride: "",
    expirationDateOverride: "",
  };
}

/**
 * Recomputes the line total in cents precision. `fixed_case` lines price
 * per-case; `catch_weight` lines price per-lb.
 */
export function computeLineTotal(line: SupplierInvoiceLineValues): number {
  const unitPrice = Number(line.unitPrice) || 0;
  if (line.unitType === "catch_weight") {
    return (Number(line.weightLbs) || 0) * unitPrice;
  }
  return (Number(line.quantityCases) || 0) * unitPrice;
}
