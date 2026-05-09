import { NextResponse } from "next/server";

import { listPendingInvitationsForAdmin } from "@/modules/core/workspace-settings/services/invitations";

export async function GET() {
  try {
    const rows = await listPendingInvitationsForAdmin();
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to load invitations";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
