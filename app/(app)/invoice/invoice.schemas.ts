import { z } from "zod";

export const createInvoiceFromSalesOrderInputSchema = z.object({
  salesOrderId: z.number().int().positive(),
  createdByUserId: z.number().int().positive(),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  discountAmount: z.string().optional(),
  creditType: z
    .enum(["early_payment", "volume", "promotional", "other"])
    .optional(),
  creditAmount: z.string().optional(),
});

export type CreateInvoiceFromSalesOrderInput = z.infer<
  typeof createInvoiceFromSalesOrderInputSchema
>;
