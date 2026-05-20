import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  customerProductPrices,
  customers,
  files,
  inventoryItems,
  lotReceipts,
  lots,
  products,
  productSupplierCosts,
  suppliers,
  supplierInvoiceAttachments,
  supplierInvoiceCharges,
  supplierInvoiceLines,
  supplierInvoicePayments,
  supplierInvoices,
  tenants,
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
import { supplierInvoiceLineCostPerLb } from "../utils/cost";

import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

/**
 * Transaction handle inferred from the active driver. Use this in any helper
 * that must run inside a `db.transaction(async tx => ...)` block so all of
 * its queries are scoped to the same transaction.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Mint the next per-tenant supplier-invoice reference number. The counter on
 * `tenants` is incremented atomically inside the caller's transaction, so two
 * concurrent inserts can never receive the same number. Format is
 * `IB-NNNNNN` (zero-padded to 6 digits, grows naturally past 1 million).
 */
export async function generateSupplierInvoiceReferenceNumber(
  tx: Tx,
  tenantId: string,
): Promise<string> {
  const [row] = await tx
    .update(tenants)
    .set({
      supplierInvoiceCounter: sql`${tenants.supplierInvoiceCounter} + 1`,
    })
    .where(eq(tenants.id, tenantId))
    .returning({ counter: tenants.supplierInvoiceCounter });

  if (!row) {
    throw new Error(
      "Tenant not found while generating supplier invoice reference number.",
    );
  }

  return formatSupplierInvoiceReferenceNumber(row.counter);
}

export function formatSupplierInvoiceReferenceNumber(counter: number): string {
  const padded = String(counter).padStart(6, "0");
  return `IB-${padded}`;
}

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
  /** Supplier's printed invoice number — optional. */
  invoiceNumber: string | null;
  invoiceDate: string;
  receiveDate: string;
  paymentMethod?: "cash" | "check" | "ach" | "zelle" | "credit_card" | null;
  notes?: string | null;
};

export type SupplierInvoiceChargeInput = {
  description: string;
  chargeType?: string;
  rate?: string | null;
  includeInInventoryCost?: boolean;
  amount: string;
};

export type CreateSupplierInvoiceInput = SupplierInvoiceHeaderInput & {
  lines: SupplierInvoiceLineInput[];
  charges?: SupplierInvoiceChargeInput[];
  /** When true, immediately post the invoice and create lots + inventory. */
  complete?: boolean;
};

export type UpdateSupplierInvoiceInput = SupplierInvoiceHeaderInput & {
  id: string;
  lines: SupplierInvoiceLineInput[];
  charges?: SupplierInvoiceChargeInput[];
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

function defaultLotNumber(referenceNumber: string, lineIndex: number): string {
  const safeReference = referenceNumber.trim().replace(/\s+/g, "-");
  return `LOT-${safeReference}-${String(lineIndex + 1).padStart(2, "0")}`;
}

function generateBarcode(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `INV-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `INV-${safeLotSuffix()}${safeLotSuffix()}`;
}

function receiptTimestamp(receiveDate: string): Date {
  const date = new Date(`${receiveDate}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : new Date();
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
  referenceNumber: string;
  lineIndex: number;
  override?: string | null;
}): Promise<string> {
  const trimmedOverride = args.override?.trim();
  if (trimmedOverride && trimmedOverride.length > 0) {
    return trimmedOverride;
  }

  const base = defaultLotNumber(args.referenceNumber, args.lineIndex);
  const existing = await args.tx.query.lots.findFirst({
    where: and(eq(lots.tenantId, args.tenantId), eq(lots.lotNumber, base)),
    columns: { id: true },
  });
  if (!existing) return base;
  return `${base}-${safeLotSuffix()}`;
}

async function syncSupplierInvoiceLineCost(args: {
  tx: Tx;
  supplierId: string;
  receiveDate: string;
  line: {
    productId: string;
    quantityCases: number;
    weightLbs: string;
    unitType: "catch_weight" | "fixed_case";
    unitPrice: string;
  };
}) {
  const costPerLb = supplierInvoiceLineCostPerLb(args.line);
  if (costPerLb == null) return;

  const existing = await args.tx.query.productSupplierCosts.findFirst({
    where: and(
      eq(productSupplierCosts.productId, args.line.productId),
      eq(productSupplierCosts.supplierId, args.supplierId),
    ),
    columns: { id: true },
  });

  const receivedAt = receiptTimestamp(args.receiveDate);

  if (existing) {
    await args.tx
      .update(productSupplierCosts)
      .set({
        costPerLb,
        lastReceivedAt: receivedAt,
        updatedAt: new Date(),
      })
      .where(eq(productSupplierCosts.id, existing.id));
  } else {
    await args.tx.insert(productSupplierCosts).values({
      productId: args.line.productId,
      supplierId: args.supplierId,
      costPerLb,
      lastReceivedAt: receivedAt,
    });
  }
}

