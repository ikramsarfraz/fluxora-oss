"use server";

import {
  createProductAction as createProductActionImpl,
  deleteProductAction as deleteProductActionImpl,
  getProductByIdAction as getProductByIdActionImpl,
  getProductsAction as getProductsActionImpl,
  getProductsPageAction as getProductsPageActionImpl,
  updateProductAction as updateProductActionImpl,
} from "@/modules/distribution/products/actions";

export async function getProductsAction() {
  return getProductsActionImpl();
}

export async function getProductsPageAction(
  ...args: Parameters<typeof getProductsPageActionImpl>
) {
  return getProductsPageActionImpl(...args);
}

export async function getProductByIdAction(
  ...args: Parameters<typeof getProductByIdActionImpl>
) {
  return getProductByIdActionImpl(...args);
}

export async function createProductAction(
  ...args: Parameters<typeof createProductActionImpl>
) {
  return createProductActionImpl(...args);
}

export async function updateProductAction(
  ...args: Parameters<typeof updateProductActionImpl>
) {
  return updateProductActionImpl(...args);
}

export async function deleteProductAction(
  ...args: Parameters<typeof deleteProductActionImpl>
) {
  return deleteProductActionImpl(...args);
}
