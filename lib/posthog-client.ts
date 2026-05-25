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
  | "feature.opened"
  // Review-queue observability — fires from ReviewContainer so we can
  // measure how often the AI is wrong (cost-diff ack rate), how often
  // submits fail server-side validation, and whether the manual re-
  // scan affordance is actually useful in practice.
  | "review.cost_diff_acknowledged"
  | "review.cost_diff_unacknowledged"
  | "review.submit_validation_failed"
  | "review.rescan_triggered";

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
