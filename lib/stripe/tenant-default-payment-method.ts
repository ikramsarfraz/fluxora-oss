/**
 * Minimal read-only card facts safe to render in tenant billing / admin UIs.
 * Populated server-side only from Stripe PaymentMethod `.card`; no PAN/CVC/fingerprint/tokens.
 */
export type TenantDefaultPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};
