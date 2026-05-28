// Tenant directory + detail view. Read access for any platform user so
// support + QA can investigate from a tenant context. Edit operations
// (status toggle, manual subscription overrides, Stripe Checkout) are
// gated separately to platform_admin via `PLATFORM_TENANTS_EDIT_ROLES`.
export const PLATFORM_TENANTS_ROLES = [
  "platform_admin",
  "support",
  "qa",
] as const;
export type PlatformTenantsRole = (typeof PLATFORM_TENANTS_ROLES)[number];

export const PLATFORM_TENANTS_EDIT_ROLES = ["platform_admin"] as const;
export type PlatformTenantsEditRole =
  (typeof PLATFORM_TENANTS_EDIT_ROLES)[number];
