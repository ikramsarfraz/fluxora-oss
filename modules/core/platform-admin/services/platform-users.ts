import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getRequestTenantHostContext } from "@/lib/tenant-host";
import { platformUsers } from "@/db/schema";

export type PlatformUserRole = "platform_admin" | "support" | "qa";

export async function requirePlatformAdminHost() {
  const hostContext = await getRequestTenantHostContext();

  if (!hostContext.isPlatformAdminHost) {
    throw new Error("Platform admin host required");
  }

  return hostContext;
}

export async function getPlatformUserByAuthUserId(authUserId: string) {
  return (
    (await db.query.platformUsers.findFirst({
      where: and(
        eq(platformUsers.authUserId, authUserId),
        eq(platformUsers.isActive, true),
      ),
      with: {
        authUser: true,
      },
    })) ?? null
  );
}

export async function getCurrentPlatformUser() {
  await requirePlatformAdminHost();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const platformUser = await getPlatformUserByAuthUserId(session.user.id);

  if (!platformUser) {
    throw new Error("Forbidden");
  }

  return platformUser;
}

export async function requirePlatformUser() {
  return getCurrentPlatformUser();
}

export async function listPlatformUsers() {
  await requirePlatformUser();

  return db.query.platformUsers.findMany({
    with: {
      authUser: true,
    },
    orderBy: [desc(platformUsers.createdAt)],
  });
}

export type PlatformUserListItem = Awaited<ReturnType<typeof listPlatformUsers>>[number];
