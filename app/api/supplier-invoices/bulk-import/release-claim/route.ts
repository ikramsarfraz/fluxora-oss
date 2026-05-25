import { NextResponse } from "next/server";

import { isUuid } from "@/lib/utils/uuid";
import { releaseBulkImportFile } from "@/modules/distribution/supplier-invoices/services/bulk-import-history";

/**
 * POST /api/supplier-invoices/bulk-import/release-claim
 *
 * Tab-close release path. The review queue's lock hook calls
 * `releaseBulkImportFileAction` as a server action during the useEffect
 * cleanup, but browsers commonly abort in-flight fetches when the page
 * unloads — meaning the claim stays held until the TTL expires (~90s).
 *
 * `navigator.sendBeacon` (and `fetch(..., { keepalive: true })`) survive
 * page unload, but they can't invoke server actions because those need
 * the RSC framing the Next.js bundler adds. A dedicated POST route is
 * the cleanest path that beacons can hit.
 *
 * Body: JSON `{ id: string }` (the bulk_import_files row id). Auth +
 * tenant scoping happens inside `releaseBulkImportFile` via the request
 * cookies, same as every other action.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Beacons send Content-Type "text/plain" by default — accept both
    // that and the explicit "application/json" form so the browser
    // doesn't pre-flight (sendBeacon never pre-flights).
    const raw = await req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id =
      typeof payload === "object" &&
      payload !== null &&
      "id" in payload &&
      typeof (payload as { id: unknown }).id === "string"
        ? (payload as { id: string }).id
        : null;

    if (!id || !isUuid(id)) {
      return NextResponse.json(
        { error: "Missing or invalid id" },
        { status: 400 },
      );
    }

    // Idempotent — the WHERE clause inside releaseBulkImportFile only
    // clears the claim when the current user holds it, so a stale or
    // duplicate beacon is a no-op.
    await releaseBulkImportFile(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Forbidden" ? 403 : 500;
    if (status === 500) console.error("[release-claim]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
