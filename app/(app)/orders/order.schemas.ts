import { z } from "zod";

export const salesOrderLineInputSchema = z.object({
  productId: z.number().int().positive(),
  expectedCases: z.number().int().positive(),
  unitType: z.enum(["catch_weight", "case", "packet"]).optional(),
  pricePerLbOverride: z.string().optional(),
});

export const createSalesOrderInputSchema = z.object({
  customerId: z.number().int().positive(),
  createdByUserId: z.number().int().positive(),
  orderDate: z.string().min(1),
  dueDate: z.string().optional(),
  addFuelSurcharge: z.boolean().optional(),
  lines: z.array(salesOrderLineInputSchema).min(1),
});

export const salesOrderAllocationInputSchema = z.object({
  salesOrderLineId: z.number().int().positive(),
  allocations: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive(),
        allocatedWeightLbs: z.string(),
      }),
    )
    .min(1),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderInputSchema>;
export type SalesOrderAllocationInput = z.infer<
  typeof salesOrderAllocationInputSchema
>;
