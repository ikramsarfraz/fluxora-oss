import { NextResponse } from "next/server";

import { sendPlatformInvitationMagicLink } from "@/modules/core/platform-admin/platform-users/services/invitations";

/**
 * Issues a Better Auth magic-link sign-in for an invitation recipient
 * who isn't authenticated yet. Returns 204 on success — the actual
 * link goes to the recipient's inbox.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { token } = body as { token?: string };
  if (!token) {
    return NextResponse.json(
      { detail: "Missing token", code: "REJECTED" },
      { status: 400 },
    );
  }

  try {
    await sendPlatformInvitationMagicLink(
      { token },
      { requestHeaders: request.headers },
    );
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send magic link";
    const status =
      message === "Invitation not found." ? 404 : message.includes("expired") ? 410 : 400;
    return NextResponse.json(
      { detail: message, code: "REJECTED" },
      { status },
    );
  }
}
