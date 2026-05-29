/**
 * Stripe Checkout forbids combining `discounts` with `allow_promotion_codes`
 * (they are mutually exclusive). When a platform admin has pre-assigned a
 * coupon to the tenant we apply it directly; otherwise we let the tenant
 * type a self-serve promotion code at Checkout.
 */
export type CheckoutDiscountParams =
  | { discounts: [{ coupon: string }] }
  | { allow_promotion_codes: true };

export function resolveCheckoutDiscountParams(
  couponId: string | null | undefined,
): CheckoutDiscountParams {
  const id = couponId?.trim();
  if (id) {
    return { discounts: [{ coupon: id }] };
  }
  return { allow_promotion_codes: true };
}
