import "server-only";

import { PostHog } from "posthog-node";

let serverClient: PostHog | null = null;

function getServerClient(): PostHog | null {
  if (!process.env.POSTHOG_PROJECT_API_KEY) return null;
  if (!serverClient) {
    serverClient = new PostHog(process.env.POSTHOG_PROJECT_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      // Serverless-safe: ship every event immediately, no batching delay.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return serverClient;
}

/**
 * Closed list of server-side analytics events. Adding a new one requires
 * extending this union so both the call site and the type system catch it.
 *
 * Do not put PII (email, names, dollar amounts) in event names or
 * properties — measure events, don't capture record contents.
 */
export type AnalyticsEvent =
  | "user.signed_up"
  | "welcome.completed"
  | "welcome.skipped"
  | "pdf.parsed"
  | "pdf.text_extractor_fallback"
  | "bulk_import.processed"
  | "bulk_import.rescanned"
  | "first_bill.saved"
  | "bill.saved"
  | "bill.received"
  | "bank.connect_succeeded"
  | "payment_match.confirmed"
  | "payment_match.auto_applied"
  | "markdown.applied"
  | "supplier.switched_primary"
  | "bill.forwarded";

/**
 * Captures an event from a server action / route handler. No-op when
 * `POSTHOG_PROJECT_API_KEY` is unset (dev / CI without provisioning).
 *
 * Always `await` — in serverless we must flush before the function
 * returns or the event is lost.
 */
export async function captureServerEvent(params: {
  userId: string;
  event: AnalyticsEvent;
  tenantId?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const client = getServerClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: params.userId,
      event: params.event,
      properties: {
        ...params.properties,
        ...(params.tenantId ? { $groups: { tenant: params.tenantId } } : {}),
      },
    });
    await client.shutdown();
  } catch (err) {
    // Telemetry must never break the request.
    console.error("[posthog-server] capture failed", err);
  }
}
