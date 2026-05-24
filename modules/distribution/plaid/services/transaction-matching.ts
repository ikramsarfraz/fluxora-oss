import "server-only";

import { and, between, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { differenceInDays } from "date-fns";
import { db } from "@/db";
import {
  bankTransactions,
  payeeAliases,
  payments,
  paymentMatches,
  salesInvoices,
  supplierInvoices,
  suppliers,
} from "@/db/schema";
import { captureServerEvent } from "@/lib/posthog-server";
import { levenshteinDistance } from "@/modules/distribution/supplier-invoices/utils/normalization";

type BankTransaction = typeof bankTransactions.$inferSelect;

// ── Amount tolerance constants ─────────────────────────────────────────────

const MYSTERY_THRESHOLD_DEFAULT = 500;

// Plaid categories that are obviously not supplier payments
const RECURRING_CATEGORIES = [
  "Payroll",
  "Subscription",
  "Utilities",
  "Bank Fees",
  "Transfer",
  "Taxes",
  "Insurance",
  "Rent",
];

// ── Public types ───────────────────────────────────────────────────────────

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

// ── Main entry point ───────────────────────────────────────────────────────

export async function runMatchingForTransaction(txn: BankTransaction): Promise<void> {
  const amount = Number(txn.amount);

  // Convention in the bank_transactions table: positive = outflow (money
  // leaving our account → AP bills we paid); negative = inflow (money
  // landing in our account → AR invoices customers paid). The matcher
  // routes by sign.
  if (amount === 0) return;

  if (amount > 0) {
    await matchOutflowToBill(txn);
  } else {
    await matchInflowToSalesInvoice(txn);
  }
}

async function matchOutflowToBill(txn: BankTransaction): Promise<void> {
  const method = txn.paymentMethod ?? "other";
  let result: MatchResult | null = null;

  if (method === "check") {
    result = await matchCheck(txn);
  } else if (method === "zelle") {
    result = await matchZelle(txn);
  } else {
    // ach, wire, bill_pay, card, other — use existing payee+amount scorer
    result = await scoreTransaction(txn);
  }

  if (!result || result.confidence < 0.5) {
    await flagMysteryIfNeeded(txn);
    return;
  }

  // Avoid creating duplicate matches
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
    await captureServerEvent({
      userId: "system",
      tenantId: txn.tenantId,
      event: "payment_match.auto_applied",
      properties: {
        confidence: Number(result.confidence.toFixed(4)),
        channel: txn.paymentMethod ?? "other",
        direction: "outflow",
      },
    });
    await db
      .update(supplierInvoices)
      .set({ status: "paid", updatedAt: new Date() })
      .where(and(
        eq(supplierInvoices.id, result.invoiceId),
        eq(supplierInvoices.tenantId, txn.tenantId),
      ));
  }
}

/**
 * AR-side matcher: find an open sales_invoice whose balance_due is close
 * to the inflow amount and whose dates line up. No payee/payor matching
 * yet — customer-side aliases aren't built. V1 relies on amount + timing.
 */
async function matchInflowToSalesInvoice(txn: BankTransaction): Promise<void> {
  const inflowAmount = Math.abs(Number(txn.amount));
  if (inflowAmount <= 0) return;

  // Candidate set: open AR invoices with balance close to the inflow.
  // ±$10 floor + 5% relative tolerance handles fee skim and rounding.
  const tolerance = Math.max(inflowAmount * 0.05, 10);
  const candidates = await db
    .select({
      id: salesInvoices.id,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      balanceDue: salesInvoices.balanceDue,
    })
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.tenantId, txn.tenantId),
        ne(salesInvoices.status, "void"),
        sql`${salesInvoices.balanceDue}::numeric > 0`,
        sql`abs(${salesInvoices.balanceDue}::numeric - ${inflowAmount}) <= ${tolerance}`,
      ),
    )
    .limit(20);

  if (candidates.length === 0) {
    await flagMysteryIfNeeded(txn);
    return;
  }

  const scored = candidates.map(inv => {
    const balance = Number(inv.balanceDue);
    const balanceDiff = Math.abs(balance - inflowAmount);
    const amountScore = Math.max(0, 1 - balanceDiff / Math.max(inflowAmount, 1));
    const timingScore = scoreTiming(inv.invoiceDate, txn.date);
    // Weighted average: amount carries more for inflows since we don't
    // have a payee signal.
    const confidence = amountScore * 0.65 + timingScore * 0.35;
    return {
      invoiceId: inv.id,
      confidence,
      factors: { amountScore, payeeScore: 0, timingScore },
      // Auto-apply only on a near-exact amount match within 14 days.
      autoApply: amountScore >= 0.98 && timingScore >= 0.75,
    };
  });
  scored.sort((a, b) => b.confidence - a.confidence);
  const best = scored[0];

  if (best.confidence < 0.5) {
    await flagMysteryIfNeeded(txn);
    return;
  }

  const existing = await db.query.paymentMatches.findFirst({
    where: and(
      eq(paymentMatches.bankTransactionId, txn.id),
      eq(paymentMatches.salesInvoiceId, best.invoiceId),
    ),
  });
  if (existing) return;

  // AR auto-apply is structurally broken: applyArInflowToInvoice no-ops when
  // confirmedByUserId is null (payments.createdByUserId is NOT NULL). Marking
  // the match auto_applied without posting the payment leaves the invoice
  // unpaid while the UI shows "matched." Until a system-user sentinel exists,
  // every AR match goes to pending_review so the confirm step records the
  // payment atomically.
  await db.insert(paymentMatches).values({
    tenantId: txn.tenantId,
    bankTransactionId: txn.id,
    salesInvoiceId: best.invoiceId,
    status: "pending_review",
    confidence: best.confidence.toFixed(4),
    autoApplied: false,
    amountScore: best.factors.amountScore.toFixed(4),
    payeeScore: best.factors.payeeScore.toFixed(4),
    timingScore: best.factors.timingScore.toFixed(4),
  });
}

