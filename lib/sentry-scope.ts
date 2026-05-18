import * as Sentry from "@sentry/nextjs";

/**
 * Attach `user.id` and `tenant_id` to the active Sentry scope so subsequent
 * captures within the same request are tagged with the actor. No-op when
 * Sentry is not configured (dev/CI without DSN). Email and other PII are
 * intentionally not attached.
 */
export function setSentryUserScope(args: {
  userId: string;
  tenantId: string;
}): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setUser({ id: args.userId });
  Sentry.setTag("tenant_id", args.tenantId);
}

/**
 * Capture an exception explicitly. Use inside catch blocks that would
 * otherwise swallow the error after a `console.error`.
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Add a breadcrumb to the active Sentry scope. Breadcrumbs aren't
 * exceptions themselves — they accumulate as a trail of recent events
 * (action entry, per-file parse hops, validation passes) and ship with
 * the next captured exception. Lets a generic 500 in production come
 * with "here's what was happening" context instead of a bare stack.
 *
 * No-op when SENTRY_DSN is unset (dev / CI).
 */
export function addBreadcrumb(args: {
  category: string;
  message: string;
  level?: "info" | "warning" | "error";
  data?: Record<string, unknown>;
}): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.addBreadcrumb({
    category: args.category,
    message: args.message,
    level: args.level ?? "info",
    data: args.data,
  });
}
