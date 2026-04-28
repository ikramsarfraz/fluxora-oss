"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startTenantAdminStripeCustomerPortalAction } from "@/actions/stripe-billing";
import { Button } from "@/components/ui/button";

export function TenantBillingPortalControls(props: {
  canManageBilling: boolean;
  stripeCustomerId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!props.canManageBilling) {
    return null;
  }

  const hasStripeCustomer = !!props.stripeCustomerId?.trim();

  function openPortal() {
    startTransition(async () => {
      try {
        const { url } = await startTenantAdminStripeCustomerPortalAction();
        window.location.href = url;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not open Stripe Customer Portal.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      {hasStripeCustomer ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={openPortal}
          aria-busy={pending}
        >
          {pending ? "Opening…" : "Manage billing"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Billing management becomes available after the first checkout.
        </p>
      )}
    </div>
  );
}
