"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productSupplierCosts } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

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
} from "../services/suppliers";

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
  const supplier = await updateSupplier(input);
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${input.id}`);
  revalidatePath(`/suppliers/${input.id}/edit`);
  revalidatePath("/dashboard");
  return supplier;
}

/**
 * Switches the primary supplier for one or more products.
 * Clears isPrimary on all suppliers for each affected product, then sets it
 * on newSupplierId. Safe to call with a list (category-wide promote) or single
 * productId (per-product opportunity apply).
 */
export async function switchPrimarySupplierAction(
  newSupplierId: string,
  productIds: string[],
) {
  if (!productIds.length) return;
  const tenant = await getCurrentTenant();

  await db.transaction(async tx => {
    // Clear primary flag for all suppliers on the affected products.
    await tx
      .update(productSupplierCosts)
      .set({ isPrimary: false })
      .where(
        and(
          inArray(productSupplierCosts.productId, productIds),
        ),
      );

    // Set primary for the chosen supplier on products it actually carries.
    await tx
      .update(productSupplierCosts)
      .set({ isPrimary: true })
      .where(
        and(
          eq(productSupplierCosts.supplierId, newSupplierId),
          inArray(productSupplierCosts.productId, productIds),
        ),
      );
  });

  revalidatePath("/suppliers");
  revalidatePath("/price-chart");
}
