import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  files,
  inventoryItems,
  lotReceipts,
  lots,
  suppliers,
  supplierInvoiceAttachments,
  supplierInvoiceLines,
  supplierInvoicePayments,
  supplierInvoices,
} from "@/db/schema";

import { requirePermission } from "@/lib/auth/permissions";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";
import {
  buildSupplierInvoiceObjectKey,
  deleteFile,
  downloadFile,
  uploadFile,
} from "@/lib/uploads/r2";
import { parsePersistedCaseWeights } from "../utils/case-weights";
import { computePaymentSummary } from "../utils/payment-summary";

import { getCurrentPortalUser } from "@/modules/core/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

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
  /** Persisted JSON array of per-case weights when detailed mode is used. */
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

function normalizeSupplierInvoiceLine(
  line: SupplierInvoiceLineInput,
): SupplierInvoiceLineInput {
  if (line.unitType !== "catch_weight") {
    return {
      ...line,
      caseWeightsLbs: null,
    };
  }

  const parsedCaseWeights = parsePersistedCaseWeights(line.caseWeightsLbs);
  if (parsedCaseWeights.length === 0) {
    return line;
  }

  const totalWeight = parsedCaseWeights.reduce((sum, weight) => sum + weight, 0);
  return {
    ...line,
    weightLbs: roundTo(totalWeight, 4),
    caseWeightsLbs: JSON.stringify(parsedCaseWeights),
  };
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
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");
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

export type SupplierInvoiceListSort =
  | "invoiceNumber"
  | "invoiceDate"
  | "receiveDate"
  | "totalAmount"
  | "status";

export type SupplierInvoiceListParams =
  PaginatedQueryInput<SupplierInvoiceListSort>;

export async function getSupplierInvoicesPage(
  input?: SupplierInvoiceListParams,
) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  const query = normalizePaginatedQuery(input, {
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(supplierInvoices.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      supplierInvoices.invoiceNumber,
      supplierInvoices.status,
      suppliers.name,
    ]),
  );
  const [{ count }] = await db
    .select({
      count: sql<number>`count(distinct ${supplierInvoices.id})::int`,
    })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .where(where);
  const invoiceIds = await db
    .select({ id: supplierInvoices.id })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          invoiceNumber: supplierInvoices.invoiceNumber,
          invoiceDate: supplierInvoices.invoiceDate,
          receiveDate: supplierInvoices.receiveDate,
          totalAmount: supplierInvoices.totalAmount,
          status: supplierInvoices.status,
        },
      }),
      desc(supplierInvoices.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));
  const ids = invoiceIds.map(row => row.id);
  if (ids.length === 0) {
    return createPaginatedResult({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    });
  }

  const rows = await db.query.supplierInvoices.findMany({
    where: inArray(supplierInvoices.id, ids),
    with: {
      supplier: { columns: { id: true, name: true } },
      lines: {
        columns: { id: true, lineTotal: true },
      },
    },
  });

  const rowMap = new Map(rows.map(row => [row.id, row]));
  return createPaginatedResult({
    data: ids
      .map(id => rowMap.get(id))
      .filter((row): row is (typeof rows)[number] => Boolean(row)),
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export async function getSupplierInvoiceById(id: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");
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
      attachments: {
        with: {
          file: {
            with: { uploadedByUser: true },
          },
        },
        orderBy: [desc(supplierInvoiceAttachments.createdAt)],
      },
      payments: {
        with: { createdBy: true },
        orderBy: [desc(supplierInvoicePayments.paymentDate)],
      },
    },
  });

  return invoice ?? null;
}

// Re-export pure payment helpers so server callers that already import from
// this module don't need a separate import.
export {
  computePaymentSummary,
  type SupplierInvoicePaymentStatus,
  type SupplierInvoicePaymentSummary,
} from "../utils/payment-summary";

