import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { paymentMatches } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

/**
 * Returns the bank transaction currently linked to this expense, if any.
 * The lookup goes through payment_matches; rejected matches don't count
 * (a rejected link is treated as "no link").
 *
 * Lives in the expense module rather than plaid because the detail page
 * is the caller and module-boundary rules forbid expense components from
 * importing plaid module paths. Reading from the shared `db/schema`
 * tables is allowed.
 */
export type LinkedBankTransactionForExpense = {
  matchId: string;
  bankTransactionId: string;
  date: string;
  amount: number;
  merchantName: string | null;
  rawDescription: string;
  paymentMethod: string;
  accountName: string | null;
  accountMask: string | null;
  confirmedAt: Date | null;
};

export async function getLinkedBankTransactionForExpense(
  expenseId: string,
): Promise<LinkedBankTransactionForExpense | null> {
  const tenant = await getCurrentTenant();
  const row = await db.query.paymentMatches.findFirst({
    where: and(
      eq(paymentMatches.expenseId, expenseId),
      eq(paymentMatches.tenantId, tenant.id),
      ne(paymentMatches.status, "rejected"),
    ),
    with: {
      bankTransaction: {
        with: { bankAccount: true },
      },
    },
  });
  if (!row || !row.bankTransaction) return null;
  return {
    matchId: row.id,
    bankTransactionId: row.bankTransactionId,
    date: row.bankTransaction.date,
    amount: Number(row.bankTransaction.amount),
    merchantName: row.bankTransaction.merchantName,
    rawDescription: row.bankTransaction.rawDescription,
    paymentMethod: row.bankTransaction.paymentMethod ?? "other",
    accountName: row.bankTransaction.bankAccount?.name ?? null,
    accountMask: row.bankTransaction.bankAccount?.mask ?? null,
    confirmedAt: row.confirmedAt,
  };
}