/**
 * Creates a `payments` row from a matched bank transaction and updates
 * the parent sales invoice's totals + status. Shared by the auto-apply
 * path and the user-confirmed path so they stay consistent.
 */
async function applyArInflowToInvoice(args: {
  tenantId: string;
  salesInvoiceId: string;
  bankTransactionId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  rawDescription: string | null;
  confirmedByUserId: string;
}): Promise<void> {
  const confirmedBy = args.confirmedByUserId;

  const validMethod: "cash" | "check" | "ach" | "zelle" | "credit_card" =
    args.paymentMethod === "check" ||
    args.paymentMethod === "ach" ||
    args.paymentMethod === "zelle" ||
    args.paymentMethod === "credit_card" ||
    args.paymentMethod === "cash"
      ? args.paymentMethod
      : "ach";

  await db.transaction(async tx => {
    const invoice = await tx.query.salesInvoices.findFirst({
      where: and(
        eq(salesInvoices.id, args.salesInvoiceId),
        eq(salesInvoices.tenantId, args.tenantId),
      ),
    });
    if (!invoice) return;

    const balanceDue = Number(invoice.balanceDue);
    if (balanceDue <= 0) return; // already paid; nothing to do

    // Apply the lesser of (txn amount, balance due) — we never over-apply.
    const applied = Math.min(args.amount, balanceDue);
    const newAmountPaid = Number(invoice.amountPaid) + applied;
    const totalAmount = Number(invoice.totalAmount);

    await tx.insert(payments).values({
      tenantId: args.tenantId,
      salesInvoiceId: args.salesInvoiceId,
      createdByUserId: confirmedBy,
      paymentDate: args.paymentDate,
      amount: applied.toFixed(2),
      paymentMethod: validMethod,
      referenceNumber: args.rawDescription
        ? args.rawDescription.slice(0, 128)
        : undefined,
      notes: `Auto-recorded from bank transaction ${args.bankTransactionId.slice(0, 8)}`,
    });

    await tx
      .update(salesInvoices)
      .set({
        amountPaid: newAmountPaid.toFixed(2),
        balanceDue: Math.max(totalAmount - newAmountPaid, 0).toFixed(2),
        status:
          newAmountPaid >= totalAmount
            ? "paid"
            : newAmountPaid > 0
              ? "partially_paid"
              : invoice.status,
      })
      .where(eq(salesInvoices.id, args.salesInvoiceId));
  });
}

