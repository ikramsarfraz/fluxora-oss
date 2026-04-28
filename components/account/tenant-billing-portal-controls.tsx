"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, CreditCard } from "lucide-react";

import { startTenantAdminStripeCustomerPortalAction } from "@/actions/stripe-billing";
import { Button } from "@/components/ui/button";

export function TenantBillingPortalControls(props: {
  canManageBilling: boolean;
  stripeCustomerId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!props.canManageBilling) {
    return (
      <p className="text-xs text-muted-foreground">
        Only workspace owners and admins can manage billing.
      </p>
    );
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

  if (!hasStripeCustomer) {
    return (
      <div className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Billing management becomes available after your first checkout.
          Choose a plan below to get started.
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="w-full"
      disabled={pending}
      onClick={openPortal}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage billing
        </>
      )}
    </Button>
  );
}
