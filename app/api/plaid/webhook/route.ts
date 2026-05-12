import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidConnections, plaidWebhookSeen } from "@/db/schema";
import { syncConnection } from "@/modules/distribution/plaid/services/transaction-sync";
import {
  PlaidWebhookVerificationError,
  verifyPlaidWebhook,
} from "@/modules/distribution/plaid/services/webhook-verification";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const jwtHeaderValue = req.headers.get("Plaid-Verification");

  try {
    await verifyPlaidWebhook({ rawBody, jwtHeaderValue });
  } catch (err) {
    if (err instanceof PlaidWebhookVerificationError) {
      console.warn("[plaid/webhook] verification rejected", err.code);
    } else {
      console.error("[plaid/webhook] verification error", err);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotency: dedup on the verified JWT itself, hashed for compact storage.
  // The non-null assertion is safe because verifyPlaidWebhook would have
  // rejected a missing header above.
  const webhookId = sha256Hex(jwtHeaderValue!);
  try {
    await db.insert(plaidWebhookSeen).values({ webhookId });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ acknowledged: true, deduped: true });
    }
    console.error("[plaid/webhook] idempotency insert failed", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  try {
    const body = JSON.parse(rawBody) as {
      webhook_type: string;
      webhook_code: string;
      item_id: string;
    };
    const { webhook_type, webhook_code, item_id } = body;

    if (webhook_type === "TRANSACTIONS") {
      if (
        webhook_code === "SYNC_UPDATES_AVAILABLE" ||
        webhook_code === "DEFAULT_UPDATE" ||
        webhook_code === "INITIAL_UPDATE" ||
        webhook_code === "HISTORICAL_UPDATE"
      ) {
        const connection = await db.query.plaidConnections.findFirst({
          where: eq(plaidConnections.plaidItemId, item_id),
        });
        if (connection && connection.status === "active") {
          // Sync in background — webhook must respond quickly
          syncConnection(connection.id).catch(err =>
            console.error("[plaid/webhook] sync failed", err),
          );
        }
      }
    }

    if (webhook_type === "ITEM") {
      if (
        webhook_code === "ERROR" ||
        webhook_code === "PENDING_EXPIRATION" ||
        webhook_code === "USER_PERMISSION_REVOKED"
      ) {
        await db
          .update(plaidConnections)
          .set({ status: "requires_reauth", updatedAt: new Date() })
          .where(eq(plaidConnections.plaidItemId, item_id));
      }
    }

    return NextResponse.json({ acknowledged: true });
  } catch (err) {
    console.error("[plaid/webhook]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
