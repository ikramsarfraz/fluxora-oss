// Managing platform-user accounts is admin-only. Support and QA never
// see this section — they shouldn't be able to grant themselves access
// or change another user's role.
export const PLATFORM_USERS_ROLES = ["platform_admin"] as const;
export type PlatformUsersRole = (typeof PLATFORM_USERS_ROLES)[number];
