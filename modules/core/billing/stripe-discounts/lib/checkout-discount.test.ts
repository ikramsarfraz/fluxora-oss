import test from "node:test";
import assert from "node:assert/strict";

import { resolveCheckoutDiscountParams } from "@/modules/core/billing/stripe-discounts/lib/checkout-discount";
import {
  formatCouponDiscount,
  formatCouponDuration,
  formatCouponLabel,
  type CouponSummary,
} from "@/modules/core/billing/stripe-discounts/lib/coupon-format";

test("checkout uses discounts when a coupon is assigned", () => {
  assert.deepEqual(resolveCheckoutDiscountParams("coup_123"), {
    discounts: [{ coupon: "coup_123" }],
  });
});

test("checkout trims coupon id before applying", () => {
  assert.deepEqual(resolveCheckoutDiscountParams("  coup_123  "), {
    discounts: [{ coupon: "coup_123" }],
  });
});

test("checkout falls back to self-serve promo codes without a coupon", () => {
  assert.deepEqual(resolveCheckoutDiscountParams(null), {
    allow_promotion_codes: true,
  });
  assert.deepEqual(resolveCheckoutDiscountParams(undefined), {
    allow_promotion_codes: true,
  });
  assert.deepEqual(resolveCheckoutDiscountParams("   "), {
    allow_promotion_codes: true,
  });
});

test("discounts and allow_promotion_codes are never combined (mutually exclusive)", () => {
  const withCoupon = resolveCheckoutDiscountParams("coup_x");
  const withoutCoupon = resolveCheckoutDiscountParams(null);
  assert.ok("discounts" in withCoupon && !("allow_promotion_codes" in withCoupon));
  assert.ok(
    "allow_promotion_codes" in withoutCoupon && !("discounts" in withoutCoupon),
  );
});

const percentCoupon: CouponSummary = {
  id: "c1",
  name: "Launch promo",
  percentOff: 20,
  amountOffCents: null,
  currency: null,
  duration: "forever",
  durationInMonths: null,
  valid: true,
};

const amountCoupon: CouponSummary = {
  id: "c2",
  name: null,
  percentOff: null,
  amountOffCents: 1500,
  currency: "usd",
  duration: "repeating",
  durationInMonths: 3,
  valid: true,
};

test("formats percent and amount discounts", () => {
  assert.equal(formatCouponDiscount(percentCoupon), "20% off");
  assert.equal(formatCouponDiscount(amountCoupon), "15.00 USD off");
});

test("formats coupon duration", () => {
  assert.equal(formatCouponDuration(percentCoupon), "forever");
  assert.equal(formatCouponDuration(amountCoupon), "for 3 months");
  assert.equal(
    formatCouponDuration({ duration: "repeating", durationInMonths: 1 }),
    "for 1 month",
  );
  assert.equal(
    formatCouponDuration({ duration: "once", durationInMonths: null }),
    "once",
  );
});

test("builds a full coupon label with and without a name", () => {
  assert.equal(formatCouponLabel(percentCoupon), "Launch promo — 20% off forever");
  assert.equal(formatCouponLabel(amountCoupon), "15.00 USD off for 3 months");
});
