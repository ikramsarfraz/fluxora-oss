/** App-facing projection of a Stripe Coupon — only the fields the admin UI needs. */
export type CouponSummary = {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  valid: boolean;
};

function formatAmountOff(amountOffCents: number, currency: string | null): string {
  const major = amountOffCents / 100;
  const code = (currency ?? "usd").toUpperCase();
  return `${major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${code}`;
}

/** e.g. "20% off", "$15.00 USD off" (amount falls back to a generic format for non-USD). */
export function formatCouponDiscount(
  coupon: Pick<CouponSummary, "percentOff" | "amountOffCents" | "currency">,
): string {
  if (coupon.percentOff != null) {
    return `${coupon.percentOff}% off`;
  }
  if (coupon.amountOffCents != null) {
    return `${formatAmountOff(coupon.amountOffCents, coupon.currency)} off`;
  }
  return "discount";
}

export function formatCouponDuration(
  coupon: Pick<CouponSummary, "duration" | "durationInMonths">,
): string {
  switch (coupon.duration) {
    case "forever":
      return "forever";
    case "once":
      return "once";
    case "repeating":
      return coupon.durationInMonths
        ? `for ${coupon.durationInMonths} month${coupon.durationInMonths === 1 ? "" : "s"}`
        : "repeating";
  }
}

/** e.g. "Launch promo — 20% off forever" or "$15.00 USD off once". */
export function formatCouponLabel(coupon: CouponSummary): string {
  const discount = formatCouponDiscount(coupon);
  const duration = formatCouponDuration(coupon);
  const head = coupon.name?.trim() ? `${coupon.name.trim()} — ` : "";
  return `${head}${discount} ${duration}`;
}
