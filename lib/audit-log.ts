import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

function extractClientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfConnecting = h.get("cf-connecting-ip")?.trim();
  if (cfConnecting) return cfConnecting;
  return null;
}

/**
 * Closed set of audit actions. Adding a new event requires extending this
 * union — both the call site and the type system catch the change.
 */
export type AuditAction =
  | "bill.create"
  | "bill.update"
  | "bill.complete"
  | "bill.reverse"
  | "bill.delete"
  | "bill.forward"
  | "bill.mark_paid_manually"
  | "bulk_import.upload"
  | "bulk_import.rescan"
  | "bulk_import.row_deleted"
  | "bulk_import.row_restored"
  | "bulk_import.claim_taken_over"
  | "supplier.switch_primary"
  | "supplier.delete"
  | "product.delete"
  | "product.bulk_import"
  | "customer.delete"
  | "customer.archive"
  | "customer.restore"
  | "customer.bulk_import"
  | "plaid.connection_added"
  | "plaid.connection_removed"
  | "tenant.member_added"
  | "tenant.member_removed"
  | "tenant.member_role_changed"
  | "payment_match.confirmed"
  | "payment_match.unmatched"
  | "payment.void"
  | "payment.update"
  | "payment.bulk_reconcile"
  | "payment.bulk_unreconcile"
  | "supplier_payment.bulk_reconcile"
  | "supplier_payment.bulk_unreconcile";

export type LogAuditEventInput = {
  tenantId: string;
  actorUserId: string;
  actorEmail?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records an audit event. Always called AFTER the underlying mutation has
 * committed — a logging failure must never block the action the user was
 * trying to perform. Failures are swallowed and logged to stderr (and to
 * Sentry once the SDK is wired across the codebase).
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    const requestHeaders = await headers();
    const ipAddress = extractClientIp(requestHeaders);
    const userAgent = requestHeaders.get("user-agent");

    await db.insert(auditLog).values({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Audit failure must not block the underlying action. Log loudly so
    // the gap is visible in operational monitoring.
    console.error("[audit-log] failed to record event", {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      err,
    });
  }
}

/**
 * Helper: humanizes an action key for UI display.
 * `bill.mark_paid_manually` → `Bill mark paid manually`
 */
export function humanizeAuditAction(action: string): string {
  const [resource, verb] = action.split(".");
  if (!verb) return action;
  const verbWords = verb.replace(/_/g, " ");
  const resourceWord = resource.replace(/_/g, " ");
  return `${resourceWord.charAt(0).toUpperCase()}${resourceWord.slice(1)} ${verbWords}`;
}

/**
 * Returns the most recent audit entries for a tenant. Callers gate on
 * admin role before invoking — this function is unscoped by role and
 * expects to be called from a route that has already authenticated.
 */
export async function listRecentAuditEventsForTenant(
  tenantId: string,
  limit: number = 50,
) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.tenantId, tenantId))
    .orderBy(desc(auditLog.occurredAt))
    .limit(limit);
}
