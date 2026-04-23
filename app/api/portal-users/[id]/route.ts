import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getUserById,
  setPortalUserActiveByAdmin,
} from "@/services/portal-users";
import { isUuid } from "@/lib/utils/uuid";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ detail: "Invalid user id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const numericId = parseInt(id, 10);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return NextResponse.json({ detail: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const is_active = body?.is_active;
  if (typeof is_active !== "boolean") {
    return NextResponse.json(
      { detail: "Expected JSON body { is_active: boolean }." },
      { status: 400 },
    );
  }

  try {
    const updated = await setPortalUserActiveByAdmin(id, is_active);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to update user";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "User not found"
            ? 404
            : message.includes("cannot deactivate") ||
                message.includes("your own")
              ? 400
              : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
