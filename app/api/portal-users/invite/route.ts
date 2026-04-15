import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { user as authUser } from "@/db/auth-schema";
import { db } from "@/db";
import { portalUsers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { inviteUser } from "@/services/auth";
import {
  getUserByAuthUserId,
  type PortalUserRole,
} from "@/services/portal-users";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    email,
    fullName,
    role,
  }: {
    email?: string;
    fullName?: string;
    role?: PortalUserRole;
  } = body;

  const emailTrim = (email ?? "").trim();
  const fullNameTrim = (fullName ?? "").trim();
  if (!emailTrim || !fullNameTrim) {
    return NextResponse.json(
      { detail: "Email and full name are required." },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const current = await getUserByAuthUserId(session.user.id);
  if (!current || current.role !== "admin") {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }

  const normalizedEmail = emailTrim.toLowerCase();

  const [existingPortal] = await db
    .select({ id: portalUsers.id })
    .from(portalUsers)
    .where(sql`lower(${portalUsers.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingPortal) {
    return NextResponse.json(
      {
        detail:
          "This email already belongs to a team member. They can sign in with their existing account.",
      },
      { status: 409 },
    );
  }

  const [existingAuth] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(sql`lower(${authUser.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingAuth) {
    return NextResponse.json(
      {
        detail:
          "An account with this email already exists. They should sign in instead of being invited.",
      },
      { status: 409 },
    );
  }

  try {
    await inviteUser({
      email: emailTrim,
      fullName: fullNameTrim,
      role: role ?? "sales",
      invitedByUserId: current.id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { detail: "Failed to send invitation" },
      { status: 500 },
    );
  }
}
