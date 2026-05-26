"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { startTenantAdminStripeCheckoutAction } from "@/modules/core/billing/actions";
import type { StripeCheckoutPlan } from "@/modules/core/billing/stripe-tenant-billing";
import { cn } from "@/lib/utils";

type Props = {
  plan: StripeCheckoutPlan;
  label: string;
  /** When true the button is the disabled "Active plan" variant. */
  disabled?: boolean;
};

export function PlanSwitchButton({ plan, label, disabled }: Props) {
  const [pending, start] = useTransition();

  function go() {
    if (disabled) return;
    start(async () => {
      try {
        const { url } = await startTenantAdminStripeCheckoutAction(plan);
        window.location.href = url;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not start Stripe checkout.",
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(
        "mt-[18px] inline-flex w-full items-center justify-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-3 py-[7px] text-[12px] font-medium leading-none text-ink-warm transition-colors hover:bg-surface",
        (disabled || pending) && "pointer-events-none opacity-40",
      )}
    >
      {pending ? (
        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
      ) : null}
      <span>{label}</span>
    </button>
  );
}
