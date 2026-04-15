import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  PortalUserDetail,
  PortalUserRecord,
} from "@/services/portal-users";

export type PortalUserRole = "admin" | "sales" | "warehouse" | "accounting";

/** First self-serve signup gets admin; adjust if you add invites later. */
const DEFAULT_SIGNUP_ROLE: PortalUserRole = "admin";

/**
 * Creates ERP `portal_users` row for the signed-in Better Auth user (idempotent).
 * Call after `authClient.signUp.email` succeeds so cookies are present.
 */
export function createPortalUser(input: {
  authUserId: string;
  fullName: string;
  email: string;
  role?: PortalUserRole;
}) {
  return api.post<PortalUserRecord>(endpoints.portalUsers.create(), {
    authUserId: input.authUserId,
    fullName: input.fullName,
    email: input.email,
    role: input.role ?? DEFAULT_SIGNUP_ROLE,
  });
}

export function getUsers() {
  return api.get<PortalUserRecord[]>(endpoints.portalUsers.list());
}

export function getPortalUser(id: number) {
  return api.get<PortalUserDetail>(endpoints.portalUsers.one(id));
}

/** Admin-only: email invite link; user sets password on `/invite/[token]`. */
export function invitePortalUser(input: {
  fullName: string;
  email: string;
  role: PortalUserRole;
}) {
  return api.post<{ success: boolean }>(endpoints.portalUsers.invite(), input);
}

export type { PortalUserDetail, PortalUserRecord } from "@/services/portal-users";
