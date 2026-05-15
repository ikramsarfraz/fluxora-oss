"use client";

import posthog from "posthog-js";

/**
 * Closed list of client-side analytics events. Adding a new one extends
 * this union so call sites stay type-checked.
 */
export type ClientAnalyticsEvent =
  | "welcome.started"
  | "welcome.step_completed"
  | "pdf.uploaded"
  | "bulk_import.completed"
  | "first_bill.viewed"
  | "first_bill.names_edited"
  | "bank.connect_started"
  | "feature.opened";

/**
 * Capture a client-side event. No-op when PostHog isn't initialized
 * (env var unset). Never throws — telemetry must never break the UI.
 */
export function captureClientEvent(
  event: ClientAnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  try {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    posthog.capture(event, properties);
  } catch {
    // swallow
  }
}
