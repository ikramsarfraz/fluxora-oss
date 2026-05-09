import { NextResponse } from "next/server";

import { sendInvitationMagicLink } from "@/modules/core/workspace-settings/services/invitations";

function errorToHttp(message: string): { status: number; code: string } {
  if (message === "Invitation not found") {
    return { status: 404, code: "NOT_FOUND" };
  }
  if (message.includes("already accepted") || message.includes("already used")) {
    return { status: 410, code: "ALREADY_ACCEPTED" };
  }
  if (
    message === "This invitation has expired" ||
    message.includes("no longer valid")
  ) {
    return { status: 410, code: "EXPIRED_OR_INVALID" };
  }
  if (message.includes("revoked")) {
    return { status: 410, code: "REVOKED" };
  }
  return { status: 400, code: "REJECTED" };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body as { token?: string };

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { detail: "Missing invite token.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  try {
    await sendInvitationMagicLink(
      { token },
      { requestHeaders: request.headers },
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to send sign-in email";
    const { status, code } = errorToHttp(message);
    return NextResponse.json({ detail: message, code }, { status });
  }
}
