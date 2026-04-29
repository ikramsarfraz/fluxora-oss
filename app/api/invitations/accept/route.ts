import { NextResponse } from "next/server";

import { acceptInvitation } from "@/services/invitations";

function acceptErrorToHttp(message: string): { status: number; code: string } {
  if (message === "Invitation not found") {
    return { status: 404, code: "NOT_FOUND" };
  }
  if (message === "This invitation was revoked.") {
    return { status: 410, code: "REVOKED" };
  }
  if (message === "This invitation was already accepted.") {
    return { status: 410, code: "ALREADY_ACCEPTED" };
  }
  if (
    message === "This invitation has expired" ||
    message === "This invitation is no longer valid"
  ) {
    return { status: 410, code: "EXPIRED_OR_INVALID" };
  }
  if (message === "Sign in required.") {
    return { status: 401, code: "SIGN_IN_REQUIRED" };
  }
  if (message.includes("Sign in as the invited")) {
    return { status: 403, code: "EMAIL_MISMATCH" };
  }
  return { status: 400, code: "REJECTED" };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token } = body as {
    token?: string;
    password?: string;
  };

  try {
    const result = await acceptInvitation(
      { token: token ?? "" },
      { requestHeaders: request.headers },
    );
    const res = NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
    });
    const cookieList =
      typeof result.forwardHeaders.getSetCookie === "function"
        ? result.forwardHeaders.getSetCookie()
        : [];
    for (const c of cookieList) {
      res.headers.append("set-cookie", c);
    }
    return res;
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to accept invitation";
    const { status, code } = acceptErrorToHttp(message);
    return NextResponse.json({ detail: message, code }, { status });
  }
}
