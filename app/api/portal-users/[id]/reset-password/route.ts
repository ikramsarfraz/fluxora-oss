import { NextResponse } from "next/server";

import { sendPasswordResetForUserByAdmin } from "@/services/portal-users";
import { isUuid } from "@/lib/utils/uuid";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ detail: "Invalid user id" }, { status: 400 });
  }
  try {
    await sendPasswordResetForUserByAdmin(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to send reset email";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "User not found"
            ? 404
            : 400;
    return NextResponse.json({ detail: message }, { status });
  }
}
