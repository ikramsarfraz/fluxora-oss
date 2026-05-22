"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";

import {
  archiveProduct,
  createProduct,
  getProductById,
  getProducts,
  getProductsPage,
  permanentlyDeleteProduct,
  previewProductSku,
  restoreProduct,
  updateProduct,
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
