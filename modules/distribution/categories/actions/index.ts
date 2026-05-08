"use server";

import { revalidatePath } from "next/cache";

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
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

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  description?: string | null;
}) {
  const category = await updateCategory(input);
  revalidatePath("/categories");
  revalidatePath(`/categories/${input.id}`);
  revalidatePath(`/categories/${input.id}/edit`);
  return category;
}

export async function deleteCategoryAction(id: string) {
  return await deleteCategory(id);
}
