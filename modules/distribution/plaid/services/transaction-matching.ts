import "server-only";

import { and, between, eq, gte, lte, or } from "drizzle-orm";
import { differenceInDays } from "date-fns";
import { db } from "@/db";
import {
  bankTransactions,
  payeeAliases,
  paymentMatches,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import { levenshteinDistance } from "@/modules/distribution/supplier-invoices/utils/normalization";

type BankTransaction = typeof bankTransactions.$inferSelect;

export type MatchFactors = {
  amountScore: number;
  payeeScore: number;
  timingScore: number;
};

export type MatchResult = {
  invoiceId: string;
  confidence: number;
  factors: MatchFactors;
  autoApply: boolean;
};

export async function runMatchingForTransaction(txn: BankTransaction): Promise<void> {
  const result = await scoreTransaction(txn);
  if (!result) return;

  if (result.confidence < 0.6) return;

  // Check if a match already exists
  const existing = await db.query.paymentMatches.findFirst({
    where: and(
      eq(paymentMatches.bankTransactionId, txn.id),
      eq(paymentMatches.supplierInvoiceId, result.invoiceId),
    ),
  });
  if (existing) return;

  const status = result.autoApply ? "auto_applied" : "pending_review";

  await db.insert(paymentMatches).values({
    tenantId: txn.tenantId,
    bankTransactionId: txn.id,
    supplierInvoiceId: result.invoiceId,
    status,
    confidence: result.confidence.toFixed(4),
    autoApplied: result.autoApply,
    amountScore: result.factors.amountScore.toFixed(4),
    payeeScore: result.factors.payeeScore.toFixed(4),
    timingScore: result.factors.timingScore.toFixed(4),
  });

  if (result.autoApply) {
    await db
      .update(supplierInvoices)
      .set({ status: "paid", updatedAt: new Date() })
      .where(and(
        eq(supplierInvoices.id, result.invoiceId),
        eq(supplierInvoices.tenantId, txn.tenantId),
      ));
  }
}

export async function confirmMatch(
  matchId: string,
  confirmedByUserId: string,
): Promise<void> {
  const match = await db.query.paymentMatches.findFirst({
    where: eq(paymentMatches.id, matchId),
    with: {
      bankTransaction: true,
      supplierInvoice: { with: { supplier: true } },
    },
  });
  if (!match) throw new Error("Match not found");

  await db
    .update(paymentMatches)
    .set({
      status: "confirmed",
      confirmedByUserId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentMatches.id, matchId));

  await db
    .update(supplierInvoices)
    .set({ status: "paid", updatedAt: new Date() })
    .where(eq(supplierInvoices.id, match.supplierInvoiceId));

  // Learn the payee alias
  if (match.supplierInvoice?.supplier?.id) {
    const raw = match.bankTransaction.rawDescription;
    const normalized = normalizePayeeText(raw);
    await db
      .insert(payeeAliases)
      .values({
        tenantId: match.tenantId,
        rawText: raw,
        normalizedText: normalized,
        supplierId: match.supplierInvoice.supplier.id,
        source: "confirmed",
      })
      .onConflictDoUpdate({
        target: payeeAliases.normalizedText,
        set: {
          supplierId: match.supplierInvoice.supplier.id,
          source: "confirmed",
          updatedAt: new Date(),
        },
      });
  }
}

export async function rejectMatch(matchId: string): Promise<void> {
  await db
    .update(paymentMatches)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(paymentMatches.id, matchId));
}

// ── Scoring ────────────────────────────────────────────────────────────────

async function scoreTransaction(txn: BankTransaction): Promise<MatchResult | null> {
  const amount = Number(txn.amount);
  if (amount <= 0) return null; // inflows are not bill payments

  const txnDate = new Date(txn.date);
  const windowStart = new Date(txnDate);
  windowStart.setDate(windowStart.getDate() - 60);

  const candidates = await db
    .select({
      id: supplierInvoices.id,
      totalAmount: supplierInvoices.totalAmount,
      invoiceDate: supplierInvoices.invoiceDate,
      supplierId: supplierInvoices.supplierId,
      supplierName: suppliers.name,
    })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(and(
      eq(supplierInvoices.tenantId, txn.tenantId),
      or(
        eq(supplierInvoices.status, "posted"),
        eq(supplierInvoices.status, "reconciled"),
        eq(supplierInvoices.status, "completed"),
      ),
      gte(
        supplierInvoices.totalAmount,
        (amount * 0.98).toFixed(4),
      ),
      lte(
        supplierInvoices.totalAmount,
        (amount * 1.02).toFixed(4),
      ),
      gte(supplierInvoices.invoiceDate, windowStart.toISOString().split("T")[0]),
      lte(supplierInvoices.invoiceDate, txnDate.toISOString().split("T")[0]),
    ))
    .limit(20);

  if (candidates.length === 0) return null;

  type Scored = { invoiceId: string; composite: number; factors: MatchFactors };
  const scored: Scored[] = [];

  for (const c of candidates) {
    const amountScore = scoreAmount(Number(c.totalAmount), amount);
    const payeeScore = await scorePayee(
      txn.tenantId,
      c.supplierId,
      c.supplierName,
      txn.merchantName,
      txn.rawDescription,
    );
    const timingScore = scoreTiming(c.invoiceDate, txn.date);
    const composite = amountScore * 0.5 + payeeScore * 0.35 + timingScore * 0.15;
    scored.push({ invoiceId: c.id, composite, factors: { amountScore, payeeScore, timingScore } });
  }

  scored.sort((a, b) => b.composite - a.composite);
  const best = scored[0];

  return {
    invoiceId: best.invoiceId,
    confidence: best.composite,
    factors: best.factors,
    autoApply: best.composite >= 0.95,
  };
}

function scoreAmount(billTotal: number, txnAmount: number): number {
  const diff = Math.abs(billTotal - txnAmount) / billTotal;
  if (diff < 0.001) return 1.0;
  if (diff < 0.02) return 0.95;
  return 0;
}

async function scorePayee(
  tenantId: string,
  supplierId: string | null,
  supplierName: string | null,
  merchantName: string | null,
  rawDesc: string,
): Promise<number> {
  if (!supplierId) return 0.2;

  // Check existing alias
  const normalizedRaw = normalizePayeeText(rawDesc);
  const alias = await db.query.payeeAliases.findFirst({
    where: and(
      eq(payeeAliases.tenantId, tenantId),
      eq(payeeAliases.normalizedText, normalizedRaw),
    ),
  });
  if (alias) {
    return alias.supplierId === supplierId ? 1.0 : 0.0;
  }

  if (!supplierName) return 0.2;

  const candidates = [merchantName, rawDesc.substring(0, 40)].filter(Boolean) as string[];
  const bestSim = Math.max(
    ...candidates.map(c => stringSimilarity(c.toLowerCase(), supplierName.toLowerCase())),
  );

  if (bestSim > 0.85) return 0.9;
  if (bestSim > 0.65) return 0.6;
  return 0.2;
}

function scoreTiming(invoiceDateStr: string, txnDateStr: string): number {
  const invoiceDate = new Date(invoiceDateStr);
  const txnDate = new Date(txnDateStr);
  const daysOff = differenceInDays(txnDate, invoiceDate);
  if (daysOff >= -3 && daysOff <= 7) return 1.0;
  if (daysOff > 7 && daysOff <= 30) return 0.7;
  if (daysOff < -3) return 0.5;
  return 0.3;
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

export function normalizePayeeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
}
