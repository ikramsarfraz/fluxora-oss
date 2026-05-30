"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit-log";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import {
  deleteTenantSsoProvider,
  getTenantSsoConnection,
  upsertTenantSsoProvider,
  type TenantSsoConnection,
} from "@/modules/core/workspace-settings/services/sso-settings";
export type { TenantSsoConnection } from "@/modules/core/workspace-settings/services/sso-settings";

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
import {
  getCurrentTenant,
  updateCurrentTenant,
} from "@/modules/core/tenants/services/tenants";

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

/**
 * Lightweight read for client components that need the tenant's display
 * preferences — currently currency + tax (#232 phase 1). Kept narrow on
 * purpose so the query stays cheap and cacheable; widening it pulls in
 * the full tenant row which has Stripe ids and other sensitive fields a
 * `"use client"` payload shouldn't ferry.
 */
export async function getTenantSettingsAction() {
  const tenant = await getCurrentTenant();
  return {
    baseCurrency: tenant.baseCurrency,
    taxInclusive: tenant.taxInclusive,
    defaultTaxRate: tenant.defaultTaxRate,
  };
}

export type TenantSettings = Awaited<ReturnType<typeof getTenantSettingsAction>>;

export async function getCurrentPortalUserAction() {
  const user = await getCurrentPortalUser();
  return {
    id: user.id,
    tenantId: user.tenantId,
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
  const actor = await getCurrentPortalUser();
  const targetBefore = await getUserById(id);
  const result = await setPortalUserActiveByAdmin(id, isActive);
  // Only log deactivations — re-activation is informational, not destructive.
  if (!isActive) {
    await logAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "tenant.member_removed",
      resourceType: "portal_user",
      resourceId: id,
      metadata: targetBefore
        ? { targetEmail: targetBefore.email, targetRole: targetBefore.role }
        : {},
    });
  }
  return result;
}

export async function setUserRoleAction(id: string, role: PortalUserRole) {
  const actor = await getCurrentPortalUser();
  const targetBefore = await getUserById(id);
  const result = await setPortalUserRoleByAdmin(id, role);
  await logAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "tenant.member_role_changed",
    resourceType: "portal_user",
    resourceId: id,
    metadata: {
      targetEmail: targetBefore?.email ?? null,
      from: targetBefore?.role ?? null,
      to: role,
    },
  });
  return result;
}

export async function sendUserPasswordResetAction(id: string) {
  return await sendPasswordResetForUserByAdmin(id);
}

export async function inviteUserAction(input: {
  email: string;
  fullName: string;
  role?: Exclude<PortalUserRole, "owner">;
}) {
  const actor = await getCurrentPortalUser();
  const result = await inviteUserByAdmin(input);
  await logAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "tenant.member_added",
    resourceType: "user_invitation",
    metadata: {
      invitedEmail: input.email,
      invitedRole: input.role ?? "sales",
    },
  });
  return result;
}

export async function resendUserInvitationAction(invitationId: string) {
  return await resendUserInvitationByAdmin({ invitationId });
}

export async function revokeUserInvitationAction(invitationId: string) {
  return await revokeUserInvitationByAdmin({ invitationId });
}

/**
 * Owner+admin gated update for the tenant's currency + tax preferences
 * (#232 phase 1). Writes three columns:
 *   - baseCurrency: closed enum (USD/EUR/GBP/CAD)
 *   - taxInclusive: boolean
 *   - defaultTaxRate: decimal fraction string ("0.0825" for 8.25%),
 *     or null to clear the default.
 *
 * The Postgres enum bounds `baseCurrency`; the action does not re-validate
 * because a stale client sending an unknown code would get a type-system
 * mismatch at compile time (the action's input type is the enum union)
 * and at runtime the DB rejects it. Default-tax-rate range is enforced
 * one layer up by the settings form via `parseTaxRatePercent`.
 */
export async function updateCurrencyTaxSettingsAction(input: {
  baseCurrency: "USD" | "EUR" | "GBP" | "CAD";
  taxInclusive: boolean;
  defaultTaxRate: string | null;
}) {
  const actor = await getCurrentPortalUser();
  const before = await getCurrentTenant();
  const result = await updateCurrentTenant({
    baseCurrency: input.baseCurrency,
    taxInclusive: input.taxInclusive,
    defaultTaxRate: input.defaultTaxRate,
  });
  await logAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "tenant.currency_tax_updated",
    resourceType: "tenant",
    resourceId: actor.tenantId,
    metadata: {
      previousCurrency: before.baseCurrency,
      newCurrency: result.baseCurrency,
      previousTaxInclusive: before.taxInclusive,
      newTaxInclusive: result.taxInclusive,
      previousDefaultTaxRate: before.defaultTaxRate,
      newDefaultTaxRate: result.defaultTaxRate,
    },
  });
  // The card is mounted at the workspace settings page; revalidate so
  // the displayed values match the new tenant row on next render.
  revalidatePath("/settings/workspace");
  revalidatePath("/settings/workspace/general");
  return result;
}

/**
 * Owner+admin gated update for the tenant's invitation-expiry-days
 * setting (#236). Accepts `null` to clear the override and fall back
 * to the codebase default. Numbers are clamped to [1, 30] inside
 * `updateCurrentTenant` so a client that strips the form's `min`/`max`
 * attributes can't bypass the bounds.
 */
export async function updateInvitationExpiryDaysAction(input: {
  invitationExpiryDays: number | null;
}) {
  const actor = await getCurrentPortalUser();
  // Capture the prior value so the audit log carries the actual
  // transition. The updateCurrentTenant call below clamps + writes;
  // re-reading after gives the final stored value.
  const before = await getCurrentTenant();
  const result = await updateCurrentTenant({
    invitationExpiryDays: input.invitationExpiryDays,
  });
  await logAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "tenant.invitation_expiry_updated",
    resourceType: "tenant",
    resourceId: actor.tenantId,
    metadata: {
      previousValue: before.invitationExpiryDays,
      newValue: result.invitationExpiryDays,
    },
  });
  revalidatePath("/settings/team/members");
  return result;
}

const SSO_SETTINGS_PATH = "/settings/team/sso";

export async function getTenantSsoConnectionAction(): Promise<TenantSsoConnection> {
  return getTenantSsoConnection();
}

export async function saveTenantSsoProviderAction(
  input: unknown,
): Promise<{ ok: true }> {
  recordActionBreadcrumb({ action: "sso.save_provider" });
  await upsertTenantSsoProvider(input);
  revalidatePath(SSO_SETTINGS_PATH);
  return { ok: true };
}

export async function deleteTenantSsoProviderAction(): Promise<{ ok: true }> {
  recordActionBreadcrumb({ action: "sso.delete_provider" });
  await deleteTenantSsoProvider();
  revalidatePath(SSO_SETTINGS_PATH);
  return { ok: true };
}
