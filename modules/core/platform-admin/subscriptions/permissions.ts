// Subscriptions cross-tenant view is admin-only — exposes revenue +
// plan breakdowns that aren't appropriate for support/QA scopes.
export const PLATFORM_SUBSCRIPTIONS_ROLES = ["platform_admin"] as const;
export type PlatformSubscriptionsRole =
  (typeof PLATFORM_SUBSCRIPTIONS_ROLES)[number];
