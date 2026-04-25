import { NextResponse } from "next/server";

import {
  getInvitationPreview,
  type InvitationPreviewFailureReason,
} from "@/services/invitations";

const PREVIEW_MESSAGES: Record<InvitationPreviewFailureReason, string> = {
  not_found: "Invitation not found",
  expired: "This invitation has expired",
  revoked: "This invitation was revoked",
  already_accepted: "This invitation was already used",
  invalid: "This invitation is not valid",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const preview = await getInvitationPreview(token);

  if (!preview.ok) {
    const code = preview.reason;
    const detail = PREVIEW_MESSAGES[code];
    const status = code === "not_found" ? 404 : 410;
    return NextResponse.json({ detail, code }, { status });
  }

  return NextResponse.json({
    fullName: preview.fullName,
    email: preview.email,
    role: preview.role,
  });
}
