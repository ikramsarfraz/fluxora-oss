"use server";

import {
  allocateInventoryToSalesOrderLine,
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrderById,
  getSalesOrders,
  updateSalesOrderNotes,
} from "@/services/orders";

export async function getSalesOrdersAction() {
  return await getSalesOrders();
}

export async function getSalesOrderByIdAction(id: string) {
  return await getSalesOrderById(id);
}

export async function deleteSalesOrderAction(id: string) {
  return await deleteSalesOrder(id);
}

export async function createSalesOrderAction(
  input: Parameters<typeof createSalesOrder>[0],
) {
  return await createSalesOrder(input);
}

export async function allocateInventoryToSalesOrderLineAction(
  input: Parameters<typeof allocateInventoryToSalesOrderLine>[0],
) {
  return await allocateInventoryToSalesOrderLine(input);
}

export async function updateSalesOrderNotesAction(
  input: Parameters<typeof updateSalesOrderNotes>[0],
) {
  return await updateSalesOrderNotes(input);
}
