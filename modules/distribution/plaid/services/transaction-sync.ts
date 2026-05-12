import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { AccountBase, Transaction } from "plaid";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  plaidConnections,
} from "@/db/schema";
import { decryptToken } from "@/lib/crypto/token-encryption";
import { getPlaidClient } from "./plaid-client";
import { runMatchingForTransaction } from "./transaction-matching";
import { snapshotBalancesForConnection } from "./balance-snapshot";

export async function syncConnection(connectionId: string): Promise<{
  added: number;
  modified: number;
  removed: number;
}> {
  const connection = await db.query.plaidConnections.findFirst({
    where: eq(plaidConnections.id, connectionId),
    with: { bankAccounts: true },
  });
  if (!connection) throw new Error(`Connection ${connectionId} not found`);
  if (connection.status === "disconnected") {
    throw new Error("Connection is disconnected");
  }

  const client = getPlaidClient();
  const accessToken = decryptToken(connection.encryptedAccessToken);

  let added = 0;
  let modified = 0;
  let removed = 0;
  let cursor = connection.transactionCursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });
    const data = response.data;

    await upsertAccounts(connection.tenantId, connectionId, data.accounts);

    const accountIdMap = await buildAccountIdMap(connection.tenantId, connectionId);

    // Handle removed transactions
    if (data.removed.length > 0) {
      const plaidIds = data.removed.map(r => r.transaction_id).filter(Boolean) as string[];
      if (plaidIds.length > 0) {
        await db
          .delete(bankTransactions)
          .where(inArray(bankTransactions.plaidTransactionId, plaidIds));
        removed += plaidIds.length;
      }
    }

    // Handle added + modified transactions
    for (const txn of data.added) {
      const bankAccountId = accountIdMap.get(txn.account_id);
      if (!bankAccountId) continue;
      const row = transactionToRow(connection.tenantId, bankAccountId, txn);
      await db
        .insert(bankTransactions)
        .values(row)
        .onConflictDoUpdate({
          target: bankTransactions.plaidTransactionId,
          set: {
            pending: row.pending,
            amount: row.amount,
            merchantName: row.merchantName,
            rawDescription: row.rawDescription,
            paymentChannel: row.paymentChannel,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      added++;

      // Only run matching on posted (non-pending) outflows
      if (!txn.pending && Number(row.amount) > 0) {
        const inserted = await db.query.bankTransactions.findFirst({
          where: eq(bankTransactions.plaidTransactionId, txn.transaction_id),
        });
        if (inserted) {
          await runMatchingForTransaction(inserted).catch(() => {});
        }
      }
    }

    for (const txn of data.modified) {
      const bankAccountId = accountIdMap.get(txn.account_id);
      if (!bankAccountId) continue;
      const row = transactionToRow(connection.tenantId, bankAccountId, txn);
      const wasPosted = await db.query.bankTransactions.findFirst({
        where: and(
          eq(bankTransactions.plaidTransactionId, txn.transaction_id),
          eq(bankTransactions.pending, true),
        ),
      });
      await db
        .update(bankTransactions)
        .set({
          pending: row.pending,
          amount: row.amount,
          merchantName: row.merchantName,
          rawDescription: row.rawDescription,
          paymentChannel: row.paymentChannel,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bankTransactions.plaidTransactionId, txn.transaction_id));
      modified++;

      // Transaction just transitioned from pending → posted; run matching
      if (wasPosted && !txn.pending && Number(row.amount) > 0) {
        const updated = await db.query.bankTransactions.findFirst({
          where: eq(bankTransactions.plaidTransactionId, txn.transaction_id),
        });
        if (updated) {
          await runMatchingForTransaction(updated).catch(() => {});
        }
      }
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await db
    .update(plaidConnections)
    .set({ transactionCursor: cursor, lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(plaidConnections.id, connectionId));

  // Snapshot current balances so the inbox can compute 7-day balance change
  await snapshotBalancesForConnection(connectionId).catch(() => {});

  return { added, modified, removed };
}

export async function initialSync(connectionId: string, accessToken: string): Promise<void> {
  // Pull up to 90 days on initial connect
  const client = getPlaidClient();
  const connection = await db.query.plaidConnections.findFirst({
    where: eq(plaidConnections.id, connectionId),
  });
  if (!connection) return;

  await upsertAccountsFromToken(connection.tenantId, connectionId, accessToken, client);
  await syncConnection(connectionId);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function upsertAccounts(
  tenantId: string,
  connectionId: string,
  accounts: AccountBase[],
) {
  for (const account of accounts) {
    await db
      .insert(bankAccounts)
      .values({
        tenantId,
        plaidConnectionId: connectionId,
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
        currentBalance: account.balances.current?.toString() ?? null,
        availableBalance: account.balances.available?.toString() ?? null,
        isoCurrencyCode: account.balances.iso_currency_code ?? "USD",
        balanceUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: bankAccounts.plaidAccountId,
        set: {
          name: account.name,
          officialName: account.official_name ?? null,
          mask: account.mask ?? null,
          currentBalance: account.balances.current?.toString() ?? null,
          availableBalance: account.balances.available?.toString() ?? null,
          balanceUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertAccountsFromToken(
  tenantId: string,
  connectionId: string,
  accessToken: string,
  client: ReturnType<typeof getPlaidClient>,
) {
  const resp = await client.accountsGet({ access_token: accessToken });
  await upsertAccounts(tenantId, connectionId, resp.data.accounts);
}

async function buildAccountIdMap(
  tenantId: string,
  connectionId: string,
): Promise<Map<string, string>> {
  const accounts = await db.query.bankAccounts.findMany({
    where: and(
      eq(bankAccounts.tenantId, tenantId),
      eq(bankAccounts.plaidConnectionId, connectionId),
    ),
  });
  return new Map(accounts.map(a => [a.plaidAccountId, a.id]));
}

function transactionToRow(
  tenantId: string,
  bankAccountId: string,
  txn: Transaction,
) {
  const KNOWN_CHANNELS = new Set(["ach", "wire", "check", "other"]);
  const rawChannel = txn.payment_channel ?? "other";
  const channel = (KNOWN_CHANNELS.has(rawChannel) ? rawChannel : "other") as
    | "ach"
    | "wire"
    | "check"
    | "other";
  return {
    tenantId,
    bankAccountId,
    plaidTransactionId: txn.transaction_id,
    date: txn.date,
    amount: txn.amount.toString(),
    merchantName: txn.merchant_name ?? null,
    rawDescription: txn.original_description ?? txn.name,
    paymentChannel: channel,
    pending: txn.pending,
    isoCurrencyCode: txn.iso_currency_code ?? "USD",
    plaidCategory: txn.category ?? [],
  };
}
