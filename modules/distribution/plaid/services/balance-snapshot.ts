import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccountBalanceSnapshots, bankAccounts, plaidConnections } from "@/db/schema";

/**
 * Upserts a balance snapshot for every bank account on the given connection,
 * using the current_balance already stored in bankAccounts (updated by syncConnection).
 * Safe to call multiple times per day — the unique constraint on (bank_account_id, snapshot_date)
 * means subsequent calls just overwrite with the latest balance for that date.
 */
export async function snapshotBalancesForConnection(connectionId: string): Promise<void> {
  const connection = await db.query.plaidConnections.findFirst({
    where: eq(plaidConnections.id, connectionId),
    columns: { tenantId: true },
    with: {
      bankAccounts: {
        columns: {
          id: true,
          tenantId: true,
          currentBalance: true,
          availableBalance: true,
        },
      },
    },
  });
  if (!connection) return;

  const today = new Date().toISOString().split("T")[0]!;

  for (const account of connection.bankAccounts) {
    if (account.currentBalance == null) continue;
    await db
      .insert(bankAccountBalanceSnapshots)
      .values({
        tenantId: account.tenantId,
        bankAccountId: account.id,
        snapshotDate: today,
        balance: account.currentBalance,
        availableBalance: account.availableBalance ?? null,
      })
      .onConflictDoUpdate({
        target: [bankAccountBalanceSnapshots.bankAccountId, bankAccountBalanceSnapshots.snapshotDate],
        set: {
          balance: account.currentBalance,
          availableBalance: account.availableBalance ?? null,
        },
      });
  }
}
