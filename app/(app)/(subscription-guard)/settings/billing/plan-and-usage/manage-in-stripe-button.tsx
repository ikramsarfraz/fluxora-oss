"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { startTenantAdminStripeCustomerPortalAction } from "@/modules/core/billing/actions";
import { cn } from "@/lib/utils";

type Props = {
  canManage: boolean;
  hasStripeCustomer: boolean;
  className?: string;
  variant?: "primary" | "secondary";
};

export function ManageInStripeButton({
  canManage,
  hasStripeCustomer,
  className,
  variant = "primary",
}: Props) {
  const [pending, start] = useTransition();

  if (!canManage || !hasStripeCustomer) return null;

  function open() {
    start(async () => {
      try {
        const { url } = await startTenantAdminStripeCustomerPortalAction();
        window.location.href = url;
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Could not open Stripe customer portal.",
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-[14px] py-[7px] text-[13px] font-medium leading-none transition-colors disabled:cursor-wait disabled:opacity-60",
        variant === "primary"
          ? "border-[0.5px] border-transparent bg-forest text-card-warm hover:bg-forest-mid"
          : "border-[0.5px] border-border-default bg-card text-ink-warm hover:bg-surface",
        className,
      )}
    >
      {pending ? (
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <ExternalLink size={13} strokeWidth={1.5} />
      )}
      <span>Manage in Stripe</span>
    </button>
  );
}
