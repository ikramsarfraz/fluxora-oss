import { NextResponse } from "next/server";

import { createPortalUser, getUsers } from "@/services/portal-users";
import { getCurrentTenant } from "@/services/tenants";

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json(users);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to load users";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { authUserId, fullName, email, role } = body;
  const tenant = await getCurrentTenant();
  try {
    const portalUser = await createPortalUser({
      tenantId: tenant.id,
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
