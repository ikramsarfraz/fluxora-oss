import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { payments } from "@/db/schema";

import { getCurrentTenant } from "./tenants";

/**
 * Tenant-scoped list of customer payments, newest first. Each row is joined
 * to its sales invoice (with customer) plus the portal user who recorded it.
 */
export async function getPayments() {
  const tenant = await getCurrentTenant();
  return db.query.payments.findMany({
    where: eq(payments.tenantId, tenant.id),
    with: {
      salesInvoice: {
        with: {
          customer: true,
        },
      },
      createdBy: true,
    },
    orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
  });
}

/** Row shape returned by `getPayments()` (client-safe via `import type`). */
export type PaymentListItem = Awaited<ReturnType<typeof getPayments>>[number];

/**
 * Tenant-scoped payment detail. Returns `null` if no payment matches.
 */
export async function getPaymentById(id: string) {
  const tenant = await getCurrentTenant();
  const row = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), eq(payments.tenantId, tenant.id)),
    with: {
      salesInvoice: {
        with: {
          customer: true,
        },
      },
      createdBy: true,
    },
  });
  return row ?? null;
}

export type PaymentDetail = NonNullable<
  Awaited<ReturnType<typeof getPaymentById>>
>;
