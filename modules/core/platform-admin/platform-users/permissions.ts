export const PLATFORM_USERS_ROLES = ["platform_admin"] as const;
export type PlatformUsersRole = (typeof PLATFORM_USERS_ROLES)[number];
