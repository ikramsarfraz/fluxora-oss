import { captureException } from "@/lib/sentry-scope";

/**
 * Better Stack uptime heartbeat. Call at the END of a cron job's success
 * path — never on failure. Better Stack detects the missed heartbeat and
 * alerts, so silent skips on failure are the intended behaviour.
 *
 * When `heartbeatUrl` is undefined (env var unset in dev / not yet
 * provisioned), this is a no-op. That makes the call site safe to add
 * before the dashboard side of Better Stack is set up.
 *
 * A failed ping does NOT fail the cron — heartbeat infra issues should
 * never block customer-facing work. Errors are surfaced to Sentry.
 */
export async function pingHeartbeat(
  heartbeatUrl: string | undefined,
  label: string,
): Promise<void> {
  if (!heartbeatUrl) return;
  try {
    await fetch(heartbeatUrl, { method: "POST" });
  } catch (err) {
    console.error(`[heartbeat:${label}] ping failed`, err);
    captureException(err, { stage: "heartbeat_ping", label });
  }
}
