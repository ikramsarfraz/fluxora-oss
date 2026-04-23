"use server";

import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/services/suppliers";

export async function getSuppliersAction() {
  return await getSuppliers();
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
