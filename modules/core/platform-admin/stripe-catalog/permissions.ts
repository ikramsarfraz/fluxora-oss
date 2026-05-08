export const PLATFORM_STRIPE_CATALOG_ROLES = ["platform_admin"] as const;
export type PlatformStripeCatalogRole = (typeof PLATFORM_STRIPE_CATALOG_ROLES)[number];
