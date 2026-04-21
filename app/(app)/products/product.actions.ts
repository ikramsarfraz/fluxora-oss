"use server";

import {
  createCategory,
  createProduct,
  getProductCategories,
} from "@/services/products";

export async function getProductCategoriesAction() {
  return await getProductCategories();
}

export async function createCategoryAction(name: string) {
  return await createCategory(name);
}

export async function createProductAction(input: {
  sku: string;
  name: string;
  categoryIds: string[];
  stockUnitId?: string | null;
  purchaseUnitId?: string | null;
  salesUnitId?: string | null;
}) {
  return await createProduct(input);
}
