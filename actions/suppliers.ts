"use server";

import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  getSuppliersPage,
  type SupplierListParams,
  updateSupplier,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/services/suppliers";

export async function getSuppliersAction() {
  return await getSuppliers();
}

export async function getSuppliersPageAction(input?: SupplierListParams) {
  return await getSuppliersPage(input);
}

export async function getSupplierByIdAction(id: string) {
  return await getSupplierById(id);
}

export async function deleteSupplierAction(id: string) {
  return await deleteSupplier(id);
}

export async function createSupplierAction(input: CreateSupplierInput) {
  return await createSupplier(input);
}

export async function updateSupplierAction(input: UpdateSupplierInput) {
  return await updateSupplier(input);
}