export async function confirmMatch(
  matchId: string,
  confirmedByUserId: string,
  tenantId: string,
): Promise<void> {
  const match = await db.query.paymentMatches.findFirst({
    where: and(eq(paymentMatches.id, matchId), eq(paymentMatches.tenantId, tenantId)),
    with: {
      bankTransaction: true,
      supplierInvoice: { with: { supplier: true } },
      salesInvoice: true,
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
    .where(and(eq(paymentMatches.id, matchId), eq(paymentMatches.tenantId, tenantId)));

  if (match.supplierInvoiceId) {
    // AP path: flip the bill to paid. supplier_invoice_payments table
    // is NOT updated here — the existing flow treats a confirmed match
    // as "the bank settled this bill" without creating a separate
    // payment-event row. Phase B can revisit if we want AP payment
    // rows to mirror AR.
    await db
      .update(supplierInvoices)
      .set({ status: "paid", updatedAt: new Date() })
      .where(
        and(
          eq(supplierInvoices.id, match.supplierInvoiceId),
          eq(supplierInvoices.tenantId, tenantId),
        ),
      );

    // Learn channel-scoped payee alias (never for checks — no reliable payee signal)
    const txnMethod = match.bankTransaction?.paymentMethod ?? "ach";
    if (txnMethod !== "check" && match.supplierInvoice?.supplier?.id) {
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
          channel: txnMethod,
        })
        .onConflictDoUpdate({
          target: [payeeAliases.tenantId, payeeAliases.channel, payeeAliases.normalizedText],
          set: {
            supplierId: match.supplierInvoice.supplier.id,
            source: "confirmed",
            updatedAt: new Date(),
          },
        });
    }
    return;
  }

  if (match.salesInvoiceId) {
    // AR path: create a payments row reflecting the bank inflow + update
    // the invoice's denormalized totals + status. Unlike AP (where the
    // confirm just flips bill status), AR needs a real payment event so
    // the /payments listing, invoice detail history, and customer
    // portfolio all see the inflow.
    const inflowAmount = Math.abs(Number(match.bankTransaction.amount));
    await applyArInflowToInvoice({
      tenantId,
      salesInvoiceId: match.salesInvoiceId,
      bankTransactionId: match.bankTransactionId,
      paymentDate: match.bankTransaction.date,
      amount: inflowAmount,
      paymentMethod: match.bankTransaction.paymentMethod ?? "ach",
      rawDescription: match.bankTransaction.rawDescription ?? null,
      confirmedByUserId,
    });
  }
}

export async function rejectMatch(matchId: string, tenantId: string): Promise<void> {
  await db
    .update(paymentMatches)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(paymentMatches.id, matchId), eq(paymentMatches.tenantId, tenantId)));
}

// ── Channel-specific matchers ──────────────────────────────────────────────

async function matchCheck(txn: BankTransaction): Promise<MatchResult | null> {
  // Checks: amount-only, never auto-apply, no payee signal
  const candidates = await findOpenInvoicesByAmount(txn.tenantId, Number(txn.amount), 0.001);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  const timingScore = scoreTiming(best.invoiceDate, txn.date);

  if (candidates.length === 1) {
    return {
      invoiceId: best.id,
      confidence: 0.75,
      factors: { amountScore: 1.0, payeeScore: 0, timingScore },
      autoApply: false, // never auto-apply checks
    };
  }

  // Multiple candidates — surface the closest amount match as low-confidence
  return {
    invoiceId: best.id,
    confidence: 0.55,
    factors: { amountScore: 0.9, payeeScore: 0, timingScore },
    autoApply: false,
  };
}

async function matchZelle(txn: BankTransaction): Promise<MatchResult | null> {
  // Check Zelle-scoped aliases first
  const normalizedRaw = normalizePayeeText(txn.rawDescription);
  const alias = await db.query.payeeAliases.findFirst({
    where: and(
      eq(payeeAliases.tenantId, txn.tenantId),
      eq(payeeAliases.channel, "zelle"),
      eq(payeeAliases.normalizedText, normalizedRaw),
    ),
  });

  if (alias) {
    const candidates = await findOpenInvoicesByAmountAndSupplier(
      txn.tenantId,
      Number(txn.amount),
      alias.supplierId,
      0.02,
    );
    if (candidates.length === 1) {
      const timingScore = scoreTiming(candidates[0].invoiceDate, txn.date);
      return {
        invoiceId: candidates[0].id,
        confidence: 0.90,
        factors: { amountScore: 1.0, payeeScore: 1.0, timingScore },
        autoApply: true, // alias + amount = trustworthy
      };
    }
  }

  // No alias — amount-only match, surface as pending review
  const candidates = await findOpenInvoicesByAmount(txn.tenantId, Number(txn.amount), 0.02);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  const timingScore = scoreTiming(best.invoiceDate, txn.date);

  return {
    invoiceId: best.id,
    confidence: 0.52,
    factors: { amountScore: 1.0, payeeScore: 0, timingScore },
    autoApply: false, // never auto-apply Zelle without an alias
  };
}

// ── Standard ACH / payee+amount scorer ────────────────────────────────────

