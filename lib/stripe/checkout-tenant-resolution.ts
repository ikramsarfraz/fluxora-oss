import type Stripe from "stripe";

import { STRIPE_METADATA_TENANT_ID } from "@/lib/stripe/stripe-metadata-keys";
import { isUuid } from "@/lib/utils/uuid";

/**
 * Prefer `client_reference_id` (set on every Checkout Session we create),
 * then `metadata.tenantId`. Both must be valid UUIDs to match `tenants.id`.
 */
export function tenantIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const viaRef = session.client_reference_id?.trim();
  if (viaRef && isUuid(viaRef)) {
    return viaRef;
  }
  const meta = session.metadata?.[STRIPE_METADATA_TENANT_ID]?.trim();
  if (meta && isUuid(meta)) {
    return meta;
  }
  return null;
}
