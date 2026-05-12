import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidConnections } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { syncConnection } from "@/modules/distribution/plaid/services/transaction-sync";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenant = await getCurrentTenant();

    const connection = await db.query.plaidConnections.findFirst({
      where: eq(plaidConnections.id, id),
    });

    if (!connection || connection.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (connection.status !== "active") {
      return NextResponse.json(
        { error: "Connection requires re-authentication" },
        { status: 400 },
      );
    }

    const result = await syncConnection(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[plaid/connections/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
