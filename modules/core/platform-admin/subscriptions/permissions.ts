export const PLATFORM_SUBSCRIPTIONS_ROLES = ["platform_admin"] as const;
export type PlatformSubscriptionsRole = (typeof PLATFORM_SUBSCRIPTIONS_ROLES)[number];
