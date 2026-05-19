"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTenantSubscriptionAction } from "@/modules/core/platform-admin/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tenant } from "@/db/types";
import {
  TENANT_SUBSCRIPTION_PLAN_VALUES,
  TENANT_SUBSCRIPTION_STATUS_VALUES,
} from "@/lib/tenant-subscription";

function toDatetimeLocalValue(d: Date | null | undefined): string {
  if (!d) {
    return "";
  }
  const x = new Date(d);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

function planLabel(p: (typeof TENANT_SUBSCRIPTION_PLAN_VALUES)[number]) {
  return p === "free" ? "Free" : p === "starter" ? "Starter" : p === "growth" ? "Growth" : "Enterprise";
}

function statusLabel(s: (typeof TENANT_SUBSCRIPTION_STATUS_VALUES)[number]) {
  const map: Record<(typeof TENANT_SUBSCRIPTION_STATUS_VALUES)[number], string> = {
    trialing: "Trialing",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    comped: "Comped",
  };
  return map[s];
}

export function TenantSubscriptionForm({ tenant }: { tenant: Tenant }) {
  const [isPending, startTransition] = useTransition();
  const [subscriptionPlan, setPlan] = useState(tenant.subscriptionPlan);
  const [subscriptionStatus, setStatus] = useState(tenant.subscriptionStatus);
  const [trialEndsAt, setTrialEndsAt] = useState(
    toDatetimeLocalValue(tenant.trialEndsAt),
  );
  const [currentPeriodEndsAt, setCurrentPeriodEndsAt] = useState(
    toDatetimeLocalValue(tenant.currentPeriodEndsAt),
  );
  const [stripeCustomerId, setStripeCustomerId] = useState(
    tenant.stripeCustomerId ?? "",
  );
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState(
    tenant.stripeSubscriptionId ?? "",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault();
        startTransition(async () => {
          try {
            await updateTenantSubscriptionAction(tenant.id, {
              subscriptionPlan,
              subscriptionStatus,
              trialEndsAt: trialEndsAt || null,
              currentPeriodEndsAt: currentPeriodEndsAt || null,
              stripeCustomerId: stripeCustomerId || null,
              stripeSubscriptionId: stripeSubscriptionId || null,
            });
            toast.success("Subscription updated");
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Failed to update subscription.",
            );
          }
        });
      }}
    >
      <Alert variant="default" className="border-amber-500/40 bg-warning-bg/70 dark:bg-warning-fg/35 dark:border-amber-800/50">
        <AlertTitle>Stripe webhooks may overwrite manual edits</AlertTitle>
        <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
          Saving applies to this tenant row right away; enforcement is unchanged. Later webhook
          deliveries for this customer (e.g. subscription updates, invoice events, or Checkout
          completions) can still replace plan, status, dates, and Stripe ids to match Stripe canonical
          billing data.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sub-plan">Plan</Label>
          <Select
            value={subscriptionPlan}
            onValueChange={v => setPlan(v as typeof subscriptionPlan)}
          >
            <SelectTrigger id="sub-plan" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENANT_SUBSCRIPTION_PLAN_VALUES.map(p => (
                <SelectItem key={p} value={p}>
                  {planLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-status">Subscription status</Label>
          <Select
            value={subscriptionStatus}
            onValueChange={v => setStatus(v as typeof subscriptionStatus)}
          >
            <SelectTrigger id="sub-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENANT_SUBSCRIPTION_STATUS_VALUES.map(s => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sub-trial-ends">Trial ends</Label>
          <Input
            id="sub-trial-ends"
            type="datetime-local"
            value={trialEndsAt}
            onChange={e => setTrialEndsAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-period-ends">Current period ends</Label>
          <Input
            id="sub-period-ends"
            type="datetime-local"
            value={currentPeriodEndsAt}
            onChange={e => setCurrentPeriodEndsAt(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sub-stripe-cus">Stripe customer id</Label>
          <Input
            id="sub-stripe-cus"
            autoComplete="off"
            value={stripeCustomerId}
            onChange={e => setStripeCustomerId(e.target.value)}
            placeholder="cus_…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-stripe-sub">Stripe subscription id</Label>
          <Input
            id="sub-stripe-sub"
            autoComplete="off"
            value={stripeSubscriptionId}
            onChange={e => setStripeSubscriptionId(e.target.value)}
            placeholder="sub_…"
          />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save subscription"}
      </Button>
    </form>
  );
}
