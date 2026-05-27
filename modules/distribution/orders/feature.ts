import { FEATURES } from "@/modules/core/feature-flags/constants";

export const ORDERS_FEATURE = FEATURES.DISTRIBUTION_ORDERS;

/**
 * AI-assisted paste-text entry on `/orders/new` (and the parallel surface
 * on `/supplier-invoices/new`). Gated per-tenant during rollout because
 * the feature sends pasted customer messages to OpenAI — some tenants may
 * not have data-egress consent, and we meter cost separately for billing.
 */
export const AI_ASSISTED_ENTRY_FEATURE = FEATURES.DISTRIBUTION_AI_ASSISTED_ENTRY;
