import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryItems,
  lotReceipts,
  lots,
  supplierInvoiceLines,
  supplierInvoices,
} from "@/db/schema";

import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";

/**
 * Transaction handle inferred from the active driver. Use this in any helper
 * that must run inside a `db.transaction(async tx => ...)` block so all of
 * its queries are scoped to the same transaction.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// -------------------- Types --------------------

export type SupplierInvoiceStatus = "draft" | "completed";

export type SupplierInvoiceLineInput = {
  /** Existing line id when editing; omit to insert a new line. */
  id?: string;
  productId: string;
  quantityCases: number;
  weightLbs: string;
  unitType: "catch_weight" | "fixed_case";
  unitPrice: string;
  caseWeightsLbs?: string | null;
  /** Override for the auto-generated lot number on completion. */
  lotNumberOverride?: string | null;
  /** Override for the default expiration (receiveDate + 7 days). */
  expirationDateOverride?: string | null;
};

export type SupplierInvoiceHeaderInput = {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  receiveDate: string;
  paymentMethod?: "cash" | "check" | "ach" | "zelle" | "credit_card" | null;
  notes?: string | null;
};

export type CreateSupplierInvoiceInput = SupplierInvoiceHeaderInput & {
  lines: SupplierInvoiceLineInput[];
  /** When true, immediately post the invoice and create lots + inventory. */
  complete?: boolean;
};

export type UpdateSupplierInvoiceInput = SupplierInvoiceHeaderInput & {
  id: string;
  lines: SupplierInvoiceLineInput[];
};

// -------------------- Helpers --------------------

function roundTo(value: number, digits: number): string {
  return value.toFixed(digits);
}

function computeLineTotal(line: {
  quantityCases: number;
  weightLbs: string;
  unitType: "catch_weight" | "fixed_case";
  unitPrice: string;
}): string {
  const unitPrice = Number(line.unitPrice) || 0;
  if (line.unitType === "catch_weight") {
    const weight = Number(line.weightLbs) || 0;
    return roundTo(weight * unitPrice, 4);
  }
  const cases = Number(line.quantityCases) || 0;
  return roundTo(cases * unitPrice, 4);
}

