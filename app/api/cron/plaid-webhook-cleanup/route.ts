import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";

import { db } from "@/db";
import { plaidWebhookSeen } from "@/db/schema";

const RETENTION_DAYS = 30;

/**
 * Daily cleanup of the Plaid webhook idempotency table. Scheduled by
 * vercel.json; Vercel attaches `Authorization: Bearer ${CRON_SECRET}` on
 * each invocation.
 *
 * Plaid retry windows are far shorter than 30 days, so anything older
 * cannot reasonably duplicate.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Cron secret not configured" }, {
      status: 500,
    });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(plaidWebhookSeen)
    .where(lt(plaidWebhookSeen.receivedAt, cutoff))
    .returning({ webhookId: plaidWebhookSeen.webhookId });

  return NextResponse.json({
    ok: true,
    deleted: result.length,
    cutoff: cutoff.toISOString(),
  });
}
