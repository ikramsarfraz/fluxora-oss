/**
 * Metadata key on Checkout Session, Stripe Customer, and Subscription objects
 * tying Stripe resources to our `tenants.id` (UUID).
 */
export const STRIPE_METADATA_TENANT_ID = "tenantId" as const;