// -------------------- Mutations --------------------

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "edit_supplier_invoice");
  if (input.complete) {
    requirePermission(currentUser.role, "complete_supplier_invoice");
  }

  if (input.lines.length === 0) {
    throw new Error("At least one invoice line is required.");
  }

  const normalizedLines = input.lines.map(line => {
    const normalizedLine = normalizeSupplierInvoiceLine(line);
    return {
      ...normalizedLine,
      lineTotal: computeLineTotal(normalizedLine),
    };
  });
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

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "insert",
      entityTable: "supplier_invoices",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      afterJson: JSON.stringify({
        status: "draft",
        totalAmount,
      }),
      contextJson: JSON.stringify({
        supplierId: input.supplierId,
        lines: normalizedLines.length,
        createdAsComplete: Boolean(input.complete),
      }),
    });

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
  requirePermission(currentUser.role, "edit_supplier_invoice");

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

  const normalizedLines = input.lines.map(line => {
    const normalizedLine = normalizeSupplierInvoiceLine(line);
    return {
      ...normalizedLine,
      lineTotal: computeLineTotal(normalizedLine),
    };
  });
  const totalAmount = sumTotals(normalizedLines.map(l => l.lineTotal));

  await db.transaction(async tx => {
    await tx
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
    await tx
      .delete(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.supplierInvoiceId, input.id));

    await tx.insert(supplierInvoiceLines).values(
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

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "update",
      entityTable: "supplier_invoices",
      entityId: input.id,
      entityLabel: input.invoiceNumber.trim(),
      changedFieldsJson: JSON.stringify([
        "supplierId",
        "invoiceNumber",
        "invoiceDate",
        "receiveDate",
        "paymentMethod",
        "notes",
        "lines",
        "totalAmount",
      ]),
      contextJson: JSON.stringify({
        lines: normalizedLines.length,
        totalAmount,
      }),
    });
  });

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
  requirePermission(currentUser.role, "complete_supplier_invoice");

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
  requirePermission(currentUser.role, "delete_supplier_invoice");

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
      costPerUnitSnapshot: line.unitPrice,
      costUnitTypeSnapshot: line.unitType,
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

  await tx.insert(auditLogs).values({
    tenantId: args.tenantId,
    actorType: "portal_user",
    actorPortalUserId: args.currentUserId,
    action: "update",
    entityTable: "supplier_invoices",
    entityId: args.invoiceId,
    entityLabel: invoice.invoiceNumber,
    changedFieldsJson: JSON.stringify(["status"]),
    beforeJson: JSON.stringify({ status: "draft" }),
    afterJson: JSON.stringify({ status: "completed" }),
    contextJson: JSON.stringify({
      action: "complete_receipt",
      lotsCreated: invoice.lines.length,
      inventoryItemsCreated: invoice.lines.length,
    }),
  });
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
  requirePermission(currentUser.role, "reverse_supplier_receipt");

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

// -------------------- Payments --------------------

export type RecordSupplierInvoicePaymentInput = {
  supplierInvoiceId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: "cash" | "check" | "ach" | "zelle" | "credit_card";
  reference?: string | null;
  notes?: string | null;
};

/**
 * Apply a payment to a supplier invoice. Runs inside a single transaction so
 * the existing-payments re-sum and the insert observe a consistent balance;
 * this closes the race where two concurrent payments could each pass a
 * stale overpayment check.
 *
 * Rules:
 *   - tenant must match
 *   - invoice must be status "completed" (drafts cannot be paid)
 *   - amount must parse as a positive number
 *   - amount must not exceed the current balance due (with a 1¢ tolerance
 *     for floating-point rounding)
 */
