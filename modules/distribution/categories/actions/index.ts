"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  archiveCategory,
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategories,
  getCategoryById,
  restoreCategory,
  untagAndDeleteCategory,
  updateCategory,
  type DeleteCategoryResult,
} from "../services/categories";

export async function getCategoriesAction() {
  return await getCategories();
}

export async function getAllCategoriesAction() {
  return await getAllCategories();
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

/**
 * Returns either { status: "deleted" } after a successful hard delete or
 * { status: "blocked", productCount } when the category is still tagged
 * on a product. The dialog branches on `status` and surfaces the two
 * follow-up actions (archive / untag-and-delete) in the blocked case.
 *
 * Audit logs only fire on the delete path — the blocked branch is a
 * read-only check.
 */
export async function deleteCategoryAction(
  id: string,
): Promise<DeleteCategoryResult> {
  const [user, category] = await Promise.all([
    getCurrentPortalUser(),
    getCategoryById(id),
  ]);
  const result = await deleteCategory(id);
  if (result.status === "deleted") {
    await logAuditEvent({
      tenantId: user.tenantId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "category.delete",
      resourceType: "category",
      resourceId: id,
      metadata: category ? { name: category.name } : {},
    });
    revalidatePath("/categories");
  }
  return result;
}

export async function archiveCategoryAction(id: string) {
  const [user, category] = await Promise.all([
    getCurrentPortalUser(),
    getCategoryById(id),
  ]);
  const row = await archiveCategory(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "category.archive",
    resourceType: "category",
    resourceId: id,
    metadata: category ? { name: category.name } : {},
  });
  revalidatePath("/categories");
  revalidatePath(`/categories/${id}`);
  return row;
}

export async function restoreCategoryAction(id: string) {
  const [user, category] = await Promise.all([
    getCurrentPortalUser(),
    getCategoryById(id),
  ]);
  const row = await restoreCategory(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "category.restore",
    resourceType: "category",
    resourceId: id,
    metadata: category ? { name: category.name } : {},
  });
  revalidatePath("/categories");
  revalidatePath(`/categories/${id}`);
  return row;
}

export async function untagAndDeleteCategoryAction(id: string) {
  const [user, category] = await Promise.all([
    getCurrentPortalUser(),
    getCategoryById(id),
  ]);
  const result = await untagAndDeleteCategory(id);
  await logAuditEvent({
    tenantId: user.tenantId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "category.delete_with_untag",
    resourceType: "category",
    resourceId: id,
    metadata: {
      ...(category ? { name: category.name } : {}),
      untagged_count: result.untaggedCount,
    },
  });
  revalidatePath("/categories");
  return result;
}
