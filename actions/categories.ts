"use server";

import {
  createCategoryAction as createCategoryActionImpl,
  deleteCategoryAction as deleteCategoryActionImpl,
  getCategoriesAction as getCategoriesActionImpl,
  getCategoryByIdAction as getCategoryByIdActionImpl,
  updateCategoryAction as updateCategoryActionImpl,
} from "@/modules/distribution/categories/actions";

export async function getCategoriesAction() {
  return getCategoriesActionImpl();
}

export async function getCategoryByIdAction(
  ...args: Parameters<typeof getCategoryByIdActionImpl>
) {
  return getCategoryByIdActionImpl(...args);
}

export async function createCategoryAction(
  ...args: Parameters<typeof createCategoryActionImpl>
) {
  return createCategoryActionImpl(...args);
}

export async function updateCategoryAction(
  ...args: Parameters<typeof updateCategoryActionImpl>
) {
  return updateCategoryActionImpl(...args);
}

export async function deleteCategoryAction(
  ...args: Parameters<typeof deleteCategoryActionImpl>
) {
  return deleteCategoryActionImpl(...args);
}
