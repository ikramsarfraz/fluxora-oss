import "server-only";

import { and, desc, eq, gte, or, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  paymentMatches,
  plaidConnections,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export type TransactionState = "matched" | "pending_review" | "unmatched";

export type ActivityTransaction = {
  id: string;
  date: string;
  amount: number;
  merchantName: string | null;
  rawDescription: string;
  paymentChannel: string;
  paymentMethod: string;
  checkNumber: number | null;
  isMysteryOutflow: boolean;
  pending: boolean;
  accountName: string;
  accountMask: string | null;
  state: TransactionState;
  match?: {
    id: string;
    confidence: number;
    autoApplied: boolean;
    status: string;
    amountScore: number;
    payeeScore: number;
    timingScore: number;
    invoice: {
      id: string;
      invoiceNumber: string;
      totalAmount: number;
      invoiceDate: string;
      supplierName: string | null;
    };
  };
};

export type AccountSummary = {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  currentBalance: number;
  institutionName: string | null;
  connectionStatus: string;
  lastSyncAt: Date | null;
};

export async function getBankActivity(filter?: TransactionState | "all"): Promise<{
  transactions: ActivityTransaction[];
  accounts: AccountSummary[];
  counts: Record<TransactionState, number> & { pending: number; mystery: number };
  lastSyncAt: Date | null;
}> {
  const tenant = await getCurrentTenant();

  const activeConnections = await db.query.plaidConnections.findMany({
    where: and(
      eq(plaidConnections.tenantId, tenant.id),
    ),
    with: { bankAccounts: true },
  });

  const activeConns = activeConnections.filter(c => c.status !== "disconnected");

  const accounts: AccountSummary[] = activeConns.flatMap(conn =>
    conn.bankAccounts.map(a => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
      currentBalance: Number(a.currentBalance ?? 0),
      institutionName: conn.institutionName,
      connectionStatus: conn.status,
      lastSyncAt: conn.lastSyncAt ? new Date(conn.lastSyncAt) : null,
    })),
  );

  const accountIds = accounts.map(a => a.id);

  if (accountIds.length === 0) {
    return {
      transactions: [],
      accounts,
      counts: { matched: 0, pending_review: 0, unmatched: 0, pending: 0, mystery: 0 },
      lastSyncAt: null,
    };
  }

  // Fetch last 90 days of transactions
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split("T")[0];

  const txns = await db.query.bankTransactions.findMany({
    where: and(
      eq(bankTransactions.tenantId, tenant.id),
      gte(bankTransactions.date, cutoff),
    ),
    with: {
      paymentMatches: {
        where: (pm) =>
          or(
            eq(pm.status, "auto_applied"),
            eq(pm.status, "confirmed"),
            eq(pm.status, "pending_review"),
          ),
        with: {
          supplierInvoice: {
            with: { supplier: true },
          },
        },
        orderBy: (pm, { desc }) => [desc(pm.confidence)],
        limit: 1,
      },
      bankAccount: true,
    },
    orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
    limit: 200,
  });

  const counters: Record<TransactionState, number> & { pending: number; mystery: number } = {
    matched: 0,
    pending_review: 0,
    unmatched: 0,
    pending: 0,
    mystery: 0,
  };

  const result: ActivityTransaction[] = [];

  for (const txn of txns) {
    const bestMatch = txn.paymentMatches[0];
    let state: TransactionState = "unmatched";

    if (bestMatch) {
      if (bestMatch.status === "auto_applied" || bestMatch.status === "confirmed") {
        state = "matched";
      } else if (bestMatch.status === "pending_review") {
        state = "pending_review";
      }
    }

    counters[state]++;
    if (txn.pending) counters.pending++;
    if (txn.isMysteryOutflow && !txn.pending) counters.mystery++;

    if (filter && filter !== "all" && state !== filter) continue;

    result.push({
      id: txn.id,
      date: txn.date,
      amount: Number(txn.amount),
      merchantName: txn.merchantName,
      rawDescription: txn.rawDescription,
      paymentChannel: txn.paymentChannel ?? "other",
      paymentMethod: txn.paymentMethod ?? "other",
      checkNumber: txn.checkNumber ?? null,
      isMysteryOutflow: txn.isMysteryOutflow ?? false,
      pending: txn.pending,
      accountName: txn.bankAccount?.name ?? "Unknown",
      accountMask: txn.bankAccount?.mask ?? null,
      state,
      match: bestMatch
        ? {
            id: bestMatch.id,
            confidence: Number(bestMatch.confidence),
            autoApplied: bestMatch.autoApplied,
            status: bestMatch.status,
            amountScore: Number(bestMatch.amountScore ?? 0),
            payeeScore: Number(bestMatch.payeeScore ?? 0),
            timingScore: Number(bestMatch.timingScore ?? 0),
            invoice: {
              id: bestMatch.supplierInvoice?.id ?? "",
              invoiceNumber: bestMatch.supplierInvoice?.invoiceNumber ?? "",
              totalAmount: Number(bestMatch.supplierInvoice?.totalAmount ?? 0),
              invoiceDate: bestMatch.supplierInvoice?.invoiceDate ?? "",
              supplierName: bestMatch.supplierInvoice?.supplier?.name ?? null,
            },
          }
        : undefined,
    });
  }

  const lastSyncAt = activeConns.reduce<Date | null>((latest, conn) => {
    if (!conn.lastSyncAt) return latest;
    const d = new Date(conn.lastSyncAt);
    return !latest || d > latest ? d : latest;
  }, null);

  return { transactions: result, accounts, counts: counters, lastSyncAt };
}
