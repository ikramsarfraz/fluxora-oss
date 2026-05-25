import * as Sentry from "@sentry/nextjs";

/**
 * True when *either* the server DSN or the client DSN is configured.
 *
 * Server-side code (Node + Edge) reads `SENTRY_DSN`; the client bundle
 * only sees variables prefixed with `NEXT_PUBLIC_` (Next.js inlines
 * those at build time and drops everything else), so a client-side
 * caller in this same module needs to check `NEXT_PUBLIC_SENTRY_DSN`
 * to know whether Sentry is wired up.
 *
 * Using both predicates lets the helpers below be called from either
 * runtime without each call-site having to know which. When neither
 * is set (dev / CI without a DSN) the helpers no-op silently.
 */
function isSentryConfigured(): boolean {
  return Boolean(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  );
}

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
  if (!isSentryConfigured()) return;
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
  if (!isSentryConfigured()) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Add a breadcrumb to the active Sentry scope. Breadcrumbs aren't
 * exceptions themselves — they accumulate as a trail of recent events
 * (action entry, per-file parse hops, validation passes) and ship with
 * the next captured exception. Lets a generic 500 in production come
 * with "here's what was happening" context instead of a bare stack.
 *
 * No-op when neither DSN is set (dev / CI).
 */
export function addBreadcrumb(args: {
  category: string;
  message: string;
  level?: "info" | "warning" | "error";
  data?: Record<string, unknown>;
}): void {
  if (!isSentryConfigured()) return;
  Sentry.addBreadcrumb({
    category: args.category,
    message: args.message,
    level: args.level ?? "info",
    data: args.data,
  });
}
