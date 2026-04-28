import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers } from "@/db/schema";

/**
 * Email for new Stripe customers when the tenant has no `stripeCustomerId` yet.
 * Prefers an active owner, then admin, else any active user.
 */
export async function getPreferredBillingEmailForTenant(
  tenantId: string,
): Promise<string | null> {
  const rows = await db.query.portalUsers.findMany({
    where: and(
      eq(portalUsers.tenantId, tenantId),
      eq(portalUsers.isActive, true),
    ),
  });
  return (
    rows.find(r => r.role === "owner")?.email ??
    rows.find(r => r.role === "admin")?.email ??
    rows[0]?.email ??
    null
  );
}
