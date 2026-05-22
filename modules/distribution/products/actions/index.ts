"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import {
  getCurrentPortalUser,
  requireAdminPortalUser,
} from "@/modules/shared/services/portal-users";

import {
  archiveProduct,
  bulkCreateProducts,
  createProduct,
  findProductImportConflicts,
  getProductById,
  getProducts,
  getProductsPage,
  permanentlyDeleteProduct,
  previewProductSku,
  restoreProduct,
  updateProduct,
  type BulkCreateProductInput,
  type ProductListParams,
} from "../services/products";

export async function getProductsAction() {
  return await getProducts();
}

export async function getProductsPageAction(input?: ProductListParams) {
  return await getProductsPage(input);
}

export async function getProductByIdAction(id: string) {
  return await getProductById(id);
}

export async function previewProductSkuAction(input: {
  name: string;
  categoryName?: string | null;
}) {
  return await previewProductSku(input);
}

export async function createProductAction(input: {
  sku: string;
  name: string;
  categoryIds: string[];
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: {
    unitId: string;
    purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
    conversionToBase: string;
    isDefault?: boolean;
    allowsFractional?: boolean;
    sortOrder?: number;
  }[];
}) {
  const product = await createProduct(input);
  revalidatePath("/products");
  return product;
}

export async function updateProductAction(input: {
  id: string;
  sku: string;
  name: string;
  categoryIds: string[];
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: {
    unitId: string;
    purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
    conversionToBase: string;
    isDefault?: boolean;
    allowsFractional?: boolean;
    sortOrder?: number;
  }[];
}) {
  const product = await updateProduct(input);
  revalidatePath("/products");
  revalidatePath(`/products/${input.id}`);
  revalidatePath(`/products/${input.id}/edit`);
  return product;
}

export async function archiveProductAction(productId: string) {
  // Defensible default until the role matrix is wired up: only
  // owners and admins can move products through the lifecycle.
  // requireAdminPortalUser throws "Forbidden" before any side effect.
  const [user, product] = await Promise.all([
    requireAdminPortalUser(),
    getProductById(productId),
  ]);
  const result = await archiveProduct(productId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "product.archive",
    resourceType: "product",
    resourceId: productId,
    metadata: product ? { name: product.name, sku: product.sku } : {},
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return result;
}

export async function restoreProductAction(productId: string) {
  const [user, product] = await Promise.all([
    requireAdminPortalUser(),
    getProductById(productId),
  ]);
  const result = await restoreProduct(productId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "product.restore",
    resourceType: "product",
    resourceId: productId,
    metadata: product ? { name: product.name, sku: product.sku } : {},
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return result;
}

export async function permanentlyDeleteProductAction(productId: string) {
  const [user, product] = await Promise.all([
    requireAdminPortalUser(),
    getProductById(productId),
  ]);
  const result = await permanentlyDeleteProduct(productId);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "product.delete",
    resourceType: "product",
    resourceId: productId,
    metadata: product ? { name: product.name, sku: product.sku } : {},
  });
  revalidatePath("/products");
  return result;
}

/**
 * CSV-import preflight. Returns conflict signals so the modal can
 * render row-level issues *before* the user clicks Apply — saving them
 * a round-trip through a failed import. No audit log on this one; it's
 * a read-only probe and runs on every keystroke-equivalent in the
 * preview step.
 */
export async function findProductImportConflictsAction(
  rows: ReadonlyArray<{ sku?: string; name?: string }>,
) {
  return await findProductImportConflicts(rows);
}

/**
 * CSV-import apply. Wraps the bulk service with audit logging — one
 * `product.bulk_import` row per call, with the created/failed counts
 * in metadata so an operator can correlate the import to the catalog
 * state at the time.
 */
export async function bulkCreateProductsAction(rows: BulkCreateProductInput[]) {
  const user = await getCurrentPortalUser();
  const result = await bulkCreateProducts(rows);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "product.bulk_import",
    resourceType: "product",
    metadata: {
      total: result.total,
      created: result.created,
      failedCount: result.failed.length,
    },
  });
  if (result.created > 0) {
    revalidatePath("/products");
  }
  return result;
}
