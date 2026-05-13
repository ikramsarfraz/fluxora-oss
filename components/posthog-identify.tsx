"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { getCurrentPortalUserAction } from "@/modules/core/workspace-settings/actions";

export function PostHogIdentify() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    getCurrentPortalUserAction().then((user) => {
      if (!user) return;
      posthog.identify(user.id);
      posthog.group("tenant", user.tenantId);
    });
  }, []);

  return null;
}
