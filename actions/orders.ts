"use server";

import {
  addInventoryAllocationToSalesOrderLine,
  allocateInventoryToSalesOrderLine,
  cancelSalesOrder,
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrderLineAllocationEditor,
  getSalesOrderById,
  getSalesOrders,
  getSalesOrdersPage,
  getSalesOrderAttachmentDownload,
  markSalesOrderLineShortShipped,
  removeSalesOrderLineAllocation,
  removeSalesOrderAttachment,
  recordSalesOrderFulfillment,
  reverseSalesOrderFulfillment,
  uploadSalesOrderAttachment,
  updateSalesOrderStatus,
  updateSalesOrder,
  updateSalesOrderNotes,
} from "@/services/orders";
import {
  generateInvoiceForSalesOrder,
  recordPaymentForSalesOrderInvoice,
} from "@/services/invoicing";

export async function getSalesOrdersAction() {
  return await getSalesOrders();
}

export async function getSalesOrdersPageAction(
  input?: Parameters<typeof getSalesOrdersPage>[0],
) {
  return await getSalesOrdersPage(input);
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

export async function getSalesOrderLineAllocationEditorAction(
  input: Parameters<typeof getSalesOrderLineAllocationEditor>[0],
) {
  return await getSalesOrderLineAllocationEditor(input);
}

export async function addInventoryAllocationToSalesOrderLineAction(
  input: Parameters<typeof addInventoryAllocationToSalesOrderLine>[0],
) {
  return await addInventoryAllocationToSalesOrderLine(input);
}

export async function removeSalesOrderLineAllocationAction(
  input: Parameters<typeof removeSalesOrderLineAllocation>[0],
) {
  return await removeSalesOrderLineAllocation(input);
}

export async function updateSalesOrderNotesAction(
  input: Parameters<typeof updateSalesOrderNotes>[0],
) {
  return await updateSalesOrderNotes(input);
}

export async function updateSalesOrderStatusAction(
  input: Parameters<typeof updateSalesOrderStatus>[0],
) {
  return await updateSalesOrderStatus(input);
}

export async function cancelSalesOrderAction(
  input: Parameters<typeof cancelSalesOrder>[0],
) {
  return await cancelSalesOrder(input);
}

export async function updateSalesOrderAction(
  input: Parameters<typeof updateSalesOrder>[0],
) {
  return await updateSalesOrder(input);
}

export async function recordSalesOrderFulfillmentAction(
  input: Parameters<typeof recordSalesOrderFulfillment>[0],
) {
  return await recordSalesOrderFulfillment(input);
}

export async function markSalesOrderLineShortShippedAction(
  input: Parameters<typeof markSalesOrderLineShortShipped>[0],
) {
  return await markSalesOrderLineShortShipped(input);
}

export async function reverseSalesOrderFulfillmentAction(
  input: Parameters<typeof reverseSalesOrderFulfillment>[0],
) {
  return await reverseSalesOrderFulfillment(input);
}

export async function generateInvoiceForSalesOrderAction(
  input: Parameters<typeof generateInvoiceForSalesOrder>[0],
) {
  return await generateInvoiceForSalesOrder(input);
}

export async function recordPaymentForSalesOrderInvoiceAction(
  input: Parameters<typeof recordPaymentForSalesOrderInvoice>[0],
) {
  return await recordPaymentForSalesOrderInvoice(input);
}

export async function uploadSalesOrderAttachmentAction(
  formData: FormData,
): Promise<{ fileId: string }> {
  const salesOrderId = formData.get("salesOrderId");
  const file = formData.get("file");
  if (typeof salesOrderId !== "string" || !salesOrderId) {
    throw new Error("Missing salesOrderId.");
  }
  if (!(file instanceof File)) {
    throw new Error("Missing file.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return uploadSalesOrderAttachment({
    salesOrderId,
    originalFilename: file.name,
    mimeType: file.type || null,
    bytes,
  });
}

export async function removeSalesOrderAttachmentAction(input: {
  salesOrderId: string;
  fileId: string;
}) {
  return removeSalesOrderAttachment(input);
}

export async function getSalesOrderAttachmentDownloadAction(args: {
  salesOrderId: string;
  fileId: string;
}) {
  return getSalesOrderAttachmentDownload(args);
}
