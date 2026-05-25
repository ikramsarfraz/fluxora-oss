import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bankAccounts, bankTransactions, plaidConnections, supplierInvoices, suppliers } from "@/db/schema";
import { runMatchingForTransaction } from "./transaction-matching";

const ENABLED =
  process.env.PLAID_ENV === "sandbox" &&
  process.env.NODE_ENV !== "production" &&
  process.env.PLAID_SANDBOX_AUTO_FIRE !== "false";

export type SandboxFireResult =
  | { fired: true; description: string }
  | { fired: false; reason: string };

/**
 * Injects a synthetic outflow transaction directly into bankTransactions and
 * runs matching against it — bypassing the Plaid sync cursor entirely.
 *
 * sandboxTransactionsCreate only feeds /transactions/get; our pipeline uses
 * /transactions/sync (cursor-based), so we skip the Plaid API and write
 * straight to the DB, which is what syncConnection would do anyway.
 *
 * Only runs when PLAID_ENV=sandbox AND NODE_ENV!=production AND
 * PLAID_SANDBOX_AUTO_FIRE!=false. Never throws.
 */
export async function fireSandboxTransactionForInvoice(
  invoiceId: string,
  tenantId: string,
): Promise<SandboxFireResult> {
  if (!ENABLED) {
    return { fired: false, reason: "sandbox auto-fire not enabled" };
  }

  console.warn(
    `[PLAID SANDBOX] fireSandboxTransactionForInvoice(${invoiceId}) — ` +
      "this must never appear in production logs.",
  );

  try {
    const invoice = await db.query.supplierInvoices.findFirst({
      where: and(
        eq(supplierInvoices.id, invoiceId),
        eq(supplierInvoices.tenantId, tenantId),
      ),
      columns: { id: true, totalAmount: true, supplierId: true },
    });
    if (!invoice) return { fired: false, reason: "invoice not found" };

    const supplier = await db.query.suppliers.findFirst({
      where: and(
        eq(suppliers.id, invoice.supplierId),
        eq(suppliers.tenantId, tenantId),
      ),
      columns: { name: true },
    });
    if (!supplier) return { fired: false, reason: "supplier not found" };

    // Find an active connection with at least one bank account
    const connection = await db.query.plaidConnections.findFirst({
      where: and(
        eq(plaidConnections.tenantId, tenantId),
        eq(plaidConnections.status, "active"),
      ),
      columns: { id: true },
      with: { bankAccounts: { columns: { id: true, type: true }, limit: 10 } },
    });
    if (!connection) return { fired: false, reason: "no active Plaid connection" };

    const account =
      connection.bankAccounts.find(a => a.type === "depository") ??
      connection.bankAccounts[0];
    if (!account) return { fired: false, reason: "no bank accounts on connection" };

    // Build a bank-string-like description: "ACME FOODS ACH 4271"
    const supplierUpper = supplier.name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim()
      .slice(0, 18);
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const description = `${supplierUpper} ACH ${randomSuffix}`;

    const today = new Date().toISOString().split("T")[0]!;
    // Unique synthetic ID — won't collide with real Plaid transaction IDs
    const syntheticPlaidId = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [inserted] = await db
      .insert(bankTransactions)
      .values({
        tenantId,
        bankAccountId: account.id,
        plaidTransactionId: syntheticPlaidId,
        date: today,
        amount: invoice.totalAmount, // positive = outflow (matches Plaid convention)
        rawDescription: description,
        merchantName: supplier.name.slice(0, 256),
        paymentChannel: "ach",
        pending: false,
        isoCurrencyCode: "USD",
      })
      .returning();

    console.warn(
      `[PLAID SANDBOX] Inserted synthetic transaction "$${invoice.totalAmount}" — "${description}". Running matching…`,
    );

    await runMatchingForTransaction(inserted).catch(err =>
      console.error("[PLAID SANDBOX] Matching failed:", err),
    );

    console.warn(`[PLAID SANDBOX] Done — transaction ${inserted.id} is now in bank_transactions.`);

    return { fired: true, description };
  } catch (err) {
    console.error("[PLAID SANDBOX] Auto-fire failed:", err);
    return {
      fired: false,
      reason: err instanceof Error ? err.message : "unknown error",
    };
  }
}
