import * as z from "zod";

export const sellingTypeValues = ["by_weight", "by_unit"] as const;
export type SellingType = (typeof sellingTypeValues)[number];

export const addProductFormSchema = z
  .object({
    sku: z.string(),
    name: z.string().trim(),
    categoryIds: z.array(z.string()).min(1, "Select at least one category."),
    sellingType: z.enum(sellingTypeValues),
    // by_weight options
    sellByPound: z.boolean(),
    // by_unit options
    sellByEach: z.boolean(),
    // shared
    sellInCases: z.boolean(),
    caseQuantity: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.name.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Product name is required.",
        path: ["name"],
      });
    }
    if (data.sellingType === "by_weight" && !data.sellByPound && !data.sellInCases) {
      ctx.addIssue({
        code: "custom",
        message: "Enable at least one selling unit.",
        path: ["sellByPound"],
      });
    }
    if (data.sellingType === "by_unit" && !data.sellByEach && !data.sellInCases) {
      ctx.addIssue({
        code: "custom",
        message: "Enable at least one selling unit.",
        path: ["sellByEach"],
      });
    }
    if (data.sellInCases) {
      const n = Number(data.caseQuantity);
      if (!data.caseQuantity || !Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive number.",
          path: ["caseQuantity"],
        });
      }
    }
  });

export type AddProductFormValues = z.infer<typeof addProductFormSchema>;
