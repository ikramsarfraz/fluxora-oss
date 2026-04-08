import {
  allocateInventoryToSalesOrderLine,
  createSalesOrder,
} from "@/services/orders";
import {
  createSalesOrderInputSchema,
  salesOrderAllocationInputSchema,
  type CreateSalesOrderInput,
  type SalesOrderAllocationInput,
} from "./order.schemas";

export async function createSalesOrderSafe(input: CreateSalesOrderInput) {
  const parsed = createSalesOrderInputSchema.parse(input);
  return createSalesOrder(parsed);
}

export async function allocateInventoryToSalesOrderLineSafe(
  input: SalesOrderAllocationInput,
) {
  const parsed = salesOrderAllocationInputSchema.parse(input);
  return allocateInventoryToSalesOrderLine(parsed);
}
