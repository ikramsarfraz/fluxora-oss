import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { platformUsers } from "@/db/schema";

/**
 * Platform admins (rows in `platform_users` with `is_active = true`) bypass
 * application-level rate limits — they need to debug production without
 * being throttled. Keyed on the Better Auth user id.
 *
 * Lives in its own module so edge runtimes (middleware) can import rate-limit
 * primitives without pulling in the db client.
 */
export async function isPlatformAdminAuthUser(
  authUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(
      and(
        eq(platformUsers.authUserId, authUserId),
        eq(platformUsers.isActive, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}
