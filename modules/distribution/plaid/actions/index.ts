"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bankAccounts, bankTransactions, paymentMatches, plaidConnections } from "@/db/schema";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getPlaidClient } from "../services/plaid-client";
import { confirmMatch, rejectMatch } from "../services/transaction-matching";
import { decryptToken } from "@/lib/crypto/token-encryption";

export async function confirmPaymentMatch(matchId: string) {
  const [user] = await Promise.all([getCurrentPortalUser()]);
  await confirmMatch(matchId, user.id);
  revalidatePath("/bank-activity");
  revalidatePath("/supplier-invoices", "layout");
}

export async function rejectPaymentMatch(matchId: string) {
  await rejectMatch(matchId);
  revalidatePath("/bank-activity");
}

export async function linkToDifferentBill(matchId: string, newInvoiceId: string) {
  const user = await getCurrentPortalUser();
  const tenant = await getCurrentTenant();

  const existing = await db.query.paymentMatches.findFirst({
    where: and(
      eq(paymentMatches.id, matchId),
      eq(paymentMatches.tenantId, tenant.id),
    ),
  });
  if (!existing) throw new Error("Match not found");

  // Reject old match, create new one with max confidence (user chose it)
  await rejectMatch(matchId);
  await db.insert(paymentMatches).values({
    tenantId: tenant.id,
    bankTransactionId: existing.bankTransactionId,
    supplierInvoiceId: newInvoiceId,
    status: "confirmed",
    confidence: "1.0000",
    autoApplied: false,
    amountScore: "1.0000",
    payeeScore: "1.0000",
    timingScore: "1.0000",
    confirmedByUserId: user.id,
    confirmedAt: new Date(),
  });

  await confirmMatch(matchId, user.id);
  revalidatePath("/bank-activity");
  revalidatePath("/supplier-invoices", "layout");
}

export async function disconnectBank(connectionId: string) {
  const tenant = await getCurrentTenant();
  const connection = await db.query.plaidConnections.findFirst({
    where: and(
      eq(plaidConnections.id, connectionId),
      eq(plaidConnections.tenantId, tenant.id),
    ),
  });
  if (!connection) throw new Error("Connection not found");

  try {
    const client = getPlaidClient();
    const accessToken = decryptToken(connection.encryptedAccessToken);
    await client.itemRemove({ access_token: accessToken });
  } catch {
    // Continue even if Plaid remove fails — we still soft-delete locally
  }

  // Soft delete: mark disconnected, preserve transaction history
  await db
    .update(plaidConnections)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(plaidConnections.id, connectionId));

  revalidatePath("/settings/banks");
  revalidatePath("/bank-activity");
  revalidatePath("/inbox");
}

export async function getConnectedBanks() {
  const tenant = await getCurrentTenant();
  const connections = await db.query.plaidConnections.findMany({
    where: and(
      eq(plaidConnections.tenantId, tenant.id),
    ),
    with: { bankAccounts: true },
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });

  return connections
    .filter(c => c.status !== "disconnected")
    .map(c => ({
      id: c.id,
      institutionName: c.institutionName,
      institutionId: c.institutionId,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      accountCount: c.bankAccounts.length,
      accounts: c.bankAccounts.map(a => ({
        id: a.id,
        name: a.name,
        officialName: a.officialName,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        currentBalance: Number(a.currentBalance ?? 0),
      })),
    }));
}
