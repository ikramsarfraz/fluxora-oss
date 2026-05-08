import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { stripeWebhookEvents } from "@/db/schema";

/** If another POST is still executing and not stale yet, Stripe should retry shortly. */
const STALE_PROCESSING_MS = 90 * 1000;
const PG_UNIQUE_VIOLATION = "23505";
const CLAIM_TRANSACTION_RETRIES = 5;
/** Fits `text` column; avoids huge exception strings in the DB. */
const MAX_ERROR_MESSAGE_CHARS = 1900;

export type StripeWebhookClaimResult =
  | {
      outcome: "skip";
      stripeEventId: string;
      eventType: string;
    }
  | {
      outcome: "defer";
      stripeEventId: string;
      eventType: string;
    }
  | {
      outcome: "process";
      stripeEventId: string;
      eventType: string;
      processReason: "new_event" | "retry_after_failure" | "stale_processing_reclaim";
    };

function extractPgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const o = error as { code?: string; cause?: unknown };
  if (typeof o.code === "string") return o.code;
  if ("cause" in o && o.cause) return extractPgCode(o.cause);
  return undefined;
}

function isPgUniqueViolation(error: unknown): boolean {
  return extractPgCode(error) === PG_UNIQUE_VIOLATION;
}

function rowStaleForReclaim(updatedAt: Date | null, createdAt: Date): boolean {
  const t = updatedAt ?? createdAt;
  return Date.now() - t.getTime() >= STALE_PROCESSING_MS;
}

/**
 * Locks the row for `event.id` in a **short transaction** (no Stripe API calls — those run after release).
 *
 * @returns `"skip"` if Stripe replays after success (no handler invocation).
 * @returns `"defer"` concurrent delivery → respond 503 so Stripe retries.
 */
export async function claimStripeWebhookEventForProcessing(
  event: Stripe.Event,
): Promise<StripeWebhookClaimResult> {
  const baseMeta = { stripeEventId: event.id, eventType: event.type };

  for (let attempt = 1; attempt <= CLAIM_TRANSACTION_RETRIES; attempt++) {
    try {
      return await db.transaction(async tx => {
        const locked = await tx
          .select()
          .from(stripeWebhookEvents)
          .where(eq(stripeWebhookEvents.stripeEventId, event.id))
          .for("update");

        if (locked.length === 0) {
          await tx.insert(stripeWebhookEvents).values({
            stripeEventId: event.id,
            eventType: event.type,
            processingStatus: "processing",
          });
          console.info("[stripe webhook] claimed new Stripe event row", {
            stripeEventId: event.id,
            eventType: event.type,
          });
          return {
            outcome: "process",
            ...baseMeta,
            processReason: "new_event",
          };
        }

        const row = locked[0];
        if (row.processingStatus === "succeeded") {
          console.info("[stripe webhook] skip duplicate delivery (already succeeded)", {
            stripeEventId: event.id,
            eventType: event.type,
          });
          return { outcome: "skip", ...baseMeta };
        }

        const now = new Date();

        if (row.processingStatus === "failed") {
          await tx
            .update(stripeWebhookEvents)
            .set({
              processingStatus: "processing",
              errorMessage: null,
              processedAt: null,
              updatedAt: now,
            })
            .where(eq(stripeWebhookEvents.stripeEventId, event.id));
          console.info("[stripe webhook] retry after recorded failure", {
            stripeEventId: event.id,
            eventType: event.type,
          });
          return {
            outcome: "process",
            ...baseMeta,
            processReason: "retry_after_failure",
          };
        }

        if (
          row.processingStatus === "processing" &&
          rowStaleForReclaim(row.updatedAt, row.createdAt)
        ) {
          await tx
            .update(stripeWebhookEvents)
            .set({
              processingStatus: "processing",
              errorMessage: null,
              processedAt: null,
              updatedAt: now,
            })
            .where(eq(stripeWebhookEvents.stripeEventId, event.id));
          console.warn("[stripe webhook] stale-processing reclaim", {
            stripeEventId: event.id,
            eventType: event.type,
            staleSinceMs:
              Date.now() - (row.updatedAt ?? row.createdAt).getTime(),
          });
          return {
            outcome: "process",
            ...baseMeta,
            processReason: "stale_processing_reclaim",
          };
        }

        console.info("[stripe webhook] defer (same event already in flight)", {
          stripeEventId: event.id,
          eventType: event.type,
        });
        return { outcome: "defer", ...baseMeta };
      });
    } catch (err) {
      if (!isPgUniqueViolation(err) || attempt === CLAIM_TRANSACTION_RETRIES) {
        throw err;
      }
      /** Rare: two concurrent inserts for the same new event id — retry locked read path. */
    }
  }

  throw new Error("claimStripeWebhookEventForProcessing retries exhausted unexpectedly.");
}

function sanitizeStripeWebhookErrorText(raw: string): string {
  const singleLine = raw
    .replace(/\s+/gu, " ")
    .replace(/[\u0000-\u0008\u000B-\u001F]/gu, "")
    .trim()
    .slice(0, MAX_ERROR_MESSAGE_CHARS);
  return singleLine;
}

export function excerptErrorMessageForStripeWebhook(error: unknown): string | null {
  if (error == null) {
    return null;
  }
  if (error instanceof Error) {
    const m = sanitizeStripeWebhookErrorText(error.message);
    return m.length > 0 ? m : "(empty error message)";
  }
  return sanitizeStripeWebhookErrorText(String(error));
}

export async function finalizeStripeWebhookEventSucceeded(
  stripeEventId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(stripeWebhookEvents)
    .set({
      processingStatus: "succeeded",
      processedAt: now,
      errorMessage: null,
      updatedAt: now,
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
}

export async function finalizeStripeWebhookEventFailed(
  stripeEventId: string,
  error: unknown,
): Promise<void> {
  const now = new Date();
  await db
    .update(stripeWebhookEvents)
    .set({
      processingStatus: "failed",
      processedAt: now,
      errorMessage: excerptErrorMessageForStripeWebhook(error),
      updatedAt: now,
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
}