/**
 * Find the most-recent completed supplier-invoice line for a given
 * (supplier, product), optionally excluding one invoice. Used by both
 * `rollbackSupplierInvoiceLineCosts` (to restore the prior cost when an
 * invoice is reversed) and `getReversalPreview` (to show the user what the
 * cost will become *before* they confirm).
 */
type PriorLineLookupTx = Tx | typeof db;

async function findPriorSupplierInvoiceLine(args: {
  tx: PriorLineLookupTx;
  supplierId: string;
  productId: string;
  excludeInvoiceId: string;
}) {
  const [row] = await args.tx
    .select({
      invoiceId: supplierInvoices.id,
      invoiceNumber: supplierInvoices.invoiceNumber,
      receiveDate: supplierInvoices.receiveDate,
      quantityCases: supplierInvoiceLines.quantityCases,
      weightLbs: supplierInvoiceLines.weightLbs,
      unitType: supplierInvoiceLines.unitType,
      unitPrice: supplierInvoiceLines.unitPrice,
    })
    .from(supplierInvoiceLines)
    .innerJoin(
      supplierInvoices,
      eq(supplierInvoices.id, supplierInvoiceLines.supplierInvoiceId),
    )
    .where(
      and(
        eq(supplierInvoiceLines.productId, args.productId),
        eq(supplierInvoices.supplierId, args.supplierId),
        eq(supplierInvoices.status, "completed"),
        sql`${supplierInvoices.id} <> ${args.excludeInvoiceId}`,
      ),
    )
    .orderBy(desc(supplierInvoices.receiveDate), desc(supplierInvoiceLines.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Roll back the per-supplier cost rows that were updated when this invoice
 * was completed. For each (supplier, product) pair touched by the invoice we
 * either restore the cost from the most-recent OTHER completed invoice from
 * the same supplier, or delete the `productSupplierCosts` row entirely if no
 * prior invoice exists. Without this, reversing an invoice would leave the
 * price-chart showing a cost that no longer has a source-of-truth invoice
 * behind it.
 */
async function rollbackSupplierInvoiceLineCosts(args: {
  tx: Tx;
  invoiceId: string;
  supplierId: string;
  productIds: string[];
}) {
  const productIds = Array.from(new Set(args.productIds));
  if (productIds.length === 0) return;

  for (const productId of productIds) {
    const priorLine = await findPriorSupplierInvoiceLine({
      tx: args.tx,
      supplierId: args.supplierId,
      productId,
      excludeInvoiceId: args.invoiceId,
    });

    const restoredCost = priorLine ? supplierInvoiceLineCostPerLb(priorLine) : null;

    if (priorLine && restoredCost != null) {
      await args.tx
        .update(productSupplierCosts)
        .set({
          costPerLb: restoredCost,
          lastReceivedAt: receiptTimestamp(priorLine.receiveDate),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productSupplierCosts.productId, productId),
            eq(productSupplierCosts.supplierId, args.supplierId),
          ),
        );
    } else {
      await args.tx
        .delete(productSupplierCosts)
        .where(
          and(
            eq(productSupplierCosts.productId, productId),
            eq(productSupplierCosts.supplierId, args.supplierId),
          ),
        );
    }
  }
}

// -------------------- Reads --------------------
//
// The legacy `getNextSupplierInvoiceNumber()` auto-suggester was removed when
// `referenceNumber` became the canonical system identity and
// `invoiceNumber` (the supplier's printed number) became optional. Callers
// should rely on `generateSupplierInvoiceReferenceNumber` above.

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
  | "referenceNumber"
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
      supplierInvoices.referenceNumber,
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
          referenceNumber: supplierInvoices.referenceNumber,
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
      charges: {
        columns: { id: true, description: true, chargeType: true, rate: true, includeInInventoryCost: true, amount: true },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      },
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
      paymentMatches: {
        where: (pm, { or, eq }) =>
          or(eq(pm.status, "auto_applied"), eq(pm.status, "confirmed")),
        with: {
          bankTransaction: {
            with: { bankAccount: { with: { plaidConnection: true } } },
          },
          confirmedBy: true,
        },
        orderBy: (pm, { desc }) => [desc(pm.confirmedAt)],
        limit: 1,
      },
      billForwards: {
        with: { sentBy: true },
        orderBy: (bf, { desc }) => [desc(bf.sentAt)],
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

export type SupplierCostDiffEntry = {
  productId: string;
  currentCostPerLb: string | null;
  lastReceivedAt: string | null;
  dependentCustomerCount: number;
  sampleCustomers: Array<{ id: string; name: string; pricePerLb: string }>;
};

/**
 * Read-only: for a given supplier + a set of product IDs the user has on a
 * draft bill, return the currently-recorded `costPerLb` for each pair and a
 * count + small sample of customers who have a per-supplier price pinned to
 * this supplier for this product. The bill form uses this to flag lines
 * whose live cost differs from the recorded cost and to show downstream
 * customer impact.
 */
export async function getSupplierInvoiceCostDiffContext(args: {
  supplierId: string;
  productIds: string[];
}): Promise<{ costs: SupplierCostDiffEntry[] }> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "edit_supplier_invoice");

  const productIds = Array.from(new Set(args.productIds.filter(Boolean)));
  if (!args.supplierId || productIds.length === 0) return { costs: [] };

  const [costRows, priceRows] = await Promise.all([
    db
      .select({
        productId: productSupplierCosts.productId,
        costPerLb: productSupplierCosts.costPerLb,
        lastReceivedAt: productSupplierCosts.lastReceivedAt,
      })
      .from(productSupplierCosts)
      .innerJoin(products, eq(products.id, productSupplierCosts.productId))
      .where(
        and(
          eq(products.tenantId, tenant.id),
          eq(productSupplierCosts.supplierId, args.supplierId),
          inArray(productSupplierCosts.productId, productIds),
        ),
      ),
    db
      .select({
        productId: customerProductPrices.productId,
        customerId: customerProductPrices.customerId,
        customerName: customers.name,
        pricePerLb: customerProductPrices.pricePerLb,
      })
      .from(customerProductPrices)
      .innerJoin(customers, eq(customers.id, customerProductPrices.customerId))
      .innerJoin(products, eq(products.id, customerProductPrices.productId))
      .where(
        and(
          eq(products.tenantId, tenant.id),
          eq(customers.tenantId, tenant.id),
          eq(customerProductPrices.supplierId, args.supplierId),
          inArray(customerProductPrices.productId, productIds),
        ),
      ),
  ]);

  const costByProduct = new Map(
    costRows.map(r => [r.productId, { costPerLb: r.costPerLb, lastReceivedAt: r.lastReceivedAt }] as const),
  );

  const pricesByProduct = new Map<string, typeof priceRows>();
  for (const row of priceRows) {
    const bucket = pricesByProduct.get(row.productId) ?? [];
    bucket.push(row);
    pricesByProduct.set(row.productId, bucket);
  }

  const costs: SupplierCostDiffEntry[] = productIds.map(productId => {
    const c = costByProduct.get(productId);
    const dependents = pricesByProduct.get(productId) ?? [];
    return {
      productId,
      currentCostPerLb: c?.costPerLb ?? null,
      lastReceivedAt: c?.lastReceivedAt?.toISOString() ?? null,
      dependentCustomerCount: dependents.length,
      sampleCustomers: dependents.slice(0, 5).map(cu => ({
        id: cu.customerId,
        name: cu.customerName,
        pricePerLb: cu.pricePerLb,
      })),
    };
  });

  return { costs };
}

export type ReversalCostChange = {
  productId: string;
  productName: string;
  productSku: string | null;
  currentCostPerLb: string;
  afterReversal:
    | { kind: "removed" }
    | {
        kind: "restored";
        costPerLb: string;
        sourceInvoiceId: string;
        sourceInvoiceNumber: string | null;
        receiveDate: string;
      }
    | { kind: "unchanged"; costPerLb: string };
  dependentCustomerCount: number;
};

export type ReversalPreview = {
  invoice: {
    id: string;
    referenceNumber: string;
    invoiceNumber: string | null;
    supplierId: string;
    supplierName: string;
  };
  lotsToDelete: number;
  inventoryItemsToDelete: number;
  blockedItems: Array<{ barcodeId: string; status: string }>;
  costChanges: ReversalCostChange[];
};

/**
 * Read-only: compute exactly what `reverseSupplierInvoice` would do without
 * performing it. Drives the reversal confirmation dialog so the user can see
 * which per-supplier costs will change (and to what) before confirming.
 */
export async function getReversalPreview(invoiceId: string): Promise<ReversalPreview> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) throw new Error("Forbidden");
  requirePermission(currentUser.role, "view_supplier_invoice");

  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, invoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    with: {
      supplier: { columns: { id: true, name: true } },
      lines: {
        columns: { id: true, productId: true },
        with: {
          lotReceipts: {
            with: { lot: { with: { inventoryItems: true } } },
          },
        },
      },
    },
  });
  if (!invoice) throw new Error("Supplier invoice not found.");

  const supplierId = invoice.supplierId;
  const supplierName = invoice.supplier?.name ?? "";

  const lotIds = new Set<string>();
  const blockedItems: Array<{ barcodeId: string; status: string }> = [];
  let inventoryItemsToDelete = 0;
  for (const line of invoice.lines) {
    for (const receipt of line.lotReceipts) {
      const lot = receipt.lot;
      if (!lot) continue;
      lotIds.add(lot.id);
      for (const item of lot.inventoryItems) {
        inventoryItemsToDelete++;
        if (item.status !== "in_stock") {
          blockedItems.push({ barcodeId: item.barcodeId, status: item.status });
        }
      }
    }
  }

  const productIds = Array.from(new Set(invoice.lines.map(l => l.productId)));
  if (productIds.length === 0) {
    return {
      invoice: {
        id: invoice.id,
        referenceNumber: invoice.referenceNumber,
        invoiceNumber: invoice.invoiceNumber,
        supplierId,
        supplierName,
      },
      lotsToDelete: lotIds.size,
      inventoryItemsToDelete,
      blockedItems,
      costChanges: [],
    };
  }

  const [productRows, currentCostRows, customerPriceRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
      })
      .from(products)
      .where(and(eq(products.tenantId, tenant.id), inArray(products.id, productIds))),
    db
      .select({
        productId: productSupplierCosts.productId,
        costPerLb: productSupplierCosts.costPerLb,
      })
      .from(productSupplierCosts)
      .where(
        and(
          eq(productSupplierCosts.supplierId, supplierId),
          inArray(productSupplierCosts.productId, productIds),
        ),
      ),
    db
      .select({
        productId: customerProductPrices.productId,
        customerId: customerProductPrices.customerId,
      })
      .from(customerProductPrices)
      .where(
        and(
          eq(customerProductPrices.supplierId, supplierId),
          inArray(customerProductPrices.productId, productIds),
        ),
      ),
  ]);

  const productById = new Map(productRows.map(p => [p.id, p] as const));
  const currentCostByProduct = new Map(currentCostRows.map(r => [r.productId, r.costPerLb] as const));
  const customerCountByProduct = new Map<string, number>();
  for (const row of customerPriceRows) {
    customerCountByProduct.set(
      row.productId,
      (customerCountByProduct.get(row.productId) ?? 0) + 1,
    );
  }

  const costChanges: ReversalCostChange[] = [];
  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) continue;
    const currentCost = currentCostByProduct.get(productId);
    if (!currentCost) continue; // no row written by this invoice — nothing to show

    const prior = await findPriorSupplierInvoiceLine({
      tx: db,
      supplierId,
      productId,
      excludeInvoiceId: invoice.id,
    });
    const restoredCost = prior ? supplierInvoiceLineCostPerLb(prior) : null;

    let after: ReversalCostChange["afterReversal"];
    if (prior && restoredCost != null) {
      after =
        restoredCost === currentCost
          ? { kind: "unchanged", costPerLb: currentCost }
          : {
              kind: "restored",
              costPerLb: restoredCost,
              sourceInvoiceId: prior.invoiceId,
              sourceInvoiceNumber: prior.invoiceNumber,
              receiveDate: prior.receiveDate,
            };
    } else {
      after = { kind: "removed" };
    }

    costChanges.push({
      productId,
      productName: product.name,
      productSku: product.sku ?? null,
      currentCostPerLb: currentCost,
      afterReversal: after,
      dependentCustomerCount: customerCountByProduct.get(productId) ?? 0,
    });
  }

  return {
    invoice: {
      id: invoice.id,
      referenceNumber: invoice.referenceNumber,
      invoiceNumber: invoice.invoiceNumber,
      supplierId,
      supplierName,
    },
    lotsToDelete: lotIds.size,
    inventoryItemsToDelete,
    blockedItems,
    costChanges,
  };
}

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
  const charges = (input.charges ?? []).filter(c => c.description.trim() && Number(c.amount) > 0);
  const totalAmount = sumTotals([
    ...normalizedLines.map(l => l.lineTotal),
    ...charges.map(c => c.amount),
  ]);

  const invoiceId = await db.transaction(async tx => {
    const referenceNumber = await generateSupplierInvoiceReferenceNumber(tx, tenant.id);
    const [invoice] = await tx
      .insert(supplierInvoices)
      .values({
        tenantId: tenant.id,
        supplierId: input.supplierId,
        referenceNumber,
        invoiceNumber: input.invoiceNumber?.trim() || null,
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
      entityLabel: invoice.referenceNumber,
      afterJson: JSON.stringify({
        status: "draft",
        totalAmount,
      }),
      contextJson: JSON.stringify({
        supplierId: input.supplierId,
        lines: normalizedLines.length,
        charges: charges.length,
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

    if (charges.length > 0) {
      await tx.insert(supplierInvoiceCharges).values(
        charges.map(c => ({
          tenantId: tenant.id,
          supplierInvoiceId: invoice.id,
          description: c.description.trim(),
          chargeType: c.chargeType ?? "other",
          rate: c.rate ? c.rate : null,
          includeInInventoryCost: c.includeInInventoryCost ?? false,
          amount: c.amount,
        })),
      );
    }

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
  const charges = (input.charges ?? []).filter(c => c.description.trim() && Number(c.amount) > 0);
  const totalAmount = sumTotals([
    ...normalizedLines.map(l => l.lineTotal),
    ...charges.map(c => c.amount),
  ]);

  await db.transaction(async tx => {
    await tx
      .update(supplierInvoices)
      .set({
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        invoiceDate: input.invoiceDate,
        receiveDate: input.receiveDate,
        paymentMethod: input.paymentMethod ?? null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        totalAmount,
        updatedByUserId: currentUser.id,
      })
      .where(eq(supplierInvoices.id, input.id));

    // Simple reconciliation strategy: delete all existing lines/charges then re-insert.
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

    await tx
      .delete(supplierInvoiceCharges)
      .where(eq(supplierInvoiceCharges.supplierInvoiceId, input.id));

    if (charges.length > 0) {
      await tx.insert(supplierInvoiceCharges).values(
        charges.map(c => ({
          tenantId: tenant.id,
          supplierInvoiceId: input.id,
          description: c.description.trim(),
          chargeType: c.chargeType ?? "other",
          rate: c.rate ? c.rate : null,
          includeInInventoryCost: c.includeInInventoryCost ?? false,
          amount: c.amount,
        })),
      );
    }

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "update",
      entityTable: "supplier_invoices",
      entityId: input.id,
      entityLabel: input.invoiceNumber?.trim() || null,
      changedFieldsJson: JSON.stringify([
        "supplierId",
        "invoiceNumber",
        "invoiceDate",
        "receiveDate",
        "paymentMethod",
        "notes",
        "lines",
        "charges",
        "totalAmount",
      ]),
      contextJson: JSON.stringify({
        lines: normalizedLines.length,
        charges: charges.length,
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
      referenceNumber: invoice.referenceNumber,
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

    const caseCount = Math.max(1, line.quantityCases || 1);
    const perCaseWeights = parsePersistedCaseWeights(line.caseWeightsLbs);
    const totalWeight = Number(line.weightLbs ?? 0);
    const fallbackWeight = caseCount > 0 ? totalWeight / caseCount : totalWeight;

    const itemRows = Array.from({ length: caseCount }, (_, i) => {
      const caseWeightLbs = perCaseWeights[i] != null
        ? String(perCaseWeights[i])
        : String(fallbackWeight);
      return {
        productId: line.productId,
        lotId: lot.id,
        barcodeId: generateBarcode(),
        exactWeightLbs: caseWeightLbs,
        cases: 1,
        costPerUnitSnapshot: line.unitPrice,
        costUnitTypeSnapshot: line.unitType,
        status: "in_stock" as const,
      };
    });

    await tx.insert(inventoryItems).values(itemRows);
  }

  for (const line of invoice.lines) {
    await syncSupplierInvoiceLineCost({
      tx,
      supplierId: invoice.supplierId,
      receiveDate: invoice.receiveDate,
      line,
    });
  }

  const totalInventoryItemsCreated = invoice.lines.reduce(
    (sum, line) => sum + Math.max(1, line.quantityCases || 1),
    0,
  );

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
      inventoryItemsCreated: totalInventoryItemsCreated,
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

    await rollbackSupplierInvoiceLineCosts({
      tx,
      invoiceId: input.id,
      supplierId: invoice.supplierId,
      productIds: invoice.lines.map(l => l.productId),
    });

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
  checkNumber?: string | null;
  referenceNumber?: string | null;
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

    const trimmedCheckNumber = input.checkNumber?.trim() || null;
    const trimmedReferenceNumber = input.referenceNumber?.trim() || null;
    const [payment] = await tx.insert(supplierInvoicePayments).values({
      tenantId: tenant.id,
      supplierInvoiceId: input.supplierInvoiceId,
      paymentDate: input.paymentDate,
      amount: amount.toFixed(2),
      paymentMethod: input.paymentMethod,
      checkNumber: trimmedCheckNumber,
      referenceNumber: trimmedReferenceNumber,
      notes: input.notes?.trim() || null,
      createdByUserId: currentUser.id,
    }).returning({ id: supplierInvoicePayments.id });

    // Flip the bill from "completed" → "paid" when this payment fully
    // covers the remaining balance. The detail page UI gates the
    // "Download PDF as paid", Plaid-match, and fully-paid banner on the
    // status column — without this flip those surfaces stay stale even
    // after the balance is zero.
    const newPaidTotal = Number(summary.totalPaid) + amount;
    const totalAmount = Number(invoice.totalAmount);
    if (
      newPaidTotal + 0.005 >= totalAmount &&
      invoice.status === "completed"
    ) {
      await tx
        .update(supplierInvoices)
        .set({ status: "paid", updatedAt: new Date() })
        .where(
          and(
            eq(supplierInvoices.id, input.supplierInvoiceId),
            eq(supplierInvoices.tenantId, tenant.id),
          ),
        );
    }

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
        checkNumber: trimmedCheckNumber,
        referenceNumber: trimmedReferenceNumber,
      }),
    });
  });

  return (await getSupplierInvoiceById(input.supplierInvoiceId))!;
}

/**
 * Hard-delete a supplier-invoice payment. The parent bill's paid total is
 * derived (computePaymentSummary scans payments[] on read) so there's no
 * denormalized counter to maintain — the next read recomputes from the
 * remaining rows. Action is captured in the audit log; the void itself
 * is permanent.
 */
export async function voidSupplierInvoicePayment(id: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "record_supplier_payment");

  const existing = await db.query.supplierInvoicePayments.findFirst({
    where: and(
      eq(supplierInvoicePayments.id, id),
      eq(supplierInvoicePayments.tenantId, tenant.id),
    ),
    with: {
      supplierInvoice: {
        columns: { id: true, invoiceNumber: true },
      },
    },
  });
  if (!existing) {
    throw new Error("Supplier payment not found.");
  }

  await db.transaction(async tx => {
    await tx
      .delete(supplierInvoicePayments)
      .where(
        and(
          eq(supplierInvoicePayments.id, id),
          eq(supplierInvoicePayments.tenantId, tenant.id),
        ),
      );

    // If voiding this payment drops the bill below fully-paid, revert
    // "paid" → "completed" so the UI gates (PDF download, fully-paid
    // banner) flip back accordingly.
    const remaining = await tx.query.supplierInvoices.findFirst({
      where: eq(supplierInvoices.id, existing.supplierInvoiceId),
      columns: { id: true, status: true, totalAmount: true },
      with: { payments: { columns: { amount: true } } },
    });
    if (remaining && remaining.status === "paid") {
      const summary = computePaymentSummary(remaining);
      if (summary.paymentStatus !== "paid") {
        await tx
          .update(supplierInvoices)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(supplierInvoices.id, existing.supplierInvoiceId));
      }
    }

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "delete",
      entityTable: "supplier_invoice_payments",
      entityId: id,
      entityLabel: existing.supplierInvoice?.invoiceNumber ?? null,
      contextJson: JSON.stringify({
        amount: existing.amount,
        paymentMethod: existing.paymentMethod,
        checkNumber: existing.checkNumber,
        referenceNumber: existing.referenceNumber,
        paymentDate: existing.paymentDate,
      }),
    });
  });

  return { supplierInvoiceId: existing.supplierInvoiceId };
}

