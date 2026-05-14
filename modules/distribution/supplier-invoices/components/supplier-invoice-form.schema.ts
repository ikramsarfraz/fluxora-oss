import * as z from "zod";

import {
  computeDraftLineWeight,
  supplierInvoiceWeightEntryModes,
  type SupplierInvoiceWeightEntryMode,
} from "@/modules/distribution/supplier-invoices/utils/case-weights";

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
    weightEntryMode: z.enum(supplierInvoiceWeightEntryModes),
    quantityCases: z
      .string()
      .trim()
      .refine(v => /^\d+$/.test(v), { message: "Whole number required." }),
    weightLbs: moneyString,
    defaultCaseWeightLbs: moneyString,
    caseWeightEntries: z.array(moneyString),
    unitPrice: moneyString,
    lotNumberOverride: z.string().trim().max(128),
    expirationDateOverride: z
      .string()
      .trim()
      .refine(v => v === "" || isoDateRegex.test(v), {
        message: "Invalid date.",
      }),
  })
  .superRefine((line, ctx) => {
    const quantityCases = Number.parseInt(line.quantityCases, 10);
    if (!Number.isInteger(quantityCases) || quantityCases <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityCases"],
        message: "Enter a positive case count.",
      });
      return;
    }

    if (line.unitType === "fixed_case") {
      return;
    }

    if (line.weightEntryMode === "total_weight") {
      if ((Number(line.weightLbs) || 0) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weightLbs"],
          message: "Enter a positive total weight.",
        });
      }
      return;
    }

    const computedWeight = computeDraftLineWeight(line);
    if (computedWeight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path:
          line.weightEntryMode === "default_case_weight"
            ? ["defaultCaseWeightLbs"]
            : ["caseWeightEntries"],
        message:
          line.weightEntryMode === "default_case_weight"
            ? "Enter a default case weight or override the cases that differ."
            : "Enter a positive weight for each case.",
      });
    }

    if (
      line.weightEntryMode === "manual_case_weights" &&
      line.caseWeightEntries.slice(0, quantityCases).some(
        value => (Number(value) || 0) <= 0,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["caseWeightEntries"],
        message: "Enter a positive weight for each case.",
      });
    }
  });

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
    weightEntryMode: "total_weight",
    quantityCases: "1",
    weightLbs: "0",
    defaultCaseWeightLbs: "",
    caseWeightEntries: [""],
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
    return computeDraftLineWeight(line) * unitPrice;
  }
  return (Number(line.quantityCases) || 0) * unitPrice;
}

export type SupplierInvoiceLineWeightEntryMode = SupplierInvoiceWeightEntryMode;
