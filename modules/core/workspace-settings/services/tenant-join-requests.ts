import { isAPIError } from "better-auth/api";
import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  auditLogs,
  portalUsers,
  tenantJoinRequests,
  tenants,
  userInvitations,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdminPortalUser } from "@/modules/core/shared/services/portal-users";
import { getCurrentRequestTenant } from "@/modules/core/tenants/services/tenants";
import {
  findAuthUserIdByEmail,
  normalizeTenantJoinRequestEmail,
  provisionPortalMembershipFromJoinRequest,
  type TenantJoinRequestedRole,
} from "@/modules/core/workspace-settings/services/tenant-join-requests-core";

const ALLOWED_REQUESTED_ROLES = new Set<TenantJoinRequestedRole>([
  "sales",
  "warehouse",
]);

type JoinRequestNotification = {
  to: string[];
  subject: string;
  message: string;
};

async function sendJoinRequestNotification(input: JoinRequestNotification) {
  const recipients = input.to.filter(Boolean);
  if (recipients.length === 0) {
    console.info("[tenant-join-request]", input.subject, input.message);
    return;
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.info("[tenant-join-request]", {
      to: recipients,
      subject: input.subject,
      message: input.message,
    });
    return;
  }

  const { resend, emailFrom } = await import("@/lib/email");
  await resend.emails.send({
    from: emailFrom,
    to: recipients,
    subject: input.subject,
    text: input.message,
  });
}

function normalizeRequestedRole(
  requestedRole: string | null | undefined,
): TenantJoinRequestedRole {
  return requestedRole === "warehouse" ? "warehouse" : "sales";
}

async function getActiveTenantForJoinRequest() {
  const requestTenant = await getCurrentRequestTenant();

  if (requestTenant.inactiveTenant) {
    throw new Error("This tenant is inactive and cannot receive access requests.");
  }

  if (!requestTenant.isTenantHost || !requestTenant.tenant) {
    throw new Error("Tenant access requests are only available on active tenant hosts.");
  }

  return requestTenant.tenant;
}

async function ensureNoPendingJoinRequest(args: {
  tenantId: string;
  email: string;
}) {
  const normalizedEmail = normalizeTenantJoinRequestEmail(args.email);
  const existingPending = await db.query.tenantJoinRequests.findFirst({
    where: and(
      eq(tenantJoinRequests.tenantId, args.tenantId),
      eq(tenantJoinRequests.status, "pending"),
      sql`lower(${tenantJoinRequests.email}) = ${normalizedEmail}`,
    ),
  });

  if (existingPending) {
    throw new Error("An access request is already pending for that email.");
  }
}

async function ensureNoActiveMembership(args: {
  tenantId: string;
  email: string;
  authUserId: string | null;
}) {
  const normalizedEmail = normalizeTenantJoinRequestEmail(args.email);
  const existingMembership = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.tenantId, args.tenantId),
      eq(portalUsers.isActive, true),
      args.authUserId
        ? sql`(${portalUsers.authUserId} = ${args.authUserId} or lower(${portalUsers.email}) = ${normalizedEmail})`
        : sql`lower(${portalUsers.email}) = ${normalizedEmail}`,
    ),
  });

  if (existingMembership) {
    throw new Error("That user already has active access to this tenant.");
  }
}

async function notifyTenantAdminsOfNewJoinRequest(args: {
  tenantId: string;
  tenantName: string;
  email: string;
  fullName: string;
  requestedRole: TenantJoinRequestedRole;
}) {
  const admins = await db.query.portalUsers.findMany({
    where: and(
      eq(portalUsers.tenantId, args.tenantId),
      eq(portalUsers.isActive, true),
      sql`${portalUsers.role} in ('owner', 'admin')`,
    ),
    with: {
      authUser: true,
    },
  });

  await sendJoinRequestNotification({
    to: admins.map(admin => admin.authUser?.email ?? admin.email),
    subject: `New access request for ${args.tenantName}`,
    message: [
      `Tenant: ${args.tenantName}`,
      `Requester: ${args.fullName} <${args.email}>`,
      `Requested role: ${args.requestedRole}`,
    ].join("\n"),
  });
}

