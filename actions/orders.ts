"use server";

import {
  cancelSalesOrderAction as cancelSalesOrderActionImpl,
  createSalesOrderAction as createSalesOrderActionImpl,
  deleteSalesOrderAction as deleteSalesOrderActionImpl,
  generateInvoiceForSalesOrderAction as generateInvoiceForSalesOrderActionImpl,
  getSalesOrderAttachmentDownloadAction as getSalesOrderAttachmentDownloadActionImpl,
  getSalesOrderByIdAction as getSalesOrderByIdActionImpl,
  getSalesOrdersAction as getSalesOrdersActionImpl,
  getSalesOrdersPageAction as getSalesOrdersPageActionImpl,
  markSalesOrderLineShortShippedAction as markSalesOrderLineShortShippedActionImpl,
  recordPaymentForSalesOrderInvoiceAction as recordPaymentForSalesOrderInvoiceActionImpl,
  recordSalesOrderFulfillmentAction as recordSalesOrderFulfillmentActionImpl,
  removeSalesOrderAttachmentAction as removeSalesOrderAttachmentActionImpl,
  reverseSalesOrderFulfillmentAction as reverseSalesOrderFulfillmentActionImpl,
  updateSalesOrderAction as updateSalesOrderActionImpl,
  updateSalesOrderNotesAction as updateSalesOrderNotesActionImpl,
  updateSalesOrderStatusAction as updateSalesOrderStatusActionImpl,
  uploadSalesOrderAttachmentAction as uploadSalesOrderAttachmentActionImpl,
} from "@/modules/distribution/orders/actions";

export async function getSalesOrdersAction() {
  return getSalesOrdersActionImpl();
}

export async function getSalesOrdersPageAction(
  input?: Parameters<typeof getSalesOrdersPageActionImpl>[0],
) {
  return getSalesOrdersPageActionImpl(input);
}

export async function getSalesOrderByIdAction(
  id: Parameters<typeof getSalesOrderByIdActionImpl>[0],
) {
  return getSalesOrderByIdActionImpl(id);
}

export async function deleteSalesOrderAction(
  id: Parameters<typeof deleteSalesOrderActionImpl>[0],
) {
  return deleteSalesOrderActionImpl(id);
}

export async function createSalesOrderAction(
  input: Parameters<typeof createSalesOrderActionImpl>[0],
) {
  return createSalesOrderActionImpl(input);
}

export async function updateSalesOrderNotesAction(
  input: Parameters<typeof updateSalesOrderNotesActionImpl>[0],
) {
  return updateSalesOrderNotesActionImpl(input);
}

export async function updateSalesOrderStatusAction(
  input: Parameters<typeof updateSalesOrderStatusActionImpl>[0],
) {
  return updateSalesOrderStatusActionImpl(input);
}

export async function cancelSalesOrderAction(
  input: Parameters<typeof cancelSalesOrderActionImpl>[0],
) {
  return cancelSalesOrderActionImpl(input);
}

export async function updateSalesOrderAction(
  input: Parameters<typeof updateSalesOrderActionImpl>[0],
) {
  return updateSalesOrderActionImpl(input);
}

export async function recordSalesOrderFulfillmentAction(
  input: Parameters<typeof recordSalesOrderFulfillmentActionImpl>[0],
) {
  return recordSalesOrderFulfillmentActionImpl(input);
}

export async function markSalesOrderLineShortShippedAction(
  input: Parameters<typeof markSalesOrderLineShortShippedActionImpl>[0],
) {
  return markSalesOrderLineShortShippedActionImpl(input);
}

export async function reverseSalesOrderFulfillmentAction(
  input: Parameters<typeof reverseSalesOrderFulfillmentActionImpl>[0],
) {
  return reverseSalesOrderFulfillmentActionImpl(input);
}

export async function generateInvoiceForSalesOrderAction(
  input: Parameters<typeof generateInvoiceForSalesOrderActionImpl>[0],
) {
  return generateInvoiceForSalesOrderActionImpl(input);
}

export async function recordPaymentForSalesOrderInvoiceAction(
  input: Parameters<typeof recordPaymentForSalesOrderInvoiceActionImpl>[0],
) {
  return recordPaymentForSalesOrderInvoiceActionImpl(input);
}

export async function uploadSalesOrderAttachmentAction(formData: FormData) {
  return uploadSalesOrderAttachmentActionImpl(formData);
}

export async function removeSalesOrderAttachmentAction(
  input: Parameters<typeof removeSalesOrderAttachmentActionImpl>[0],
) {
  return removeSalesOrderAttachmentActionImpl(input);
}

export async function getSalesOrderAttachmentDownloadAction(
  args: Parameters<typeof getSalesOrderAttachmentDownloadActionImpl>[0],
) {
  return getSalesOrderAttachmentDownloadActionImpl(args);
}
