"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  bulkCreateSuppliers,
  type BulkCreateSuppliersResult,
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getInvoicesForSupplierPage,
  type SupplierInvoicesParams,
  getSupplierLotsPage,
  type SupplierLotsParams,
  getSupplierPortfolio,
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
  const [user, supplier] = await Promise.all([
    getCurrentPortalUser(),
    getSupplierById(id),
  ]);
  const result = await deleteSupplier(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "supplier.delete",
    resourceType: "supplier",
    resourceId: id,
    metadata: supplier ? { name: supplier.name } : {},
  });
  return result;
}

export async function createSupplierAction(input: CreateSupplierInput) {
  return await createSupplier(input);
}

export async function bulkCreateSuppliersAction(
  rows: CreateSupplierInput[],
): Promise<BulkCreateSuppliersResult> {
  const result = await bulkCreateSuppliers(rows);
  if (result.created > 0) {
    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateSupplierAction(input: UpdateSupplierInput) {
  const supplier = await updateSupplier(input);
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${input.id}`);
  revalidatePath(`/suppliers/${input.id}/edit`);
  revalidatePath("/dashboard");
  return supplier;
}

export async function getSupplierPortfolioAction(id: string) {
  return await getSupplierPortfolio(id);
}

export async function getInvoicesForSupplierPageAction(
  id: string,
  params?: SupplierInvoicesParams,
) {
  return await getInvoicesForSupplierPage(id, params);
}

export async function getSupplierLotsPageAction(
  id: string,
  params?: SupplierLotsParams,
) {
  return await getSupplierLotsPage(id, params);
}

/**
 * @deprecated The "primary vendor" concept was removed on develop (see
 * `0037_drop_product_supplier_primary`). The comparison-page UI that calls
 * this still exists on feature/ai-invoice-import; this stub keeps it
 * compiling, but the click handler throws so it's obvious the feature is
 * gone. Remove the comparison-page promote UI in a follow-up.
 */
export async function switchPrimarySupplierAction(
  _newSupplierId: string,
  _productIds: string[],
) {
  throw new Error(
    "Primary vendor switching has been removed. Each supplier carries its own cost and per-customer price.",
  );
}
