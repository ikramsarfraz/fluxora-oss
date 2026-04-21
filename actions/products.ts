"use server";

import {
  createProduct,
  deleteProduct,
  getProductCategories,
  getProductById,
  getProducts,
} from "@/services/products";

export async function getProductsAction() {
  return await getProducts();
}

export async function getProductByIdAction(id: string) {
  return await getProductById(id);
}

export async function getProductCategoriesAction() {
  return await getProductCategories();
}

export async function createProductAction(input: {
  sku: string;
  name: string;
  categoryIds: string[];
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

export async function deleteProductAction(id: string) {
  return await deleteProduct(id);
}
