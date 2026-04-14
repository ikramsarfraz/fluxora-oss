import { NextResponse } from "next/server";

import { createPortalUser } from "@/services/portal-users";

export async function POST(request: Request) {
  const body = await request.json();
  const { authUserId, fullName, email, role } = body;
  try {
    const portalUser = await createPortalUser({
      authUserId,
      fullName,
      email,
      role,
    });
    return NextResponse.json(portalUser);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { detail: "Failed to create portal user" },
      { status: 500 },
    );
  }
}
