"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startPlatformAdminStripeCheckoutAction } from "@/actions/platform-stripe-billing";
import { Button } from "@/components/ui/button";
import type { StripeCheckoutPlan } from "@/modules/core/billing/stripe-tenant-billing";

const PLANS: { id: StripeCheckoutPlan; label: string }[] = [
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "enterprise", label: "Enterprise" },
];

export function PlatformTenantStripeCheckoutButtons({
  tenantId,
}: {
  tenantId: string;
}) {
  const [pending, startTransition] = useTransition();

  function launch(plan: StripeCheckoutPlan) {
    startTransition(async () => {
      try {
        const { url } = await startPlatformAdminStripeCheckoutAction(tenantId, plan);
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
          {pending ? "Redirecting…" : `Checkout ${p.label}`}
        </Button>
      ))}
    </div>
  );
}
