"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getStripeCheckoutSessionReturnLabels } from "@/actions/stripe-billing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Mirrors the Next.js [with-stripe-typescript](https://github.com/vercel/next.js/tree/canary/examples/with-stripe-typescript) pattern: verify `session_id` after Checkout redirect server-side retrieval. */
export function AccountBillingReturnBanner({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; summary: string }
    | { kind: "fallback" }
  >({ kind: "loading" });

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meta = await getStripeCheckoutSessionReturnLabels(sessionId);
        if (cancelled) {
          return;
        }
        if (meta?.ok) {
          setState({
            kind: "ok",
            summary: `Payment status ${meta.paymentStatus}.${meta.customerEmail ? ` Receipt email: ${meta.customerEmail}` : ""}`,
          });
        } else {
          setState({ kind: "fallback" });
        }
      } catch {
        if (!cancelled) {
          setState({ kind: "fallback" });
        }
      }
      if (!cancelled && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  if (!sessionId) {
    return null;
  }

  if (state.kind === "loading") {
    return (
      <Alert variant="default" className="border-primary/40 bg-muted/40">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <AlertTitle>Returning from Stripe</AlertTitle>
        <AlertDescription>
          Confirming your checkout session… subscription details update via webhook shortly.
        </AlertDescription>
      </Alert>
    );
  }

  if (state.kind === "fallback") {
    return (
      <Alert variant="default" className="border-primary/40 bg-muted/40">
        <AlertTitle>Payment received</AlertTitle>
        <AlertDescription>
          Your workspace subscription will update when Stripe notifies us (usually within a minute).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="border-primary/40 bg-muted/40">
      <AlertTitle>Checkout completed</AlertTitle>
      <AlertDescription>{state.summary}</AlertDescription>
    </Alert>
  );
}
