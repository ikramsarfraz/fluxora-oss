import { NextResponse } from "next/server";

import { acceptInvitation } from "@/services/invitations";

export async function POST(request: Request) {
  const body = await request.json();
  const { token, password } = body as {
    token?: string;
    password?: string;
  };

  try {
    await acceptInvitation({
      token: token ?? "",
      password: password ?? "",
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to accept invitation";
    const status =
      message === "Invitation not found"
        ? 404
        : message === "This invitation has expired" ||
            message === "This invitation is no longer valid"
          ? 410
          : message === "Sign up did not return a user id."
            ? 500
            : 400;
    return NextResponse.json({ detail: message }, { status });
  }
}
