"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  applyTenantDiscountAction,
  compTenantAction,
  createStripeCouponAction,
  listStripeCouponsAction,
  removeTenantDiscountAction,
  uncompTenantAction,
} from "@/modules/core/platform-admin/actions";
import {
  formatCouponLabel,
  type CouponSummary,
} from "@/modules/core/billing/stripe-discounts/lib/coupon-format";

type Props = {
  tenantId: string;
  isComped: boolean;
  /** Currently-applied coupon resolved from Stripe, or null when none. */
  currentDiscount: CouponSummary | null;
};

export function TenantBillingControls({
  tenantId,
  isComped,
  currentDiscount,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Discount: lazy-loaded coupon list (a Stripe API call), only fetched when
  // the admin opens the picker.
  const [coupons, setCoupons] = useState<CouponSummary[] | null>(null);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  // Create-coupon form state.
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountMajor, setAmountMajor] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">(
    "forever",
  );
  const [durationInMonths, setDurationInMonths] = useState("");

  // Comp form state.
  const [compReason, setCompReason] = useState("");

  async function loadCoupons() {
    setLoadingCoupons(true);
    const res = await listStripeCouponsAction();
    setLoadingCoupons(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setCoupons(res.coupons);
  }

  function refresh() {
    router.refresh();
  }

  function onApply() {
    if (!selectedCoupon) {
      toast.error("Pick a coupon to apply.");
      return;
    }
    startTransition(async () => {
      const res = await applyTenantDiscountAction(tenantId, selectedCoupon);
      if (res.ok) {
        toast.success("Discount applied");
        setSelectedCoupon("");
        refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeTenantDiscountAction(tenantId);
      if (res.ok) {
        toast.success("Discount removed");
        refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function onCreateCoupon() {
    startTransition(async () => {
      const res = await createStripeCouponAction({
        name,
        kind,
        percentOff: kind === "percent" ? Number(percentOff) : null,
        amountOffCents:
          kind === "amount" ? Math.round(Number(amountMajor) * 100) : null,
        currency: kind === "amount" ? currency : null,
        duration,
        durationInMonths:
          duration === "repeating" ? Number(durationInMonths) : null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Coupon created");
      setCoupons(prev => (prev ? [res.coupon, ...prev] : [res.coupon]));
      setSelectedCoupon(res.coupon.id);
      setShowCreate(false);
      setName("");
      setPercentOff("");
      setAmountMajor("");
      setDurationInMonths("");
    });
  }

  function onComp() {
    startTransition(async () => {
      const res = await compTenantAction(tenantId, compReason || null);
      if (res.ok) {
        toast.success("Tenant comped — app is now free for them");
        setCompReason("");
        refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function onUncomp() {
    startTransition(async () => {
      const res = await uncompTenantAction(tenantId, null);
      if (res.ok) {
        toast.success("Comp ended — tenant moved to free plan");
        refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discounts &amp; comp</CardTitle>
        <CardDescription>
          Apply a Stripe coupon to this tenant&apos;s billing, or comp them so
          the entire app is free. A coupon flows into their next Checkout and is
          synced to any live subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Discount</h3>
            {currentDiscount ? (
              <Badge variant="secondary">
                {formatCouponLabel(currentDiscount)}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">None applied</span>
            )}
          </div>

          {currentDiscount ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRemove}
                disabled={isPending}
              >
                Remove discount
              </Button>
              {!currentDiscount.valid ? (
                <span className="text-xs text-amber-600">
                  Coupon is no longer valid in Stripe.
                </span>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {coupons === null ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCoupons}
                  disabled={loadingCoupons}
                >
                  {loadingCoupons ? "Loading coupons…" : "Choose a coupon"}
                </Button>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-64 flex-1 space-y-1">
                    <Label htmlFor="coupon-select">Coupon</Label>
                    <Select
                      value={selectedCoupon}
                      onValueChange={setSelectedCoupon}
                    >
                      <SelectTrigger id="coupon-select" className="w-full">
                        <SelectValue placeholder="Select a coupon" />
                      </SelectTrigger>
                      <SelectContent>
                        {coupons.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No coupons in Stripe yet — create one below.
                          </div>
                        ) : (
                          coupons.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {formatCouponLabel(c)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={onApply} disabled={isPending}>
                    Apply
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(v => !v)}
              >
                {showCreate ? "Cancel new coupon" : "+ Create a new coupon"}
              </Button>

              {showCreate ? (
                <div className="space-y-3 rounded-md border border-border-default p-3">
                  <div className="space-y-1">
                    <Label htmlFor="coupon-name">Name</Label>
                    <Input
                      id="coupon-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Launch promo"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="coupon-kind">Type</Label>
                      <Select
                        value={kind}
                        onValueChange={v => setKind(v as "percent" | "amount")}
                      >
                        <SelectTrigger id="coupon-kind" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent off</SelectItem>
                          <SelectItem value="amount">Amount off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {kind === "percent" ? (
                      <div className="space-y-1">
                        <Label htmlFor="coupon-percent">Percent off</Label>
                        <Input
                          id="coupon-percent"
                          type="number"
                          min={1}
                          max={100}
                          value={percentOff}
                          onChange={e => setPercentOff(e.target.value)}
                          placeholder="20"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="coupon-amount">Amount</Label>
                          <Input
                            id="coupon-amount"
                            type="number"
                            min={0}
                            step="0.01"
                            value={amountMajor}
                            onChange={e => setAmountMajor(e.target.value)}
                            placeholder="15.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="coupon-currency">Currency</Label>
                          <Input
                            id="coupon-currency"
                            value={currency}
                            onChange={e =>
                              setCurrency(e.target.value.toLowerCase())
                            }
                            placeholder="usd"
                            maxLength={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="coupon-duration">Duration</Label>
                      <Select
                        value={duration}
                        onValueChange={v =>
                          setDuration(v as "once" | "repeating" | "forever")
                        }
                      >
                        <SelectTrigger id="coupon-duration" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forever">Forever</SelectItem>
                          <SelectItem value="once">Once</SelectItem>
                          <SelectItem value="repeating">Repeating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {duration === "repeating" ? (
                      <div className="space-y-1">
                        <Label htmlFor="coupon-months">Months</Label>
                        <Input
                          id="coupon-months"
                          type="number"
                          min={1}
                          value={durationInMonths}
                          onChange={e => setDurationInMonths(e.target.value)}
                          placeholder="3"
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button size="sm" onClick={onCreateCoupon} disabled={isPending}>
                    Create coupon
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Comp (make the app free)</h3>
          {isComped ? (
            <Alert>
              <AlertTitle>This tenant is comped</AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enterprise-equivalent access with unlimited limits and no
                  charge. Ending the comp moves them to the free plan.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUncomp}
                  disabled={isPending}
                >
                  End comp
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="comp-reason">Reason (optional)</Label>
              <Input
                id="comp-reason"
                value={compReason}
                onChange={e => setCompReason(e.target.value)}
                placeholder="e.g. design partner, internal account"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onComp}
                disabled={isPending}
              >
                Make free (comp)
              </Button>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
