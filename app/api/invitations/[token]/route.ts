import { NextResponse } from "next/server";

import { getInvitationPreview } from "@/services/invitations";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const preview = await getInvitationPreview(token);

  if (!preview.ok) {
    const detail =
      preview.reason === "not_found"
        ? "Invitation not found"
        : preview.reason === "expired"
          ? "This invitation has expired"
          : "This invitation is no longer valid";
    const status = preview.reason === "not_found" ? 404 : 410;
    return NextResponse.json({ detail }, { status });
  }

  return NextResponse.json({
    fullName: preview.fullName,
    email: preview.email,
    role: preview.role,
  });
}
