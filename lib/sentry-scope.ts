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
