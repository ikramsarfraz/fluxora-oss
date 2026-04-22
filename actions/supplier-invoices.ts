"use server";

import {
  completeSupplierInvoice,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoiceById,
  getSupplierInvoices,
  reverseSupplierInvoice,
  updateSupplierInvoice,
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

export async function deleteSupplierInvoiceAction(id: string) {
  return await deleteSupplierInvoice(id);
}
