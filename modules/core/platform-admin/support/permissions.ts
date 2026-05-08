export const PLATFORM_SUPPORT_ROLES = ["platform_admin"] as const;
export type PlatformSupportRole = (typeof PLATFORM_SUPPORT_ROLES)[number];
