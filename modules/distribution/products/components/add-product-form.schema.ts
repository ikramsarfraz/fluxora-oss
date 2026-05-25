import * as z from "zod";

/**
 * Pricing-side input — money string with optional cents/fraction.
 */
const priceString = z
  .string()
  .trim()
  .refine(v => v === "" || /^\d+(\.\d{1,4})?$/.test(v), {
    message: "Must be a valid price.",
  });

/**
 * A single sales-unit row. Each row corresponds to one product_units entry
 * that the user can also use to PRICE the product. `unitId` is the UoM FK;
 * `conversionToBase` is how many base units this sales unit contains
 * (e.g. 12 for a case-of-12; 40 for an estimated lb-per-case on a meat
 * product). `isDefault` flags which row is preselected on new orders.
 */
export const salesUnitRowSchema = z
  .object({
    unitId: z.string().uuid("Pick a unit of measure."),
    conversionToBase: z
      .string()
      .trim()
      .refine(v => v !== "" && /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, {
        message: "Enter a positive number.",
      }),
    isDefault: z.boolean(),
    allowsFractional: z.boolean(),
  });

export type SalesUnitRow = z.infer<typeof salesUnitRowSchema>;

export const addProductFormSchema = z
  .object({
    sku: z.string(),
    name: z.string().trim(),
    categoryIds: z.array(z.string()).min(1, "Select at least one category."),
    /**
     * Base UOM — the atomic unit pricing and cost snapshots are recorded
     * in. e.g. lb for catch-weight meat, ea for canned goods, gal for
     * milk. Sales-unit rows below derive their conversions from this.
     */
    baseUnitId: z.string().uuid("Pick a base unit."),
    /**
     * Default price for ONE base unit. Stored on products.default_price_per_lb
     * (legacy column name — semantically "price per base unit"). The form
     * shows the suffix `/{baseUnit.abbreviation}` so the user sees /lb on
     * weight products and /ea on each-priced products.
     */
    defaultPrice: priceString,
    /**
     * At least one sales-unit row is required. Exactly one row must carry
     * isDefault=true. Most products carry 1–3 rows; meat typically has
     * lb (default) plus optionally cs (case). Beverages typically have
     * ea (default) plus optionally cs (case of 12).
     */
    salesUnits: z
      .array(salesUnitRowSchema)
      .min(1, "Add at least one sales unit."),
  })
  .superRefine((data, ctx) => {
    if (!data.name.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Product name is required.",
        path: ["name"],
      });
    }

    // Exactly one default sales unit.
    const defaults = data.salesUnits.filter(u => u.isDefault).length;
    if (defaults === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Mark one sales unit as the default.",
        path: ["salesUnits"],
      });
    } else if (defaults > 1) {
      ctx.addIssue({
        code: "custom",
        message: "Only one sales unit can be the default.",
        path: ["salesUnits"],
      });
    }

    // No duplicate UOMs.
    const seenUnitIds = new Set<string>();
    data.salesUnits.forEach((row, i) => {
      if (seenUnitIds.has(row.unitId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each unit of measure can only be added once.",
          path: ["salesUnits", i, "unitId"],
        });
      }
      seenUnitIds.add(row.unitId);
    });
  });

export type AddProductFormValues = z.infer<typeof addProductFormSchema>;
