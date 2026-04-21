"use server";

import { getActivityForSalesOrder } from "@/services/audit";

export async function getActivityForSalesOrderAction(orderId: string) {
  return await getActivityForSalesOrder(orderId);
}
