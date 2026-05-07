import { z } from "zod";

export const createProductInputSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  defaultPricePerLb: z.string(),
  species: z.string().min(1).max(64),
  stockUnitId: z.number().int().positive().optional(),
  purchaseUnitId: z.number().int().positive().optional(),
  salesUnitId: z.number().int().positive().optional(),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;