async function scoreTransaction(txn: BankTransaction): Promise<MatchResult | null> {
  const amount = Number(txn.amount);

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
      gte(supplierInvoices.totalAmount, (amount * 0.98).toFixed(4)),
      lte(supplierInvoices.totalAmount, (amount * 1.02).toFixed(4)),
      gte(supplierInvoices.invoiceDate, windowStart.toISOString().split("T")[0]),
      lte(supplierInvoices.invoiceDate, txnDate.toISOString().split("T")[0]),
    ))
    .limit(20);

  if (candidates.length === 0) return null;

  type Scored = { invoiceId: string; composite: number; factors: MatchFactors };
  const scored: Scored[] = [];

  // Use channel-scoped alias for payee scoring
  const txnMethod = txn.paymentMethod ?? "ach";

  for (const c of candidates) {
    const amountScore = scoreAmount(Number(c.totalAmount), amount);
    const payeeScore = await scorePayee(
      txn.tenantId,
      c.supplierId,
      c.supplierName,
      txn.merchantName,
      txn.rawDescription,
      txnMethod,
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

// ── Mystery outflow detection ──────────────────────────────────────────────

async function flagMysteryIfNeeded(txn: BankTransaction): Promise<void> {
  const amount = Number(txn.amount);
  // Only outflows (positive amount in Plaid)
  if (amount <= 0) return;
  if (amount < MYSTERY_THRESHOLD_DEFAULT) return;

  // Don't flag if already dismissed
  if (txn.mysteryDismissedAt) return;
  if (txn.isMysteryOutflow) return; // already flagged
  // Don't flag once the pairing service has linked it to its opposite leg.
  if (txn.transferPairId) return;

  // Don't flag known non-bill categories
  const cats = (txn.plaidCategory as string[] | null) ?? [];
  const isRecurring = cats.some(c =>
    RECURRING_CATEGORIES.some(r => c.toLowerCase().includes(r.toLowerCase())),
  );
  if (isRecurring) return;

  // Don't flag intra-bank transfers
  if (cats.some(c => c.toLowerCase().includes("transfer"))) return;

  await db
    .update(bankTransactions)
    .set({ isMysteryOutflow: true, updatedAt: new Date() })
    .where(eq(bankTransactions.id, txn.id));
}

// ── DB query helpers ───────────────────────────────────────────────────────

async function findOpenInvoicesByAmount(
  tenantId: string,
  amount: number,
  tolerance: number,
): Promise<Array<{ id: string; invoiceDate: string; totalAmount: string; supplierId: string; supplierName: string | null }>> {
  return db
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
      eq(supplierInvoices.tenantId, tenantId),
      or(
        eq(supplierInvoices.status, "posted"),
        eq(supplierInvoices.status, "reconciled"),
        eq(supplierInvoices.status, "completed"),
      ),
      gte(supplierInvoices.totalAmount, (amount * (1 - tolerance)).toFixed(4)),
      lte(supplierInvoices.totalAmount, (amount * (1 + tolerance)).toFixed(4)),
    ))
    .orderBy(sql`abs(${supplierInvoices.totalAmount}::numeric - ${amount})`)
    .limit(10);
}

async function findOpenInvoicesByAmountAndSupplier(
  tenantId: string,
  amount: number,
  supplierId: string,
  tolerance: number,
): Promise<Array<{ id: string; invoiceDate: string; totalAmount: string }>> {
  return db
    .select({
      id: supplierInvoices.id,
      totalAmount: supplierInvoices.totalAmount,
      invoiceDate: supplierInvoices.invoiceDate,
    })
    .from(supplierInvoices)
    .where(and(
      eq(supplierInvoices.tenantId, tenantId),
      eq(supplierInvoices.supplierId, supplierId),
      or(
        eq(supplierInvoices.status, "posted"),
        eq(supplierInvoices.status, "reconciled"),
        eq(supplierInvoices.status, "completed"),
      ),
      gte(supplierInvoices.totalAmount, (amount * (1 - tolerance)).toFixed(4)),
      lte(supplierInvoices.totalAmount, (amount * (1 + tolerance)).toFixed(4)),
    ))
    .orderBy(sql`abs(${supplierInvoices.totalAmount}::numeric - ${amount})`)
    .limit(5);
}

// ── Scoring helpers ────────────────────────────────────────────────────────

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
  channel: string,
): Promise<number> {
  if (!supplierId) return 0.2;

  const normalizedRaw = normalizePayeeText(rawDesc);
  // Check channel-scoped alias first, then fall back to channel-agnostic lookup
  const alias = await db.query.payeeAliases.findFirst({
    where: and(
      eq(payeeAliases.tenantId, tenantId),
      eq(payeeAliases.channel, channel),
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
