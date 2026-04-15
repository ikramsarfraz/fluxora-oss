import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getUserById } from "@/services/portal-users";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const numericId = parseInt(id, 10);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return NextResponse.json({ detail: "Invalid user id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(numericId);
  if (!user) {
    return NextResponse.json({ detail: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
