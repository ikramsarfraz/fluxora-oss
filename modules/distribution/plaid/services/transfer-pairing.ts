import "server-only";

import { and, eq, gte, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { bankTransactions } from "@/db/schema";

import { detectTransferPairs } from "../utils/transfer-pairing";

/**
 * Look across the tenant's recent posted bank transactions for intra-bank
 * transfer pairs (outflow on account A + inflow on account B, same amount,
 * within a few days) and mark each pair with a shared transfer_pair_id.
 *
 * Idempotent: only candidates with transfer_pair_id IS NULL participate, so
 * a second run won't re-pair the same rows. Failures bubble up to the
 * caller; the sync handler swallows them so transfer pairing can't break
 * the broader sync flow.
 *
 * Scope window: last 30 days. Larger than the per-pair date window so a
 * late-settling leg can still find its partner if one side posted ~3 weeks
 * before the other (uncommon, but plausible for ACH).
 */
export async function pairRecentTransfers(
  tenantId: string,
  options?: { sinceDays?: number },
): Promise<{ pairsCreated: number }> {
  const sinceDays = options?.sinceDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const candidates = await db
    .select({
      id: bankTransactions.id,
      bankAccountId: bankTransactions.bankAccountId,
      amount: bankTransactions.amount,
      date: bankTransactions.date,
      isoCurrencyCode: bankTransactions.isoCurrencyCode,
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        eq(bankTransactions.pending, false),
        isNull(bankTransactions.transferPairId),
        gte(bankTransactions.date, cutoffIso),
        ne(bankTransactions.amount, "0"),
      ),
    );

  if (candidates.length === 0) {
    return { pairsCreated: 0 };
  }

  const pairs = detectTransferPairs(
    candidates.map(c => ({
      id: c.id,
      bankAccountId: c.bankAccountId,
      amount: Number(c.amount),
      date: c.date,
      isoCurrencyCode: c.isoCurrencyCode ?? "USD",
    })),
  );

  // Apply pair ids. Each pair is two UPDATEs; one tx per pair keeps the
  // pair atomic so we can never end up with a half-paired transfer if the
  // process is killed mid-loop.
  for (const pair of pairs) {
    await db.transaction(async tx => {
      // Clearing isMysteryOutflow on the same UPDATE matters: the per-txn
      // matcher already ran during the sync loop and may have flagged the
      // outflow leg as a mystery before its inflow partner was even synced.
      // Pairing later proves it wasn't a mystery, so we retract the flag
      // (mysteryDismissedAt stays null — the system never user-confirmed it).
      await tx
        .update(bankTransactions)
        .set({ transferPairId: pair.pairId, isMysteryOutflow: false })
        .where(
          and(
            eq(bankTransactions.id, pair.outflowId),
            eq(bankTransactions.tenantId, tenantId),
            isNull(bankTransactions.transferPairId),
          ),
        );
      await tx
        .update(bankTransactions)
        .set({ transferPairId: pair.pairId, isMysteryOutflow: false })
        .where(
          and(
            eq(bankTransactions.id, pair.inflowId),
            eq(bankTransactions.tenantId, tenantId),
            isNull(bankTransactions.transferPairId),
          ),
        );
    });
  }

  return { pairsCreated: pairs.length };
}
