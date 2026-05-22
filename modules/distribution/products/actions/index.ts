"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getProductsPage,
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

export async function deleteProductAction(id: string) {
  const [user, product] = await Promise.all([
    getCurrentPortalUser(),
    getProductById(id),
  ]);
  const result = await deleteProduct(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "product.delete",
    resourceType: "product",
    resourceId: id,
    metadata: product ? { name: product.name, sku: product.sku } : {},
  });
  return result;
}
