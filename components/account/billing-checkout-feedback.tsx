"use client";

import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getStripeCheckoutSessionReturnLabels } from "@/actions/stripe-billing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const AUTO_DISMISS_MS = 10_000;

function stripCheckoutQuery(search: string): string {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  const u = new URLSearchParams(trimmed);
  u.delete("session_id");
  u.delete("success");
  u.delete("canceled");
  const q = u.toString();
  return q.length > 0 ? `?${q}` : "";
}

/**
 * Return-from-Stripe-checkout cues — informational; subscription card below is authoritative.
 * When `session_id` is present, server action verifies it belongs to the signed-in tenant.
 */
export function BillingCheckoutFeedback(props: {
  kind: "canceled" | "success";
  sessionId: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const dismissRef = useRef<() => void>(() => {});

  const clearUrlParams = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextSearch = stripCheckoutQuery(window.location.search);
    router.replace(`${window.location.pathname}${nextSearch}`, { scroll: false });
  }, [router]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearUrlParams();
  }, [clearUrlParams]);

  dismissRef.current = dismiss;

  const [confirmState, setConfirmState] = useState<"loading" | "verified" | "unverified">(() => {
    if (props.kind !== "success") {
      return "verified";
    }
    return props.sessionId ? "loading" : "verified";
  });

  useEffect(() => {
    const id = setTimeout(() => {
      dismissRef.current();
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (props.kind !== "success" || !props.sessionId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const meta = await getStripeCheckoutSessionReturnLabels(props.sessionId!);
        if (cancelled) {
          return;
        }
        if (meta.ok) {
          setConfirmState("verified");
        } else {
          setConfirmState("unverified");
        }
      } catch {
        if (!cancelled) {
          setConfirmState("unverified");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.kind, props.sessionId]);

  if (!visible) {
    return null;
  }

  if (props.kind === "canceled") {
    return (
      <Alert variant="default" className="relative border-border pr-14" role="status">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-3 right-2 size-8"
          aria-label="Dismiss"
          onClick={() => dismiss()}
        >
          <X className="size-4" />
        </Button>
        <AlertTitle>Checkout canceled</AlertTitle>
        <AlertDescription>
          You closed Stripe Checkout before subscribing. Subscription below reflects your workspace
          state.
        </AlertDescription>
      </Alert>
    );
  }

  if (props.sessionId && confirmState === "loading") {
    return (
      <Alert variant="default" className="relative border-border pr-14">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-3 right-2 size-8"
          aria-label="Dismiss"
          onClick={() => dismiss()}
        >
          <X className="size-4" />
        </Button>
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <AlertTitle>Confirming Checkout</AlertTitle>
        <AlertDescription>Validating your return from Stripe…</AlertDescription>
      </Alert>
    );
  }

  if (props.sessionId && confirmState === "unverified") {
    return (
      <Alert variant="default" className="relative border-border pr-14">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-3 right-2 size-8"
          aria-label="Dismiss"
          onClick={() => dismiss()}
        >
          <X className="size-4" />
        </Button>
        <AlertTitle>Could not confirm Checkout</AlertTitle>
        <AlertDescription>
          This session could not be matched to your workspace. Your subscription below reflects what
          we have on file.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      variant="default"
      className="relative border-primary/30 bg-muted/30 pr-14"
      role="status"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-3 right-2 size-8"
        aria-label="Dismiss"
        onClick={() => dismiss()}
      >
        <X className="size-4" />
      </Button>
      <AlertTitle>Subscription updated successfully</AlertTitle>
      <AlertDescription>
        You returned from Checkout; amounts and status shown below sync from Stripe shortly via
        webhooks.
      </AlertDescription>
    </Alert>
  );
}
