"use server";

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

export async function getUsersAction() {
  return await getUsers();
}

export async function getUsersDirectoryPageAction(
  input?: Parameters<typeof getUsersDirectoryPage>[0],
) {
  return await getUsersDirectoryPage(input);
}

/**
 * Returns a minimal, client-safe view of the signed-in portal user.
 * Used by client components that need the user's role for permission gating.
 */
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
