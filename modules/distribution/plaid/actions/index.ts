"use server";

import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  payeeAliases,
  paymentMatches,
  plaidConnections,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getPlaidClient } from "../services/plaid-client";
import { confirmMatch, normalizePayeeText, rejectMatch } from "../services/transaction-matching";
import { fireSandboxTransactionForInvoice } from "../services/sandbox-auto-fire";
import { decryptToken } from "@/lib/crypto/token-encryption";

export async function confirmPaymentMatch(matchId: string) {
  const [user, tenant] = await Promise.all([getCurrentPortalUser(), getCurrentTenant()]);
  await confirmMatch(matchId, user.id, tenant.id);
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "payment_match.confirmed",
    resourceType: "payment_match",
    resourceId: matchId,
  });
  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "payment_match.confirmed",
  });
  revalidatePath("/bank-activity");
  revalidatePath("/supplier-invoices", "layout");
}

export async function rejectPaymentMatch(matchId: string) {
  const [user, tenant] = await Promise.all([
    getCurrentPortalUser(),
    getCurrentTenant(),
  ]);
  await rejectMatch(matchId, tenant.id);
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "payment_match.unmatched",
    resourceType: "payment_match",
    resourceId: matchId,
  });
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
  await rejectMatch(matchId, tenant.id);
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

  await confirmMatch(matchId, user.id, tenant.id);
  revalidatePath("/bank-activity");
  revalidatePath("/supplier-invoices", "layout");
}

export async function fireSandboxTransactionAction(invoiceId: string) {
  const tenant = await getCurrentTenant();
  const result = await fireSandboxTransactionForInvoice(invoiceId, tenant.id);
  if (result.fired) {
    revalidatePath("/bank-activity");
    revalidatePath("/supplier-invoices", "layout");
  }
  return result;
}

export async function disconnectBank(connectionId: string) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
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

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "plaid.connection_removed",
    resourceType: "plaid_connection",
    resourceId: connectionId,
    metadata: {
      institutionName: connection.institutionName,
      institutionId: connection.institutionId,
    },
  });

  revalidatePath("/settings/banks");
  revalidatePath("/bank-activity");
  revalidatePath("/inbox");
}

export async function linkTransactionToBillAction(txnId: string, invoiceId: string) {
  const user = await getCurrentPortalUser();
  const tenant = await getCurrentTenant();

  const [txn, invoice] = await Promise.all([
    db.query.bankTransactions.findFirst({
      where: and(eq(bankTransactions.id, txnId), eq(bankTransactions.tenantId, tenant.id)),
    }),
    db.query.supplierInvoices.findFirst({
      where: and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.tenantId, tenant.id)),
      with: { supplier: true },
    }),
  ]);
  if (!txn) throw new Error("Transaction not found");
  if (!invoice) throw new Error("Invoice not found");

  // Reject any existing pending match for this transaction
  const existing = await db.query.paymentMatches.findFirst({
    where: and(
      eq(paymentMatches.bankTransactionId, txnId),
      eq(paymentMatches.tenantId, tenant.id),
      or(eq(paymentMatches.status, "pending_review"), eq(paymentMatches.status, "auto_applied")),
    ),
  });
  if (existing) {
    await rejectMatch(existing.id, tenant.id);
  }

  // Create confirmed match at max confidence — user explicitly chose it
  const [inserted] = await db.insert(paymentMatches).values({
    tenantId: tenant.id,
    bankTransactionId: txnId,
    supplierInvoiceId: invoiceId,
    status: "confirmed",
    confidence: "1.0000",
    autoApplied: false,
    amountScore: "1.0000",
    payeeScore: "0.0000",
    timingScore: "1.0000",
    confirmedByUserId: user.id,
    confirmedAt: new Date(),
  }).returning({ id: paymentMatches.id });

  // Mark invoice paid
  await db
    .update(supplierInvoices)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(supplierInvoices.id, invoiceId));

  // Store channel-scoped alias (skip checks — no payee signal)
  const method = txn.paymentMethod ?? "ach";
  if (method !== "check" && invoice.supplier?.id) {
    const raw = txn.rawDescription;
    const normalized = normalizePayeeText(raw);
    await db
      .insert(payeeAliases)
      .values({
        tenantId: tenant.id,
        rawText: raw,
        normalizedText: normalized,
        supplierId: invoice.supplier.id,
        source: "confirmed",
        channel: method,
      })
      .onConflictDoUpdate({
        target: [payeeAliases.tenantId, payeeAliases.channel, payeeAliases.normalizedText],
        set: { supplierId: invoice.supplier.id, source: "confirmed", updatedAt: new Date() },
      });
  }

  revalidatePath("/bank-activity");
  revalidatePath("/supplier-invoices", "layout");
  return { matchId: inserted.id };
}

