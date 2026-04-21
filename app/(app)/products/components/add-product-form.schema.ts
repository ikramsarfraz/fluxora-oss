import * as z from "zod";

export const addProductFormSchema = z
  .object({
    sku: z.string(),
    name: z.string().trim(),
    categoryIds: z.array(z.string()).min(1, "Select at least one category."),
    stockUnitId: z.string(),
    purchaseUnitId: z.string(),
    salesUnitId: z.string(),
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