export async function recordSupplierInvoicePayment(
  input: RecordSupplierInvoicePaymentInput,
) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "record_supplier_payment");

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  await db.transaction(async tx => {
    const invoice = await tx.query.supplierInvoices.findFirst({
      where: and(
        eq(supplierInvoices.id, input.supplierInvoiceId),
        eq(supplierInvoices.tenantId, tenant.id),
      ),
      with: {
        payments: {
          columns: { amount: true },
        },
      },
    });
    if (!invoice) throw new Error("Supplier invoice not found.");
    if (invoice.status !== "completed") {
      throw new Error(
        "Payments can only be recorded on completed supplier invoices.",
      );
    }

    const summary = computePaymentSummary(invoice);
    const balanceDue = Number(summary.balanceDue);
    // Allow a 1¢ tolerance so exact-match payments don't trip FP equality.
    if (amount - balanceDue > 0.01) {
      throw new Error(
        `Payment exceeds balance due. Balance due is $${summary.balanceDue}.`,
      );
    }

    const trimmedReference = input.reference?.trim() || null;
    const [payment] = await tx.insert(supplierInvoicePayments).values({
      tenantId: tenant.id,
      supplierInvoiceId: input.supplierInvoiceId,
      paymentDate: input.paymentDate,
      amount: amount.toFixed(2),
      paymentMethod: input.paymentMethod,
      reference: trimmedReference,
      notes: input.notes?.trim() || null,
      createdByUserId: currentUser.id,
    }).returning({ id: supplierInvoicePayments.id });

    const paymentSummaryMethod = input.paymentMethod.replace(/_/g, " ");
    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "insert",
      entityTable: "supplier_invoice_payments",
      entityId: payment.id,
      entityLabel: invoice.invoiceNumber,
      contextJson: JSON.stringify({
        amount: amount.toFixed(2),
        paymentMethod: paymentSummaryMethod,
        reference: trimmedReference,
      }),
    });
  });

  return (await getSupplierInvoiceById(input.supplierInvoiceId))!;
}

// -------------------- Attachments --------------------

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ATTACHMENT_FILENAME_LENGTH = 255;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

function extensionFromFilename(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,16}$/.test(ext)) return null;
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) return null;
  return ext;
}

/**
 * Resolve a supplier invoice + ensure the current user can view it. Returns
 * the invoice id on success, or throws. Used as a single gate for attachment
 * reads/writes so each entry point does the same tenant + perm check.
 */
async function loadSupplierInvoiceForAttachment(
  supplierInvoiceId: string,
  permission: "view_supplier_invoice" | "edit_supplier_invoice",
) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, permission);

  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, supplierInvoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    columns: { id: true, invoiceNumber: true },
  });
  if (!invoice) throw new Error("Supplier invoice not found.");
  return { tenant, currentUser, invoice };
}

export type UploadSupplierInvoiceAttachmentInput = {
  supplierInvoiceId: string;
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
};

/**
 * Persist supporting document bytes on disk and record the metadata + join
 * row atomically. `edit_supplier_invoice` is required; the invoice itself
 * may be draft or completed (supporting docs are useful in both states).
 */
