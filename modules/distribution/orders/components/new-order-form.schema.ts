import { z } from "zod";

// Widened to mirror the supplier-bill side so a per_each / per_unit
// inventory item carries its original intent through to sales orders
// and invoices. The form's pricing/total math collapses everything
// non-weight onto the per_case branch, so the practical effect is
// "fixed_case-like behavior" — but the snapshot preserves the
// distinction for reporting + cost-flow purposes.
export const lineUnitTypeValues = [
  "catch_weight",
  "fixed_case",
  "per_each",
  "per_unit",
] as const;
export type LineUnitType = (typeof lineUnitTypeValues)[number];

const decimalString = (opts?: { allowEmpty?: boolean }) =>
  z
    .string()
    .optional()
    .refine(
      v => {
        if (v === undefined || v === "") return !!opts?.allowEmpty;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0;
      },
      { message: "Enter a valid non-negative number" },
    );

export const newOrderLineSchema = z.object({
  key: z.string(),
  existingLineId: z.string().uuid().optional(),
  productId: z.string().uuid({ message: "Select a product" }),
  salesUnitId: z.string().uuid({ message: "Select a sales unit" }),
  unitType: z.enum(lineUnitTypeValues),
  inventoryItemIds: z.array(z.string().uuid()).optional(),
  quantity: z
    .string()
    .min(1, "Required")
    .refine(v => {
      const n = Number(v);
      return Number.isInteger(n) && n > 0;
    }, "Must be a positive whole number"),
  pricePerLb: z
    .string()
    .min(1, "Required")
    .refine(v => Number.isFinite(Number(v)) && Number(v) >= 0, "Invalid price"),
});

export const newOrderFormSchema = z.object({
  customerId: z.string().uuid({ message: "Select a customer" }),
  orderDate: z.string().min(1, "Required"),
  deliveryDate: z.string().optional().or(z.literal("")),
  customerNotes: z.string().optional().or(z.literal("")),
  internalNotes: z.string().optional().or(z.literal("")),
  addFuelSurcharge: z.boolean(),
  discountAmount: decimalString({ allowEmpty: true }),
  lines: z
    .array(newOrderLineSchema)
    .min(1, { message: "Add at least one line item" }),
});

export type NewOrderFormValues = z.infer<typeof newOrderFormSchema>;
export type NewOrderLineValues = z.infer<typeof newOrderLineSchema>;
