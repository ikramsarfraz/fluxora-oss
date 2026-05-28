// Support tickets — admins + the support team. QA can't see incoming
// tenant tickets since they may include account or billing context.
export const PLATFORM_SUPPORT_ROLES = ["platform_admin", "support"] as const;
export type PlatformSupportRole = (typeof PLATFORM_SUPPORT_ROLES)[number];
