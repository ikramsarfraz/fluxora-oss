"use server";

import {
  completeSupplierInvoice,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoiceById,
  getSupplierInvoices,
  recordSupplierInvoicePayment,
  removeSupplierInvoiceAttachment,
  reverseSupplierInvoice,
  updateSupplierInvoice,
  uploadSupplierInvoiceAttachment,
} from "@/services/receiving";

export async function getSupplierInvoicesAction() {
  return await getSupplierInvoices();
}

export async function getSupplierInvoiceByIdAction(id: string) {
  return await getSupplierInvoiceById(id);
}

export async function createSupplierInvoiceAction(
  input: Parameters<typeof createSupplierInvoice>[0],
) {
  return await createSupplierInvoice(input);
}

export async function updateSupplierInvoiceAction(
  input: Parameters<typeof updateSupplierInvoice>[0],
) {
  return await updateSupplierInvoice(input);
}

export async function completeSupplierInvoiceAction(
  input: Parameters<typeof completeSupplierInvoice>[0],
) {
  return await completeSupplierInvoice(input);
}

export async function reverseSupplierInvoiceAction(
  input: Parameters<typeof reverseSupplierInvoice>[0],
) {
  return await reverseSupplierInvoice(input);
}

export async function recordSupplierInvoicePaymentAction(
  input: Parameters<typeof recordSupplierInvoicePayment>[0],
) {
  return await recordSupplierInvoicePayment(input);
}

export async function deleteSupplierInvoiceAction(id: string) {
  return await deleteSupplierInvoice(id);
}

/**
 * Server action for attachment uploads. Accepts a `FormData` payload built
 * on the client (single `file` part + the target `supplierInvoiceId`) so
 * the binary never has to round-trip through JSON.
 */
export async function uploadSupplierInvoiceAttachmentAction(
  formData: FormData,
): Promise<{ fileId: string }> {
  const supplierInvoiceId = formData.get("supplierInvoiceId");
  const file = formData.get("file");
  if (typeof supplierInvoiceId !== "string" || !supplierInvoiceId) {
    throw new Error("Missing supplierInvoiceId.");
  }
  if (!(file instanceof File)) {
    throw new Error("Missing file.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return await uploadSupplierInvoiceAttachment({
    supplierInvoiceId,
    originalFilename: file.name,
    mimeType: file.type || null,
    bytes,
  });
}

export async function removeSupplierInvoiceAttachmentAction(input: {
  supplierInvoiceId: string;
  fileId: string;
}) {
  return await removeSupplierInvoiceAttachment(input);
}
