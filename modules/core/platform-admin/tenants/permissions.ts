// Only platform operators may access tenant management.
export const PLATFORM_TENANTS_ROLES = ["platform_admin"] as const;
export type PlatformTenantsRole = (typeof PLATFORM_TENANTS_ROLES)[number];
