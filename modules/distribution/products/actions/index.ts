"use server";

import { revalidatePath } from "next/cache";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getProductsPage,
  updateProduct,
  type ProductListParams,
} from "@/services/products";

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
  return await createProduct(input);
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
  return await deleteProduct(id);
}
