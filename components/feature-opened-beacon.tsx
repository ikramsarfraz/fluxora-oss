"use client";

import { useEffect } from "react";

import { captureClientEvent } from "@/lib/posthog-client";

type Feature = "variance" | "supplier_compare" | "mobile_receiving" | "audit_log";

/**
 * Fires the `feature.opened` PostHog event once when a feature page mounts.
 * Drop near the top of a server component's render tree to mark a feature
 * as viewed by the current user (PostHog itself deduplicates first-time
 * views via the `$feature_flag_first_seen` style — but here we just emit
 * the raw event and rely on PostHog filters to count first opens).
 */
export function FeatureOpenedBeacon({ feature }: { feature: Feature }) {
  useEffect(() => {
    captureClientEvent("feature.opened", { feature });
  }, [feature]);
  return null;
}
