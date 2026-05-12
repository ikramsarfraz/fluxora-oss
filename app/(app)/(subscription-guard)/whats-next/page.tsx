import { WhatsNextPage } from "@/modules/distribution/onboarding/components/whats-next-page";
import { getOnboardingStatus } from "@/modules/distribution/onboarding/actions";
import { db } from "@/db";
import { supplierInvoices } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { eq, min, sql } from "drizzle-orm";

export default async function WhatsNextRoutePage() {
  const [status, tenant] = await Promise.all([
    getOnboardingStatus(),
    getCurrentTenant(),
  ]);

  // Compute day count from oldest invoice
  const [row] = await db
    .select({ oldest: min(supplierInvoices.invoiceDate) })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.tenantId, tenant.id));

  const oldestDate = row?.oldest ? new Date(row.oldest) : null;
  const dayCount = oldestDate
    ? Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return <WhatsNextPage billCount={status.billCount} dayCount={dayCount} />;
}
