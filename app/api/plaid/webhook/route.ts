import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidConnections } from "@/db/schema";
import { syncConnection } from "@/modules/distribution/plaid/services/transaction-sync";
import {
  PlaidWebhookVerificationError,
  verifyPlaidWebhook,
} from "@/modules/distribution/plaid/services/webhook-verification";

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
