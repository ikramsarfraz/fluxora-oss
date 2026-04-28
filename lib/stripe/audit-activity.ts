/** Parsed `{@link StripeWebhookAuditContext}` from `audit_logs.context_json`. */
export type StripeWebhookAuditContext = {
  action: "stripe_webhook";
  eventType?: string;
  stripeEventId?: string;
  stripeSyncResult?: "unchanged";
};

/**
 * Attempts to parse Stripe webhook automation rows recorded by
 * `services/stripe-tenant-billing.ts` (`updateTenantFromStripeEvent`).
 */
export function parseStripeWebhookAuditContext(
  contextJson: string | null,
): StripeWebhookAuditContext | null {
  if (!contextJson) {
    return null;
  }
  try {
    const o = JSON.parse(contextJson) as Record<string, unknown>;
    if (o.action !== "stripe_webhook") {
      return null;
    }
    const eventType =
      typeof o.eventType === "string" ? o.eventType.trim() : undefined;
    const stripeEventId =
      typeof o.stripeEventId === "string" ? o.stripeEventId.trim() : undefined;
    const stripeSyncResult =
      o.stripeSyncResult === "unchanged" ? ("unchanged" as const) : undefined;
    return {
      action: "stripe_webhook",
      ...(eventType ? { eventType } : {}),
      ...(stripeEventId ? { stripeEventId } : {}),
      ...(stripeSyncResult ? { stripeSyncResult } : {}),
    };
  } catch {
    return null;
  }
}

/** One-line Activity table copy — event type idempotency outcome and Stripe evt id when present. */
export function formatStripeWebhookAuditSummary(ctx: StripeWebhookAuditContext): string {
  const eventLabel = ctx.eventType ?? "stripe.webhook";
  const syncOutcome =
    ctx.stripeSyncResult === "unchanged"
      ? "Duplicate / idempotent (no tenant field changes)"
      : "Applied to tenant subscription fields";

  const id = ctx.stripeEventId?.trim();
  if (id) {
    return `${eventLabel}: ${syncOutcome} · Stripe event ${id}`;
  }
  return `${eventLabel}: ${syncOutcome}`;
}