export async function uploadSupplierInvoiceAttachment(
  input: UploadSupplierInvoiceAttachmentInput,
) {
  const { tenant, currentUser, invoice } =
    await loadSupplierInvoiceForAttachment(
      input.supplierInvoiceId,
      "edit_supplier_invoice",
    );

  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `File is too large. Maximum is ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
    );
  }
  const originalFilename = input.originalFilename.trim();
  if (!originalFilename) {
    throw new Error("File must have a name.");
  }
  if (originalFilename.length > MAX_ATTACHMENT_FILENAME_LENGTH) {
    throw new Error(
      `Filename is too long. Maximum is ${MAX_ATTACHMENT_FILENAME_LENGTH} characters.`,
    );
  }
  if (/[\u0000-\u001F\u007F]/.test(originalFilename)) {
    throw new Error("Filename contains invalid control characters.");
  }

  const extension = extensionFromFilename(originalFilename);
  if (!extension) {
    throw new Error(
      "Unsupported file type. Allowed: PDF, PNG, JPG, JPEG, WEBP, HEIC, CSV, TXT, DOC, DOCX, XLS, XLSX.",
    );
  }
  const mimeType =
    input.mimeType && input.mimeType.trim().length > 0
      ? input.mimeType.trim().slice(0, 255)
      : null;

  return await db.transaction(async tx => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        tenantId: tenant.id,
        category: "supplier_invoice_attachment",
        storageProvider: "r2",
        status: "ready",
        // Placeholder; patched below once we know the file id.
        objectKey: `pending/${crypto.randomUUID()}`,
        bucket: null,
        originalFilename,
        mimeType,
        extension,
        sizeBytes: input.bytes.byteLength,
        uploadedByUserId: currentUser.id,
      })
      .returning();

    const objectKey = buildSupplierInvoiceObjectKey({
      tenantId: tenant.id,
      supplierInvoiceId: invoice.id,
      fileId: fileRow.id,
      extension,
    });

    await tx
      .update(files)
      .set({ objectKey })
      .where(eq(files.id, fileRow.id));

    await tx.insert(supplierInvoiceAttachments).values({
      supplierInvoiceId: invoice.id,
      fileId: fileRow.id,
    });

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "file_uploaded",
      entityTable: "supplier_invoice_attachments",
      entityId: fileRow.id,
      entityLabel: originalFilename,
      contextJson: JSON.stringify({
        supplierInvoiceId: invoice.id,
      }),
    });

    // Write bytes after DB commit would be ideal, but we need the file id
    // first. Writing inside the transaction means a late failure leaves an
    // orphan byte blob on disk that's unreferenced by any DB row -- safer
    // than an orphan DB row pointing at missing bytes. Cleanup on failure:
    try {
      await uploadFile({ objectKey, body: input.bytes, contentType: mimeType ?? "application/octet-stream", contentLength: input.bytes.byteLength });
    } catch (err) {
      // Bubble up; the transaction will roll back and the bytes (if any
      // partial write happened) become orphaned but unreferenced.
      throw err;
    }

    return { fileId: fileRow.id };
  });
}

export async function removeSupplierInvoiceAttachment(input: {
  supplierInvoiceId: string;
  fileId: string;
}) {
  const { tenant, currentUser, invoice } = await loadSupplierInvoiceForAttachment(
    input.supplierInvoiceId,
    "edit_supplier_invoice",
  );

  const attachment = await db.query.supplierInvoiceAttachments.findFirst({
    where: and(
      eq(supplierInvoiceAttachments.supplierInvoiceId, invoice.id),
      eq(supplierInvoiceAttachments.fileId, input.fileId),
    ),
    with: { file: true },
  });
  if (!attachment) throw new Error("Attachment not found.");

  const removedFilename = attachment.file.originalFilename ?? "attachment";

  await db.transaction(async tx => {
    await tx
      .delete(supplierInvoiceAttachments)
      .where(
        and(
          eq(supplierInvoiceAttachments.supplierInvoiceId, invoice.id),
          eq(supplierInvoiceAttachments.fileId, input.fileId),
        ),
      );
    await tx.delete(files).where(eq(files.id, input.fileId));
    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "file_deleted",
      entityTable: "supplier_invoice_attachments",
      entityId: input.fileId,
      entityLabel: removedFilename,
      contextJson: JSON.stringify({
        supplierInvoiceId: invoice.id,
      }),
    });
  });

  await deleteFile(attachment.file.objectKey);
}

/**
 * Load a supplier invoice attachment for download/streaming. Enforces
 * `view_supplier_invoice` and confirms the file is actually linked to the
 * given invoice + tenant, so `fileId` from a URL can't leak cross-tenant.
 */
export async function getSupplierInvoiceAttachmentDownload(args: {
  supplierInvoiceId: string;
  fileId: string;
}) {
  const { invoice } = await loadSupplierInvoiceForAttachment(
    args.supplierInvoiceId,
    "view_supplier_invoice",
  );

  const attachment = await db.query.supplierInvoiceAttachments.findFirst({
    where: and(
      eq(supplierInvoiceAttachments.supplierInvoiceId, invoice.id),
      eq(supplierInvoiceAttachments.fileId, args.fileId),
    ),
    with: { file: true },
  });
  if (!attachment) throw new Error("Attachment not found.");

  const bytes = await downloadFile(attachment.file.objectKey);
  return {
    bytes,
    mimeType: attachment.file.mimeType ?? "application/octet-stream",
    originalFilename: attachment.file.originalFilename ?? "attachment",
    sizeBytes: attachment.file.sizeBytes ?? bytes.byteLength,
  };
}

// -------------------- Derived types for clients --------------------

export type SupplierInvoiceListItem = Awaited<
  ReturnType<typeof getSupplierInvoices>
>[number];
export type SupplierInvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof getSupplierInvoiceById>>
>;
export type SupplierInvoiceAttachment =
  SupplierInvoiceDetail["attachments"][number];