function sumTotals(values: string[]): string {
  const total = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return roundTo(total, 4);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function safeLotSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function defaultLotNumber(invoiceNumber: string, lineIndex: number): string {
  const safeInvoice = invoiceNumber.trim().replace(/\s+/g, "-");
  return `LOT-${safeInvoice}-${String(lineIndex + 1).padStart(2, "0")}`;
}

function generateBarcode(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `INV-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `INV-${safeLotSuffix()}${safeLotSuffix()}`;
}

/**
 * Reserve a unique lot number for the current tenant. If `override` is
 * provided we use it as-is (and fail fast on collision). Otherwise we try
 * the default `LOT-<invoice>-<line>` shape, and on collision append a short
 * random suffix.
 */
async function reserveLotNumber(args: {
  tx: Tx;
  tenantId: string;
  invoiceNumber: string;
  lineIndex: number;
  override?: string | null;
}): Promise<string> {
  const trimmedOverride = args.override?.trim();
  if (trimmedOverride && trimmedOverride.length > 0) {
    return trimmedOverride;
  }

  const base = defaultLotNumber(args.invoiceNumber, args.lineIndex);
  const existing = await args.tx.query.lots.findFirst({
    where: and(eq(lots.tenantId, args.tenantId), eq(lots.lotNumber, base)),
    columns: { id: true },
  });
  if (!existing) return base;
  return `${base}-${safeLotSuffix()}`;
}

// -------------------- Reads --------------------

export async function getSupplierInvoices() {
  const tenant = await getCurrentTenant();
  return db.query.supplierInvoices.findMany({
    where: eq(supplierInvoices.tenantId, tenant.id),
    with: {
      supplier: { columns: { id: true, name: true } },
      lines: {
        columns: { id: true, lineTotal: true },
      },
    },
    orderBy: [desc(supplierInvoices.invoiceDate), desc(supplierInvoices.createdAt)],
  });
}

export async function getSupplierInvoiceById(id: string) {
  const tenant = await getCurrentTenant();
  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, id),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    with: {
      supplier: true,
      createdBy: true,
      updatedBy: true,
      completedBy: true,
      lines: {
        with: {
          product: true,
          lotReceipts: {
            with: {
              lot: {
                with: {
                  inventoryItems: true,
                },
              },
            },
          },
        },
      },
      attachments: true,
    },
  });

  return invoice ?? null;
}

// -------------------- Mutations --------------------

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  if (input.lines.length === 0) {
    throw new Error("At least one invoice line is required.");
  }

  const normalizedLines = input.lines.map(line => ({
    ...line,
    lineTotal: computeLineTotal(line),
  }));
  const totalAmount = sumTotals(normalizedLines.map(l => l.lineTotal));

  const invoiceId = await db.transaction(async tx => {
    const [invoice] = await tx
      .insert(supplierInvoices)
      .values({
        tenantId: tenant.id,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber.trim(),
        invoiceDate: input.invoiceDate,
        receiveDate: input.receiveDate,
        status: "draft",
        totalAmount,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        createdByUserId: currentUser.id,
        updatedByUserId: currentUser.id,
      })
      .returning();

    const insertedLines = await tx
      .insert(supplierInvoiceLines)
      .values(
        normalizedLines.map(line => ({
          supplierInvoiceId: invoice.id,
          productId: line.productId,
          quantityCases: line.quantityCases,
          weightLbs: line.weightLbs,
          unitType: line.unitType,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          caseWeightsLbs: line.caseWeightsLbs ?? null,
        })),
      )
      .returning();

    if (input.complete) {
      await postSupplierInvoiceInternal({
        tx,
        tenantId: tenant.id,
        currentUserId: currentUser.id,
        invoiceId: invoice.id,
        lineOverrides: input.lines.map((line, i) => ({
          lineId: insertedLines[i].id,
          lotNumberOverride: line.lotNumberOverride ?? null,
          expirationDateOverride: line.expirationDateOverride ?? null,
        })),
      });
    }

    return invoice.id;
  });

  return (await getSupplierInvoiceById(invoiceId))!;
}

export async function updateSupplierInvoice(input: UpdateSupplierInvoiceInput) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  const existing = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, input.id),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    columns: { id: true, status: true },
  });
  if (!existing) throw new Error("Supplier invoice not found.");
  if (existing.status !== "draft") {
    throw new Error("Only draft invoices can be edited.");
  }
  if (input.lines.length === 0) {
    throw new Error("At least one invoice line is required.");
  }

  const normalizedLines = input.lines.map(line => ({
    ...line,
    lineTotal: computeLineTotal(line),
  }));
  const totalAmount = sumTotals(normalizedLines.map(l => l.lineTotal));

  await db
    .update(supplierInvoices)
    .set({
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber.trim(),
      invoiceDate: input.invoiceDate,
      receiveDate: input.receiveDate,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      totalAmount,
      updatedByUserId: currentUser.id,
    })
    .where(eq(supplierInvoices.id, input.id));

  // Simple reconciliation strategy: delete all existing lines then re-insert.
  // Draft invoices have no lot_receipts or inventory_items yet, so cascade
  // delete is safe. This keeps the v1 write path simple.
  await db
    .delete(supplierInvoiceLines)
    .where(eq(supplierInvoiceLines.supplierInvoiceId, input.id));

  await db.insert(supplierInvoiceLines).values(
    normalizedLines.map(line => ({
      supplierInvoiceId: input.id,
      productId: line.productId,
      quantityCases: line.quantityCases,
      weightLbs: line.weightLbs,
      unitType: line.unitType,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      caseWeightsLbs: line.caseWeightsLbs ?? null,
    })),
  );

  return (await getSupplierInvoiceById(input.id))!;
}

export async function completeSupplierInvoice(input: {
  id: string;
  lineOverrides?: Array<{
    lineId: string;
    lotNumberOverride?: string | null;
    expirationDateOverride?: string | null;
  }>;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  await db.transaction(async tx => {
    const existing = await tx.query.supplierInvoices.findFirst({
      where: and(
        eq(supplierInvoices.id, input.id),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
      columns: { id: true, status: true },
    });
    if (!existing) throw new Error("Supplier invoice not found.");
    if (existing.status === "completed") {
      throw new Error("Invoice is already completed.");
    }

    await postSupplierInvoiceInternal({
      tx,
      tenantId: tenant.id,
      currentUserId: currentUser.id,
      invoiceId: input.id,
      lineOverrides: input.lineOverrides ?? [],
    });
  });

  return (await getSupplierInvoiceById(input.id))!;
}

export async function deleteSupplierInvoice(id: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  const existing = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, id),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    columns: { id: true, status: true },
  });
  if (!existing) throw new Error("Supplier invoice not found.");
  if (existing.status !== "draft") {
    throw new Error(
      "Completed invoices cannot be deleted — reverse the receipt first.",
    );
  }

  await db.delete(supplierInvoices).where(eq(supplierInvoices.id, id));
}

// -------------------- Completion (internal) --------------------

/**
 * Performs the "post invoice" side effects: one lot per line, one inventory
 * item per line (cases aggregated), one lot_receipt linking the two.
 *
 * Runs entirely inside the caller-provided transaction, so either every lot
 * + lot_receipt + inventory_item + status flip lands together or none do.
 * Assumes the caller has already validated tenant ownership.
 */
async function postSupplierInvoiceInternal(args: {
  tx: Tx;
  tenantId: string;
  currentUserId: string;
  invoiceId: string;
  lineOverrides: Array<{
    lineId: string;
    lotNumberOverride?: string | null;
    expirationDateOverride?: string | null;
  }>;
}) {
  const { tx } = args;

  const invoice = await tx.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, args.invoiceId),
      eq(supplierInvoices.tenantId, args.tenantId),
    ),
    with: {
      lines: true,
    },
  });
  if (!invoice) throw new Error("Supplier invoice not found.");
  if (invoice.lines.length === 0) {
    throw new Error("Cannot complete an invoice with no lines.");
  }

  const overrideByLine = new Map(
    args.lineOverrides.map(o => [o.lineId, o] as const),
  );

  // Short-circuit if all lines are already received. This keeps
  // completeSupplierInvoice idempotent against partial failures where the
  // status update didn't land but side effects did. (With the transaction
  // boundary in place this is now only defensive — a partial write would
  // have rolled back — but it also handles legacy data pre-transaction.)
  const existingReceipts = await tx.query.lotReceipts.findMany({
    where: inArray(
      lotReceipts.supplierInvoiceLineId,
      invoice.lines.map(l => l.id),
    ),
    columns: { supplierInvoiceLineId: true },
  });
  const alreadyReceived = new Set(
    existingReceipts.map(r => r.supplierInvoiceLineId),
  );

  for (let i = 0; i < invoice.lines.length; i++) {
    const line = invoice.lines[i];
    if (alreadyReceived.has(line.id)) continue;

    const override = overrideByLine.get(line.id);
    const lotNumber = await reserveLotNumber({
      tx,
      tenantId: args.tenantId,
      invoiceNumber: invoice.invoiceNumber,
      lineIndex: i,
      override: override?.lotNumberOverride,
    });
    const expirationDate =
      override?.expirationDateOverride?.trim() ||
      addDays(invoice.receiveDate, 7);

    const [lot] = await tx
      .insert(lots)
      .values({
        tenantId: args.tenantId,
        lotNumber,
        supplierId: invoice.supplierId,
        receiveDate: invoice.receiveDate,
        expirationDate,
      })
      .returning();

    await tx.insert(lotReceipts).values({
      lotId: lot.id,
      supplierInvoiceLineId: line.id,
    });

    await tx.insert(inventoryItems).values({
      productId: line.productId,
      lotId: lot.id,
      barcodeId: generateBarcode(),
      exactWeightLbs: line.weightLbs,
      cases: Math.max(1, line.quantityCases || 1),
      status: "in_stock",
    });
  }

  await tx
    .update(supplierInvoices)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedByUserId: args.currentUserId,
      updatedByUserId: args.currentUserId,
    })
    .where(eq(supplierInvoices.id, args.invoiceId));
}

/**
 * Unwind a completed supplier invoice. Deletes the lots, lot_receipts, and
 * inventory_items that were created on completion, then flips the invoice
 * back to draft. All-or-nothing: bails out early if any inventory item has
 * already been used downstream.
 *
 * Rule summary:
 *   - status must be "completed"
 *   - tenant must match
 *   - every inventory_item created by this invoice must still be in_stock
 *     (any other status — allocated / picked / packed / shipped / sold /
 *     damaged / expired — blocks the reversal)
 */
export async function reverseSupplierInvoice(input: {
  id: string;
  reason?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  await db.transaction(async tx => {
    // Load the invoice + all downstream rows inside the tx so the safety
    // check and subsequent deletes observe a consistent snapshot.
    const invoice = await tx.query.supplierInvoices.findFirst({
      where: and(
        eq(supplierInvoices.id, input.id),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
      with: {
        lines: {
          with: {
            lotReceipts: {
              with: {
                lot: {
                  with: { inventoryItems: true },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice) throw new Error("Supplier invoice not found.");
    if (invoice.status !== "completed") {
      throw new Error("Only completed invoices can be reversed.");
    }

    // Collect the lots + inventory items created by THIS invoice. Because
    // every lot is created exclusively by supplier-invoice completion (and
    // we derive the IDs from this invoice's own lot_receipts), this is the
    // authoritative set to delete.
    const lotIds: string[] = [];
    const inventoryItemIds: string[] = [];
    const blockedByItems: Array<{ barcodeId: string; status: string }> = [];

    for (const line of invoice.lines) {
      for (const receipt of line.lotReceipts) {
        const lot = receipt.lot;
        if (!lot) continue;
        lotIds.push(lot.id);
        for (const item of lot.inventoryItems) {
          inventoryItemIds.push(item.id);
          if (item.status !== "in_stock") {
            blockedByItems.push({
              barcodeId: item.barcodeId,
              status: item.status,
            });
          }
        }
      }
    }

    if (blockedByItems.length > 0) {
      const preview = blockedByItems
        .slice(0, 3)
        .map(i => `${i.barcodeId} (${i.status})`)
        .join(", ");
      const more =
        blockedByItems.length > 3
          ? ` and ${blockedByItems.length - 3} more`
          : "";
      // Throwing inside the transaction rolls back any partial work.
      throw new Error(
        `Cannot reverse: ${blockedByItems.length} inventory item(s) are no longer in stock — ${preview}${more}.`,
      );
    }

    // Delete in order: inventory_items -> lot_receipts -> lots. `lot_receipts`
    // would cascade from `lots`, but deleting explicitly keeps the intent
    // clear and makes this resilient if the cascade is ever removed.
    if (inventoryItemIds.length > 0) {
      await tx
        .delete(inventoryItems)
        .where(inArray(inventoryItems.id, inventoryItemIds));
    }

    const lineIds = invoice.lines.map(l => l.id);
    if (lineIds.length > 0) {
      await tx
        .delete(lotReceipts)
        .where(inArray(lotReceipts.supplierInvoiceLineId, lineIds));
    }

    if (lotIds.length > 0) {
      await tx.delete(lots).where(inArray(lots.id, lotIds));
    }

    const now = new Date();
    await tx
      .update(supplierInvoices)
      .set({
        status: "draft",
        completedAt: null,
        completedByUserId: null,
        updatedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(supplierInvoices.id, input.id));

    const trimmedReason = input.reason?.trim() || null;
    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "update",
      entityTable: "supplier_invoices",
      entityId: input.id,
      entityLabel: invoice.invoiceNumber ?? null,
      changedFieldsJson: JSON.stringify(["status"]),
      beforeJson: JSON.stringify({ status: "completed" }),
      afterJson: JSON.stringify({ status: "draft" }),
      contextJson: JSON.stringify({
        action: "reverse_receipt",
        reason: trimmedReason,
        lotsDeleted: lotIds.length,
        inventoryItemsDeleted: inventoryItemIds.length,
      }),
    });
  });

  return (await getSupplierInvoiceById(input.id))!;
}

// -------------------- Derived types for clients --------------------

export type SupplierInvoiceListItem = Awaited<
  ReturnType<typeof getSupplierInvoices>
>[number];
export type SupplierInvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof getSupplierInvoiceById>>
>;
