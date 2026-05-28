import { NextResponse } from "next/server";

import { completePlatformInvitationFromSession } from "@/modules/core/platform-admin/platform-users/services/invitations";

function acceptErrorToHttp(message: string): { status: number; code: string } {
  if (message === "Invitation not found.") {
    return { status: 404, code: "NOT_FOUND" };
  }
  if (message === "This invitation was revoked.") {
    return { status: 410, code: "REVOKED" };
  }
  if (message === "This invitation was already accepted.") {
    return { status: 410, code: "ALREADY_ACCEPTED" };
  }
  if (
    message === "This invitation has expired." ||
    message === "This invitation is no longer valid."
  ) {
    return { status: 410, code: "EXPIRED_OR_INVALID" };
  }
  if (message === "Sign in required.") {
    return { status: 401, code: "SIGN_IN_REQUIRED" };
  }
  if (message.includes("Sign in as the invited")) {
    return { status: 403, code: "EMAIL_MISMATCH" };
  }
  if (message.includes("inactive")) {
    return { status: 403, code: "INACTIVE" };
  }
  return { status: 400, code: "REJECTED" };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body as { token?: string };

  try {
    const result = await completePlatformInvitationFromSession(
      { token: token ?? "" },
      { requestHeaders: request.headers },
    );
    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
    });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to accept invitation";
    const { status, code } = acceptErrorToHttp(message);
    return NextResponse.json({ detail: message, code }, { status });
  }
}