export type UpdateSupplierInvoicePaymentInput = {
  id: string;
  paymentDate?: string;
  amount?: string;
  paymentMethod?: "cash" | "check" | "ach" | "zelle" | "credit_card";
  checkNumber?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
};

/**
 * Edit an AP payment in place. Only the supplied fields are written.
 * Amount changes are server-side-bounded: newAmount + sum of *other*
 * payments on the same bill must not exceed the bill's totalAmount.
 */
export async function updateSupplierInvoicePayment(
  input: UpdateSupplierInvoicePaymentInput,
) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "record_supplier_payment");

  const existing = await db.query.supplierInvoicePayments.findFirst({
    where: and(
      eq(supplierInvoicePayments.id, input.id),
      eq(supplierInvoicePayments.tenantId, tenant.id),
    ),
    with: {
      supplierInvoice: {
        columns: { id: true, invoiceNumber: true, totalAmount: true },
        with: { payments: { columns: { id: true, amount: true } } },
      },
    },
  });
  if (!existing) {
    throw new Error("Supplier payment not found.");
  }

  const patch: Partial<typeof supplierInvoicePayments.$inferInsert> = {};

  if (input.paymentDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
      throw new Error("Payment date must be a valid YYYY-MM-DD value.");
    }
    patch.paymentDate = input.paymentDate;
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than 0.");
    }
    const otherSum = (existing.supplierInvoice?.payments ?? [])
      .filter(p => p.id !== input.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalAmount = Number(existing.supplierInvoice?.totalAmount ?? 0);
    if (otherSum + amount - totalAmount > 0.01) {
      throw new Error(
        "Amount would push paid total over the bill's grand total.",
      );
    }
    patch.amount = amount.toFixed(2);
  }

  if (input.paymentMethod !== undefined) {
    patch.paymentMethod = input.paymentMethod;
  }

  if (input.checkNumber !== undefined) {
    patch.checkNumber = input.checkNumber?.trim() || null;
  }
  if (input.referenceNumber !== undefined) {
    patch.referenceNumber = input.referenceNumber?.trim() || null;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return { supplierInvoiceId: existing.supplierInvoiceId };
  }

  await db.transaction(async tx => {
    await tx
      .update(supplierInvoicePayments)
      .set(patch)
      .where(
        and(
          eq(supplierInvoicePayments.id, input.id),
          eq(supplierInvoicePayments.tenantId, tenant.id),
        ),
      );

    // Edits that change amount can flip the bill's status in either
    // direction: a raise can push completed → paid; a reduction can
    // drop paid → completed. Recompute against the post-update payments
    // set so both transitions are covered.
    if (input.amount !== undefined) {
      const refreshed = await tx.query.supplierInvoices.findFirst({
        where: eq(supplierInvoices.id, existing.supplierInvoiceId),
        columns: { id: true, status: true, totalAmount: true },
        with: { payments: { columns: { amount: true } } },
      });
      if (refreshed) {
        const summary = computePaymentSummary(refreshed);
        if (
          summary.paymentStatus === "paid" &&
          refreshed.status === "completed"
        ) {
          await tx
            .update(supplierInvoices)
            .set({ status: "paid", updatedAt: new Date() })
            .where(eq(supplierInvoices.id, existing.supplierInvoiceId));
        } else if (
          summary.paymentStatus !== "paid" &&
          refreshed.status === "paid"
        ) {
          await tx
            .update(supplierInvoices)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(supplierInvoices.id, existing.supplierInvoiceId));
        }
      }
    }

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "update",
      entityTable: "supplier_invoice_payments",
      entityId: input.id,
      entityLabel: existing.supplierInvoice?.invoiceNumber ?? null,
      contextJson: JSON.stringify({
        changes: Object.fromEntries(
          (
            [
              "paymentDate",
              "amount",
              "paymentMethod",
              "checkNumber",
              "referenceNumber",
              "notes",
            ] as const
          )
            .filter(
              key => input[key] !== undefined && input[key] !== existing[key],
            )
            .map(key => [key, { from: existing[key], to: input[key] }]),
        ),
      }),
    });
  });

  return { supplierInvoiceId: existing.supplierInvoiceId };
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

