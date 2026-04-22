"use server";

import {
  getCurrentPortalUser,
  getUserById,
  getUsers,
  inviteUserByAdmin,
  sendPasswordResetForUserByAdmin,
  setPortalUserActiveByAdmin,
  type PortalUserRole,
} from "@/services/portal-users";
import { listPendingInvitationsForAdmin } from "@/services/invitations";

export async function getUsersAction() {
  return await getUsers();
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
