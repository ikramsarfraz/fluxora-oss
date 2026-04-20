import * as z from "zod";

export const addProductFormSchema = z
  .object({
    sku: z.string(),
    name: z.string().trim(),
    species: z.string().trim(),
    stockUnitId: z.string(),
    purchaseUnitId: z.string(),
    salesUnitId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter name and category.",
        path: ["name"],
      });
    }
    if (!data.species) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter name and category.",
        path: ["species"],
      });
    }
  });

export type AddProductFormValues = z.infer<typeof addProductFormSchema>;