// ---------------------------------------------------------------------------
// Duplicate-invoice lookup. Vendors occasionally resend the same invoice;
// receivers can also accidentally re-import a PDF that's already been posted.
// The Review screen calls this to warn before the user re-posts a duplicate.
//
// Two match modes:
//   `invoice_number` — strict: same (tenant, supplier, supplier-printed
//      invoice number). High confidence — vendors don't typically issue two
//      different bills with the same number.
//   `date_and_total`  — softer: same (tenant, supplier, invoice date, total
//      amount), but only used when the new invoice number is missing or
//      doesn't match anything stored. This catches re-uploads where the AI
//      didn't read the invoice number reliably.
//
// Returns up to 5 matches with enough info for a humane warning ("Already
// posted on 2026-04-22 as bill #INV-014, $1,234.56"). Returns [] when there's
// no match — the typical case.
// ---------------------------------------------------------------------------

export type ExistingSupplierInvoiceMatch = {
  id: string;
  referenceNumber: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalAmount: string;
  status: string;
  /**
   * How we determined this is a duplicate. `invoice_number` is the strong
   * signal — vendors don't reuse invoice numbers. `date_and_total` is a
   * fallback for parses that didn't capture an invoice number; treat with
   * a softer banner.
   */
  matchedBy: "invoice_number" | "date_and_total";
};

