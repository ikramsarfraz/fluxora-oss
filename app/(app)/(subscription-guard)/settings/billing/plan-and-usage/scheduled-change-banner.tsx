"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cancelTenantScheduledChangeAction } from "@/modules/core/billing/actions";

/**
 * Persistent banner shown while a tenant has a pending scheduled subscription
 * change (a downgrade taking effect at period end). Lets owners/admins cancel
 * it ("Keep current plan"), which releases the Stripe schedule. The banner is
 * server-rendered from Stripe state, so it clears on the next refresh once the
 * schedule is released or the change has applied.
 */
export function ScheduledChangeBanner({
  planLabel,
  intervalLabel,
  dateLabel,
  canManage,
}: {
  planLabel: string;
  intervalLabel: string | null;
  dateLabel: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function keepCurrent() {
    start(async () => {
      try {
        await cancelTenantScheduledChangeAction();
        toast.success("Scheduled change canceled — keeping your current plan.");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not cancel the scheduled change.",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-[0.5px] border-warning-border bg-warning-bg px-[18px] py-[12px]">
      <div className="flex items-start gap-[10px]">
        <CalendarClock
          size={16}
          strokeWidth={1.5}
          className="mt-[1px] shrink-0 text-warning-fg"
          aria-hidden
        />
        <p className="text-[13px] leading-[1.5] text-warning-fg">
          Scheduled — switching to{" "}
          <span className="font-medium">
            {planLabel}
            {intervalLabel ? ` (${intervalLabel})` : ""}
          </span>{" "}
          on {dateLabel}. You keep your current plan until then.
        </p>
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={keepCurrent}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-3 py-[7px] text-[12px] font-medium leading-none text-ink-warm transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          ) : null}
          Keep current plan
        </button>
      ) : null}
    </div>
  );
}
