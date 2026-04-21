import * as z from "zod";

export const productUnitPurposeValues = [
  "stock",
  "purchase",
  "sales",
  "pricing",
  "display",
] as const;

export const productUnitSchema = z.object({
  unitId: z.string().min(1, "Select a unit."),
  purpose: z.enum(productUnitPurposeValues, {
    error: "Select a purpose.",
  }),
  conversionToBase: z
    .string()
    .min(1, "Required.")
    .refine(v => !isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number.",
    }),
  isDefault: z.boolean().optional(),
  allowsFractional: z.boolean().optional(),
});

export const addProductFormSchema = z
  .object({
    sku: z.string(),
    name: z.string().trim(),
    categoryIds: z.array(z.string()).min(1, "Select at least one category."),
    baseUnitId: z.string().optional(),
    units: z.array(productUnitSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product name is required.",
        path: ["name"],
      });
    }
  });

export type AddProductFormValues = z.infer<typeof addProductFormSchema>;
export type ProductUnitFormValue = z.infer<typeof productUnitSchema>;
