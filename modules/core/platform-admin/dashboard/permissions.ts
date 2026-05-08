export const PLATFORM_DASHBOARD_ROLES = ["platform_admin"] as const;
export type PlatformDashboardRole = (typeof PLATFORM_DASHBOARD_ROLES)[number];
