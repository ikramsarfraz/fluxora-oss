"use server";

import {
  createSupplierAction as createSupplierActionImpl,
  deleteSupplierAction as deleteSupplierActionImpl,
  getSupplierByIdAction as getSupplierByIdActionImpl,
  getSuppliersAction as getSuppliersActionImpl,
  getSuppliersPageAction as getSuppliersPageActionImpl,
  updateSupplierAction as updateSupplierActionImpl,
} from "@/modules/distribution/suppliers/actions";

export async function getSuppliersAction() {
  return getSuppliersActionImpl();
}

export async function getSuppliersPageAction(
  ...args: Parameters<typeof getSuppliersPageActionImpl>
) {
  return getSuppliersPageActionImpl(...args);
}

export async function getSupplierByIdAction(
  ...args: Parameters<typeof getSupplierByIdActionImpl>
) {
  return getSupplierByIdActionImpl(...args);
}

export async function deleteSupplierAction(
  ...args: Parameters<typeof deleteSupplierActionImpl>
) {
  return deleteSupplierActionImpl(...args);
}

export async function createSupplierAction(
  ...args: Parameters<typeof createSupplierActionImpl>
) {
  return createSupplierActionImpl(...args);
}

export async function updateSupplierAction(
  ...args: Parameters<typeof updateSupplierActionImpl>
) {
  return updateSupplierActionImpl(...args);
}
