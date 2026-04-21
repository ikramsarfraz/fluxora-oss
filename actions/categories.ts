"use server";

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
} from "@/services/categories";

export async function getCategoriesAction() {
  return await getCategories();
}

export async function getCategoryByIdAction(id: string) {
  return await getCategoryById(id);
}

export async function createCategoryAction(input: {
  name: string;
  description?: string | null;
}) {
  return await createCategory(input);
}

export async function deleteCategoryAction(id: string) {
  return await deleteCategory(id);
}
