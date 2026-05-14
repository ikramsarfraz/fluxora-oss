"use server";

import { revalidatePath } from "next/cache";

import {
  createTenantJoinRequest,
  listPendingTenantJoinRequestsForAdmin,
  reviewTenantJoinRequestByAdmin,
} from "@/modules/core/workspace-settings/services/tenant-join-requests";
import {
  dismissTenantSetupChecklist,
  getTenantSetupChecklistView,
} from "@/modules/core/workspace-settings/services/setup-checklist";
import type { TenantSetupChecklistView } from "@/modules/core/workspace-settings/services/setup-checklist";
import {
  getCurrentPortalUser,
  getUsersDirectoryPage,
  getUserById,
  getUsers,
  inviteUserByAdmin,
  sendPasswordResetForUserByAdmin,
  setPortalUserActiveByAdmin,
  setPortalUserRoleByAdmin,
  type PortalUserRole,
} from "@/modules/shared/services/portal-users";
import {
  listPendingInvitationsForAdmin,
  resendUserInvitationByAdmin,
  revokeUserInvitationByAdmin,
} from "@/modules/core/workspace-settings/services/invitations";

// --- Join requests ---

export async function createTenantJoinRequestAction(
  input: Parameters<typeof createTenantJoinRequest>[0],
) {
  return await createTenantJoinRequest(input);
}

export async function getPendingTenantJoinRequestsAction() {
  return await listPendingTenantJoinRequestsForAdmin();
}

export async function reviewTenantJoinRequestAction(
  input: Parameters<typeof reviewTenantJoinRequestByAdmin>[0],
) {
  return await reviewTenantJoinRequestByAdmin(input);
}

// --- Setup checklist ---

export async function getTenantSetupChecklistViewAction(): Promise<TenantSetupChecklistView> {
  return getTenantSetupChecklistView();
}

export async function dismissTenantSetupChecklistAction(): Promise<void> {
  await dismissTenantSetupChecklist();
  revalidatePath("/dashboard");
}

// --- Users & invitations ---

export async function getUsersAction() {
  return await getUsers();
}

export async function getUsersDirectoryPageAction(
  input?: Parameters<typeof getUsersDirectoryPage>[0],
) {
  return await getUsersDirectoryPage(input);
}

export async function getCurrentPortalUserAction() {
  const user = await getCurrentPortalUser();
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as PortalUserRole,
  };
}

export type CurrentPortalUser = Awaited<
  ReturnType<typeof getCurrentPortalUserAction>
>;

export async function getUserByIdAction(id: string) {
  const user = await getUserById(id);
  return user ?? null;
}

export async function getPendingInvitationsAction() {
  return await listPendingInvitationsForAdmin();
}

export async function setUserActiveAction(id: string, isActive: boolean) {
  return await setPortalUserActiveByAdmin(id, isActive);
}

export async function setUserRoleAction(id: string, role: PortalUserRole) {
  return await setPortalUserRoleByAdmin(id, role);
}

export async function sendUserPasswordResetAction(id: string) {
  return await sendPasswordResetForUserByAdmin(id);
}

export async function inviteUserAction(input: {
  email: string;
  fullName: string;
  role?: Exclude<PortalUserRole, "owner">;
}) {
  return await inviteUserByAdmin(input);
}

export async function resendUserInvitationAction(invitationId: string) {
  return await resendUserInvitationByAdmin({ invitationId });
}

export async function revokeUserInvitationAction(invitationId: string) {
  return await revokeUserInvitationByAdmin({ invitationId });
}
