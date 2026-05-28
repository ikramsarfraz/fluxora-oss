// Stripe catalog is admin-only — pricing + product metadata edits
// affect every tenant's billing, and the Sync button writes upstream
// Stripe state.
export const PLATFORM_STRIPE_CATALOG_ROLES = ["platform_admin"] as const;
export type PlatformStripeCatalogRole =
  (typeof PLATFORM_STRIPE_CATALOG_ROLES)[number];
