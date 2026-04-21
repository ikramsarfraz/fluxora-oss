"use server";

import {
  getSupplierById,
  getSuppliers,
  deleteSupplier,
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
