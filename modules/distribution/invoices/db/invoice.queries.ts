import {
  createInvoiceFromSalesOrder,
  recordPayment,
} from "@/services/invoicing";
import {
  createInvoiceFromSalesOrderInputSchema,
  type CreateInvoiceFromSalesOrderInput,
} from "../validators/invoice.schemas";

export async function createInvoiceFromSalesOrderSafe(
  input: CreateInvoiceFromSalesOrderInput,
) {
  const parsed = createInvoiceFromSalesOrderInputSchema.parse(input);
  return createInvoiceFromSalesOrder(parsed);
}

// export async function recordPaymentSafe(input: RecordPaymentInput) {
//   const parsed = recordPaymentInputSchema.parse(input);
//   return recordPayment(parsed);
// }
