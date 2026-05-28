// Every active platform user lands on the dashboard. The cards
// themselves only show platform-wide aggregates (tenant + user counts,
// subscription buckets) — nothing role-specific.
export const PLATFORM_DASHBOARD_ROLES = [
  "platform_admin",
  "support",
  "qa",
] as const;
export type PlatformDashboardRole = (typeof PLATFORM_DASHBOARD_ROLES)[number];