export async function findExistingSupplierInvoices(args: {
  supplierId: string;
  supplierInvoiceNumber: string;
  /** Optional softer-match signals. When both are present and the strict
   *  invoice-number lookup turns up empty, we fall back to (date, total). */
  invoiceDate?: string | null;
  totalAmount?: string | number | null;
}): Promise<ExistingSupplierInvoiceMatch[]> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();
  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "view_supplier_invoice");

  const trimmed = args.supplierInvoiceNumber.trim();

  // Strict pass first — invoice-number duplicates are the high-signal case.
  const strictMatches: ExistingSupplierInvoiceMatch[] = trimmed
    ? (
        await db
          .select({
            id: supplierInvoices.id,
            referenceNumber: supplierInvoices.referenceNumber,
            invoiceNumber: supplierInvoices.invoiceNumber,
            invoiceDate: supplierInvoices.invoiceDate,
            totalAmount: supplierInvoices.totalAmount,
            status: supplierInvoices.status,
          })
          .from(supplierInvoices)
          .where(
            and(
              eq(supplierInvoices.tenantId, tenant.id),
              eq(supplierInvoices.supplierId, args.supplierId),
              eq(supplierInvoices.invoiceNumber, trimmed),
            ),
          )
          .orderBy(desc(supplierInvoices.invoiceDate))
          .limit(5)
      ).map(row => ({ ...row, matchedBy: "invoice_number" as const }))
    : [];

  if (strictMatches.length > 0) return strictMatches;

  // Soft pass — only when no invoice number matched. Requires both date and
  // total: matching on just one is too noisy (many bills share a date).
  const dateStr = args.invoiceDate?.trim() || null;
  const totalStr =
    args.totalAmount == null ? null : String(args.totalAmount).trim() || null;
  if (!dateStr || !totalStr) return [];

  // totalAmount is stored as numeric — compare as numeric to avoid string-
  // format mismatches ("100.00" vs "100"). Drizzle preserves the column type;
  // an explicit cast on the bound parameter keeps Postgres from rejecting a
  // text value.
  const softRows = await db
    .select({
      id: supplierInvoices.id,
      referenceNumber: supplierInvoices.referenceNumber,
      invoiceNumber: supplierInvoices.invoiceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      totalAmount: supplierInvoices.totalAmount,
      status: supplierInvoices.status,
    })
    .from(supplierInvoices)
    .where(
      and(
        eq(supplierInvoices.tenantId, tenant.id),
        eq(supplierInvoices.supplierId, args.supplierId),
        eq(supplierInvoices.invoiceDate, dateStr),
        sql`${supplierInvoices.totalAmount} = ${totalStr}::numeric`,
      ),
    )
    .orderBy(desc(supplierInvoices.invoiceDate))
    .limit(5);

  return softRows.map(row => ({ ...row, matchedBy: "date_and_total" as const }));
}
