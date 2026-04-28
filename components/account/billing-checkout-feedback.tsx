"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X, XCircle, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getStripeCheckoutSessionReturnLabels } from "@/actions/stripe-billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const variants = {
    canceled: {
      bg: "bg-muted/50",
      border: "border-border",
      icon: XCircle,
      iconClass: "text-muted-foreground",
      title: "Checkout canceled",
      description: "You closed Stripe Checkout before completing your subscription.",
    },
    loading: {
      bg: "bg-muted/50",
      border: "border-border",
      icon: Loader2,
      iconClass: "text-muted-foreground animate-spin",
      title: "Confirming checkout",
      description: "Validating your return from Stripe...",
    },
    unverified: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      icon: AlertCircle,
      iconClass: "text-amber-500",
      title: "Could not confirm checkout",
      description: "This session could not be matched to your workspace. Check your subscription status below.",
    },
    success: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      icon: CheckCircle2,
      iconClass: "text-emerald-500",
      title: "Subscription updated",
      description: "Your subscription has been updated. Changes will sync shortly.",
    },
  };

  const variant = props.kind === "canceled" 
    ? variants.canceled 
    : confirmState === "loading" 
      ? variants.loading 
      : confirmState === "unverified" 
        ? variants.unverified 
        : variants.success;

  const Icon = variant.icon;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4",
        variant.bg,
        variant.border
      )}
      role="status"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
        <Icon className={cn("h-4 w-4", variant.iconClass)} />
      </div>
      <div className="flex-1 space-y-0.5 pt-0.5">
        <p className="text-sm font-medium text-foreground">{variant.title}</p>
        <p className="text-xs text-muted-foreground">{variant.description}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 p-0"
        aria-label="Dismiss"
        onClick={() => dismiss()}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
