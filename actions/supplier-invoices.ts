"use server";

import {
  completeSupplierInvoiceAction as completeSupplierInvoiceActionImpl,
  createSupplierInvoiceAction as createSupplierInvoiceActionImpl,
  deleteSupplierInvoiceAction as deleteSupplierInvoiceActionImpl,
  getSupplierInvoiceByIdAction as getSupplierInvoiceByIdActionImpl,
  getSupplierInvoicesAction as getSupplierInvoicesActionImpl,
  getSupplierInvoicesPageAction as getSupplierInvoicesPageActionImpl,
  recordSupplierInvoicePaymentAction as recordSupplierInvoicePaymentActionImpl,
  removeSupplierInvoiceAttachmentAction as removeSupplierInvoiceAttachmentActionImpl,
  reverseSupplierInvoiceAction as reverseSupplierInvoiceActionImpl,
  updateSupplierInvoiceAction as updateSupplierInvoiceActionImpl,
  uploadSupplierInvoiceAttachmentAction as uploadSupplierInvoiceAttachmentActionImpl,
} from "@/modules/distribution/supplier-invoices/actions";

export async function getSupplierInvoicesAction() {
  return getSupplierInvoicesActionImpl();
}

export async function getSupplierInvoicesPageAction(
  ...args: Parameters<typeof getSupplierInvoicesPageActionImpl>
) {
  return getSupplierInvoicesPageActionImpl(...args);
}

export async function getSupplierInvoiceByIdAction(
  ...args: Parameters<typeof getSupplierInvoiceByIdActionImpl>
) {
  return getSupplierInvoiceByIdActionImpl(...args);
}

export async function createSupplierInvoiceAction(
  ...args: Parameters<typeof createSupplierInvoiceActionImpl>
) {
  return createSupplierInvoiceActionImpl(...args);
}

export async function updateSupplierInvoiceAction(
  ...args: Parameters<typeof updateSupplierInvoiceActionImpl>
) {
  return updateSupplierInvoiceActionImpl(...args);
}

export async function completeSupplierInvoiceAction(
  ...args: Parameters<typeof completeSupplierInvoiceActionImpl>
) {
  return completeSupplierInvoiceActionImpl(...args);
}

export async function reverseSupplierInvoiceAction(
  ...args: Parameters<typeof reverseSupplierInvoiceActionImpl>
) {
  return reverseSupplierInvoiceActionImpl(...args);
}

export async function recordSupplierInvoicePaymentAction(
  ...args: Parameters<typeof recordSupplierInvoicePaymentActionImpl>
) {
  return recordSupplierInvoicePaymentActionImpl(...args);
}

export async function deleteSupplierInvoiceAction(
  ...args: Parameters<typeof deleteSupplierInvoiceActionImpl>
) {
  return deleteSupplierInvoiceActionImpl(...args);
}

export async function uploadSupplierInvoiceAttachmentAction(
  ...args: Parameters<typeof uploadSupplierInvoiceAttachmentActionImpl>
) {
  return uploadSupplierInvoiceAttachmentActionImpl(...args);
}

export async function removeSupplierInvoiceAttachmentAction(
  ...args: Parameters<typeof removeSupplierInvoiceAttachmentActionImpl>
) {
  return removeSupplierInvoiceAttachmentActionImpl(...args);
}
