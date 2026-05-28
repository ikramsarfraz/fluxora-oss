import { NextResponse } from "next/server";

import { getPlatformInvitationPreviewByToken } from "@/modules/core/platform-admin/platform-users/services/invitations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const preview = await getPlatformInvitationPreviewByToken(token);

  if (!preview) {
    return NextResponse.json(
      { detail: "Invitation not found", code: "not_found" },
      { status: 404 },
    );
  }

  // Don't leak revoked / accepted state to the public — collapse to a
  // single "no longer valid" response with a 410 so a stolen token
  // can't be probed for state.
  if (preview.status !== "pending" || preview.expiresAt < new Date()) {
    return NextResponse.json(
      { detail: "This invitation is no longer valid", code: "expired_or_invalid" },
      { status: 410 },
    );
  }

  return NextResponse.json({
    email: preview.email,
    role: preview.role,
    expiresAt: preview.expiresAt.toISOString(),
  });
}
