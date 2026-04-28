"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startTenantAdminStripeCheckoutAction } from "@/actions/stripe-billing";
import { Button } from "@/components/ui/button";
import type { StripeCheckoutPlan } from "@/services/stripe-tenant-billing";

const PLANS: { id: StripeCheckoutPlan; label: string }[] = [
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "enterprise", label: "Enterprise" },
];

export function TenantBillingCheckoutButtons() {
  const [pending, startTransition] = useTransition();

  function launch(plan: StripeCheckoutPlan) {
    startTransition(async () => {
      try {
        const { url } = await startTenantAdminStripeCheckoutAction(plan);
        window.location.href = url;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not start Stripe Checkout.",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PLANS.map(p => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => launch(p.id)}
        >
          {pending ? "Redirecting…" : `Subscribe — ${p.label}`}
        </Button>
      ))}
    </div>
  );
}
