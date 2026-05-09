"use server";

import {
  completeSupplierInvoice,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoiceById,
  getSupplierInvoices,
  getSupplierInvoicesPage,
  recordSupplierInvoicePayment,
  removeSupplierInvoiceAttachment,
  reverseSupplierInvoice,
  updateSupplierInvoice,
  uploadSupplierInvoiceAttachment,
} from "../services/receiving";
import { parseSupplierInvoicePdf } from "../services/pdf-prefill";
import {
  getImportProfilesForSupplier,
  createImportProfile,
  updateImportProfile,
  deactivateImportProfile,
  type CreateImportProfileInput,
  type UpdateImportProfileInput,
} from "../services/import-profiles";
import {
  getAliasesForSupplier,
  getAllAliasesForTenant,
  upsertProductAlias,
  confirmProductAlias,
  deleteProductAlias,
  saveConfirmedAiAlias,
  recordManualProductSelection,
  type CreateAliasInput,
  type UpdateAliasInput,
} from "../services/product-matching";

export async function getSupplierInvoicesAction() {
  return await getSupplierInvoices();
}

export async function getSupplierInvoicesPageAction(
  input?: Parameters<typeof getSupplierInvoicesPage>[0],
) {
  return await getSupplierInvoicesPage(input);
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

export async function parseSupplierInvoicePdfAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing PDF file.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return await parseSupplierInvoicePdf({
    originalFilename: file.name,
    mimeType: file.type || null,
    bytes,
  });
}

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

// ---------------------------------------------------------------------------
// Import profile actions
// ---------------------------------------------------------------------------

export async function getImportProfilesForSupplierAction(supplierId: string) {
  return await getImportProfilesForSupplier(supplierId);
}

export async function createImportProfileAction(input: CreateImportProfileInput) {
  return await createImportProfile(input);
}

export async function updateImportProfileAction(input: UpdateImportProfileInput) {
  return await updateImportProfile(input);
}

export async function deactivateImportProfileAction(id: string) {
  return await deactivateImportProfile(id);
}

// ---------------------------------------------------------------------------
// Product alias actions
// ---------------------------------------------------------------------------

export async function getAliasesForSupplierAction(supplierId: string) {
  return await getAliasesForSupplier(supplierId);
}

export async function getAllAliasesForTenantAction() {
  return await getAllAliasesForTenant();
}

export async function upsertProductAliasAction(input: CreateAliasInput) {
  return await upsertProductAlias(input);
}

export async function confirmProductAliasAction(aliasId: string) {
  return await confirmProductAlias(aliasId);
}

export async function deleteProductAliasAction(aliasId: string) {
  return await deleteProductAlias(aliasId);
}

export async function saveConfirmedAiAliasAction(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}) {
  return await saveConfirmedAiAlias(args);
}

export async function recordManualProductSelectionAction(args: {
  supplierId: string;
  vendorProductName: string;
  internalProductId: string;
}) {
  return await recordManualProductSelection(args);
}
