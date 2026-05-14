import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidConnections } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getPlaidClient } from "@/modules/distribution/plaid/services/plaid-client";
import { encryptToken } from "@/lib/crypto/token-encryption";
import { initialSync } from "@/modules/distribution/plaid/services/transaction-sync";

export async function POST(req: NextRequest) {
  try {
    const { public_token, institution_id, institution_name } = await req.json() as {
      public_token: string;
      institution_id?: string;
      institution_name?: string;
    };

    if (!public_token) {
      return NextResponse.json({ error: "public_token required" }, { status: 400 });
    }

    const [tenant, user] = await Promise.all([
      getCurrentTenant(),
      getCurrentPortalUser(),
    ]);
    const client = getPlaidClient();

    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    // Check if this item is already connected for THIS tenant
    const existing = await db.query.plaidConnections.findFirst({
      where: and(eq(plaidConnections.plaidItemId, item_id), eq(plaidConnections.tenantId, tenant.id)),
    });

    let connectionId: string;

    if (existing) {
      // Re-connection (update mode) — refresh the token and reactivate
      await db
        .update(plaidConnections)
        .set({
          encryptedAccessToken: encryptToken(access_token),
          status: "active",
          institutionId: institution_id ?? existing.institutionId,
          institutionName: institution_name ?? existing.institutionName,
          updatedAt: new Date(),
        })
        .where(eq(plaidConnections.id, existing.id));
      connectionId = existing.id;
    } else {
      const [inserted] = await db
        .insert(plaidConnections)
        .values({
          tenantId: tenant.id,
          plaidItemId: item_id,
          encryptedAccessToken: encryptToken(access_token),
          institutionId: institution_id ?? null,
          institutionName: institution_name ?? null,
          status: "active",
        })
        .returning({ id: plaidConnections.id });
      connectionId = inserted.id;
    }

    if (!existing) {
      await logAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        actorEmail: user.email,
        action: "plaid.connection_added",
        resourceType: "plaid_connection",
        resourceId: connectionId,
        metadata: {
          institutionId: institution_id ?? null,
          institutionName: institution_name ?? null,
        },
      });
      await captureServerEvent({
        userId: user.id,
        tenantId: tenant.id,
        event: "bank.connect_succeeded",
        properties: {
          institution_name: institution_name ?? "unknown",
        },
      });
    }

    // Kick off initial sync in the background (don't await — respond fast)
    initialSync(connectionId, access_token).catch(err =>
      console.error("[plaid/exchange] initial sync failed", err),
    );

    return NextResponse.json({ connection_id: connectionId });
  } catch (err) {
    console.error("[plaid/exchange]", err);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}
