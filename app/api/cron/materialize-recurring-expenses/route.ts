import { NextResponse, type NextRequest } from "next/server";

import { materializeRecurringExpenses } from "@/modules/distribution/expenses/services/expenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await materializeRecurringExpenses();
    return NextResponse.json({
      ok: true,
      schedulesProcessed: result.schedulesProcessed,
      instancesCreated: result.instancesCreated,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron] materialize-recurring-expenses failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