export async function dismissMysteryOutflowAction(txnId: string) {
  const tenant = await getCurrentTenant();
  await db
    .update(bankTransactions)
    .set({ mysteryDismissedAt: new Date(), isMysteryOutflow: false, updatedAt: new Date() })
    .where(and(eq(bankTransactions.id, txnId), eq(bankTransactions.tenantId, tenant.id)));
  revalidatePath("/inbox");
  revalidatePath("/bank-activity");
}

export async function markAsNonBillExpenseAction(txnId: string) {
  const tenant = await getCurrentTenant();
  // Same effect as dismiss — clear the mystery flag + record the dismissal timestamp
  await db
    .update(bankTransactions)
    .set({ mysteryDismissedAt: new Date(), isMysteryOutflow: false, updatedAt: new Date() })
    .where(and(eq(bankTransactions.id, txnId), eq(bankTransactions.tenantId, tenant.id)));
  revalidatePath("/inbox");
  revalidatePath("/bank-activity");
}

export async function getOpenBillsForLinkingAction(txnId: string, proximity: "exact" | "5pct" | "15pct" | "all") {
  const tenant = await getCurrentTenant();

  const txn = await db.query.bankTransactions.findFirst({
    where: and(eq(bankTransactions.id, txnId), eq(bankTransactions.tenantId, tenant.id)),
  });
  if (!txn) throw new Error("Transaction not found");

  const amount = Math.abs(Number(txn.amount));
  const toleranceMap = { exact: 0.001, "5pct": 0.05, "15pct": 0.15, all: 10 };
  const tolerance = toleranceMap[proximity];

  const bills = await db
    .select({
      id: supplierInvoices.id,
      invoiceNumber: supplierInvoices.invoiceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      totalAmount: supplierInvoices.totalAmount,
      supplierId: supplierInvoices.supplierId,
      supplierName: suppliers.name,
      lineCount: sql<number>`(SELECT count(*) FROM supplier_invoice_lines sil WHERE sil.supplier_invoice_id = ${supplierInvoices.id})::int`,
    })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(and(
      eq(supplierInvoices.tenantId, tenant.id),
      or(
        eq(supplierInvoices.status, "posted"),
        eq(supplierInvoices.status, "reconciled"),
        eq(supplierInvoices.status, "completed"),
      ),
      proximity === "all"
        ? sql`1=1`
        : and(
          gte(supplierInvoices.totalAmount, (amount * (1 - tolerance)).toFixed(4)),
          lte(supplierInvoices.totalAmount, (amount * (1 + tolerance)).toFixed(4)),
        ),
    ))
    .orderBy(sql`abs(${supplierInvoices.totalAmount}::numeric - ${amount})`)
    .limit(50);

  return {
    bills: bills.map(b => ({
      ...b,
      totalAmount: Number(b.totalAmount),
      delta: Number(b.totalAmount) - amount,
      deltaPct: amount > 0 ? ((Number(b.totalAmount) - amount) / amount) * 100 : 0,
    })),
    transactionAmount: amount,
  };
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
