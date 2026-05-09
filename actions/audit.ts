"use server";

import {
  getActivityForSalesOrder,
  getActivityForSupplierInvoice,
} from "@/modules/distribution/services/audit";

export async function getActivityForSalesOrderAction(orderId: string) {
  return await getActivityForSalesOrder(orderId);
}

export async function getActivityForSupplierInvoiceAction(
  supplierInvoiceId: string,
) {
  return await getActivityForSupplierInvoice(supplierInvoiceId);
}
