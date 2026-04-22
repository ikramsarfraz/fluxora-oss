import { z } from "zod";

export const createInvoiceFromSalesOrderInputSchema = z.object({
  salesOrderId: z.string().uuid(),
  createdByUserId: z.string().uuid(),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  discountAmount: z.string().optional(),
  creditType: z.enum(["fixed", "percentage"]).optional(),
  creditAmount: z.string().optional(),
});

export type CreateInvoiceFromSalesOrderInput = z.infer<
  typeof createInvoiceFromSalesOrderInputSchema
>;
