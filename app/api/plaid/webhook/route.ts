import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidConnections } from "@/db/schema";
import { syncConnection } from "@/modules/distribution/plaid/services/transaction-sync";
import { getPlaidClient } from "@/modules/distribution/plaid/services/plaid-client";

async function verifyPlaidSignature(rawBody: string, token: string): Promise<void> {
  const header = decodeProtectedHeader(token);
  if (!header.kid) throw new Error("Missing kid in Plaid-Verification header");

  const plaid = getPlaidClient();
  const keyResponse = await plaid.webhookVerificationKeyGet({ key_id: header.kid });
  // Plaid returns `expired: true` for rotated keys — reject them
  if ((keyResponse.data.key as { expired?: boolean }).expired) {
    throw new Error("Plaid signing key has expired");
  }

  const publicKey = await importJWK(keyResponse.data.key as Parameters<typeof importJWK>[0], "ES256");
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ["ES256"] });

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  if (payload["request_body_sha256"] !== bodyHash) {
    throw new Error("Webhook body hash mismatch");
  }
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const verificationToken = req.headers.get("Plaid-Verification");
  if (!verificationToken) {
    return NextResponse.json({ error: "Missing Plaid-Verification header" }, { status: 401 });
  }

  try {
    await verifyPlaidSignature(rawBody, verificationToken);
  } catch (err) {
    console.error("[plaid/webhook] signature verification failed", err);
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 401 });
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