async function notifyRequesterOfDecision(args: {
  email: string;
  tenantName: string;
  status: "approved" | "rejected";
}) {
  await sendJoinRequestNotification({
    to: [args.email],
    subject:
      args.status === "approved"
        ? `Access approved for ${args.tenantName}`
        : `Access request update for ${args.tenantName}`,
    message:
      args.status === "approved"
        ? `Your access request for ${args.tenantName} was approved. You can now sign in normally.`
        : `Your access request for ${args.tenantName} was rejected.`,
  });
}

export async function createTenantJoinRequest(_input: {
  email: string;
  fullName: string;
  requestedRole?: TenantJoinRequestedRole | null;
  note?: string | null;
  password?: string | null;
}) {
  throw new Error(
    "Self-service access requests are disabled. Ask a workspace admin for an invitation.",
  );
}

export async function listPendingTenantJoinRequestsForAdmin() {
  const current = await requireAdminPortalUser();

  return db.query.tenantJoinRequests.findMany({
    where: and(
      eq(tenantJoinRequests.tenantId, current.tenantId),
      eq(tenantJoinRequests.status, "pending"),
    ),
    with: {
      authUser: true,
    },
    orderBy: [desc(tenantJoinRequests.requestedAt)],
  });
}

export async function reviewTenantJoinRequestByAdmin(input: {
  id: string;
  decision: "approve" | "reject";
}) {
  const current = await requireAdminPortalUser();
  const request = await db.query.tenantJoinRequests.findFirst({
    where: and(
      eq(tenantJoinRequests.id, input.id),
      eq(tenantJoinRequests.tenantId, current.tenantId),
    ),
  });

  if (!request) {
    throw new Error("Access request not found.");
  }

  if (request.status !== "pending") {
    throw new Error("This access request has already been reviewed.");
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, current.tenantId),
  });

  if (!tenant || !tenant.isActive) {
    throw new Error("Inactive tenants cannot review access requests.");
  }

  const normalizedEmail = normalizeTenantJoinRequestEmail(request.email);
  const now = new Date();
  const reviewedStatus = input.decision === "approve" ? "approved" : "rejected";

  const resolvedAuthUserId =
    request.authUserId ?? (await findAuthUserIdByEmail(normalizedEmail));

  const reviewedRequest = await db.transaction(async tx => {
    let membershipProvisioned = false;

    if (input.decision === "approve" && resolvedAuthUserId) {
      await provisionPortalMembershipFromJoinRequest({
        tenantId: current.tenantId,
        authUserId: resolvedAuthUserId,
        email: normalizedEmail,
        fullName: request.fullName,
        requestedRole: request.requestedRole as TenantJoinRequestedRole,
      });
      membershipProvisioned = true;
    }

    const [updated] = await tx
      .update(tenantJoinRequests)
      .set({
        authUserId: resolvedAuthUserId ?? request.authUserId,
        status: reviewedStatus,
        reviewedAt: now,
        reviewedByUserId: current.id,
        updatedAt: now,
      })
      .where(eq(tenantJoinRequests.id, request.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update access request.");
    }

    await tx.insert(auditLogs).values({
      tenantId: current.tenantId,
      actorType: "portal_user",
      actorPortalUserId: current.id,
      action: "update",
      entityTable: "tenant_join_requests",
      entityId: updated.id,
      entityLabel: updated.email,
      changedFieldsJson: JSON.stringify(["status", "reviewedAt", "reviewedByUserId"]),
      beforeJson: JSON.stringify({ status: request.status }),
      afterJson: JSON.stringify({ status: updated.status }),
      contextJson: JSON.stringify({
        action:
          reviewedStatus === "approved"
            ? "approve_tenant_join_request"
            : "reject_tenant_join_request",
        membershipProvisioned,
        requestedRole: updated.requestedRole,
      }),
    });

    return updated;
  });

  await notifyRequesterOfDecision({
    email: normalizedEmail,
    tenantName: tenant.name,
    status: reviewedStatus,
  });

  return reviewedRequest;
}

export type PendingTenantJoinRequestListItem = Awaited<
  ReturnType<typeof listPendingTenantJoinRequestsForAdmin>
>[number];
