"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, CreditCard, Settings } from "lucide-react";

import { startTenantAdminStripeCustomerPortalAction } from "@/modules/core/billing/actions";
import { Button } from "@/components/ui/button";

export function TenantBillingPortalControls(props: {
  canManageBilling: boolean;
  stripeCustomerId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!props.canManageBilling) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <Settings className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Only workspace owners and admins can manage billing settings.
        </p>
      </div>
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
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Billing management becomes available after your first checkout. Choose a plan below to get started.
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="w-full transition-all active:scale-[0.98]"
      disabled={pending}
      onClick={openPortal}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening portal...
        </>
      ) : (
        <>
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage in Stripe
        </>
      )}
    </Button>
  );
}
