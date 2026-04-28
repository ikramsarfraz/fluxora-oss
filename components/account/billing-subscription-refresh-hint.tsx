"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";

const STORAGE_KEY = "prime_billing_checkout_followup_v1";

/** Matches “still waiting on webhooks”; auto-clears when row updates or time elapses (~28s). */
const FOLLOWUP_MS = 28_000;

type FollowupPayload = {
  snapshotPlan: TenantSubscriptionPlan;
  snapshotStatus: TenantSubscriptionStatus;
  showUntilEpoch: number;
};

function safeParse(raw: string): FollowupPayload | null {
  try {
    const o = JSON.parse(raw) as FollowupPayload;
    if (
      typeof o.snapshotPlan !== "string" ||
      typeof o.snapshotStatus !== "string" ||
      typeof o.showUntilEpoch !== "number"
    ) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function BillingSubscriptionRefreshHint(props: {
  snapshotPlan: TenantSubscriptionPlan;
  snapshotStatus: TenantSubscriptionStatus;
  /** True when this response was built from a Stripe success redirect (?success=1 or legacy ?session_id=). */
  bootstrapFromCheckoutSuccess: boolean;
}) {
  const router = useRouter();
  const [pendingRefresh, startRefresh] = useTransition();
  const [hintVisible, setHintVisible] = useState(false);
  const [hideAfterEpoch, setHideAfterEpoch] = useState<number | null>(null);
  /** Seed sessionStorage once per successful checkout redirect (avoid timer reset on re-renders). */
  const seededCheckoutFollowupRef = useRef(false);

  const { snapshotPlan, snapshotStatus, bootstrapFromCheckoutSuccess } = props;

  const refreshHintEligibility = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setHintVisible(false);
      setHideAfterEpoch(null);
      return;
    }
    const parsed = safeParse(raw);
    if (!parsed) {
      sessionStorage.removeItem(STORAGE_KEY);
      setHintVisible(false);
      setHideAfterEpoch(null);
      return;
    }
    const now = Date.now();
    if (now > parsed.showUntilEpoch) {
      sessionStorage.removeItem(STORAGE_KEY);
      setHintVisible(false);
      setHideAfterEpoch(null);
      return;
    }

    /** Webhook synced — stored baseline differs from authoritative server props → stop hinting. */
    if (
      parsed.snapshotPlan !== snapshotPlan ||
      parsed.snapshotStatus !== snapshotStatus
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      setHintVisible(false);
      setHideAfterEpoch(null);
      return;
    }

    setHintVisible(true);
    setHideAfterEpoch(parsed.showUntilEpoch);
  }, [snapshotPlan, snapshotStatus]);

  useEffect(() => {
    if (
      bootstrapFromCheckoutSuccess &&
      typeof window !== "undefined" &&
      !seededCheckoutFollowupRef.current
    ) {
      seededCheckoutFollowupRef.current = true;
      const payload: FollowupPayload = {
        snapshotPlan,
        snapshotStatus,
        showUntilEpoch: Date.now() + FOLLOWUP_MS,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    refreshHintEligibility();
  }, [
    bootstrapFromCheckoutSuccess,
    snapshotPlan,
    snapshotStatus,
    refreshHintEligibility,
  ]);

  useEffect(() => {
    if (!hintVisible || !hideAfterEpoch) {
      return;
    }
    const ms = hideAfterEpoch - Date.now();
    if (ms <= 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      setHintVisible(false);
      setHideAfterEpoch(null);
      return;
    }
    const t = setTimeout(() => {
      refreshHintEligibility();
    }, ms + 50);
    return () => clearTimeout(t);
  }, [hintVisible, hideAfterEpoch, refreshHintEligibility]);

  const lines = useMemo(
    () => ({
      body: "If your plan hasn't updated yet, it may take a few seconds while Stripe notifies this app.",
      cta: "Refresh status",
    }),
    [],
  );

  if (!hintVisible) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-muted-foreground text-xs leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{lines.body}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-xs"
          disabled={pendingRefresh}
          aria-busy={pendingRefresh}
          onClick={() => {
            startRefresh(() => {
              router.refresh();
            });
          }}
        >
          {pendingRefresh ? "Refreshing…" : lines.cta}
        </Button>
      </div>
    </div>
  );
}
