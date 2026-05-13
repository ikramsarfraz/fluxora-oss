"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";

/**
 * Calls `posthog.identify` + `posthog.group('tenant', …)` once the
 * authenticated portal user resolves. Idempotent — PostHog itself
 * deduplicates repeated identify calls for the same distinctId.
 *
 * Renders nothing. Mounted inside the authenticated layout so it
 * never runs on the marketing site or auth pages.
 */
export function PostHogIdentify() {
  const { data: user } = useCurrentPortalUser();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.identify(user.id);
    posthog.group("tenant", user.tenantId);
  }, [user]);

  return null;
}
