import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  customers,
  inventoryItems,
  lots,
  products,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLines,
  salesOrders,
  supplierInvoicePayments,
  supplierInvoices,
  suppliers,
} from "@/db/schema";

import { getCurrentTenant } from "./tenants";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

const ACTIVE_INVENTORY_STATUSES = [
  "in_stock",
  "allocated",
  "picked",
  "packed",
] as const;

export type DashboardMetrics = {
  sales7d: string;
  sales30d: string;
  cogs30d: string;
  grossProfit30d: string;
  grossMargin30d: string;
  purchases30d: string;
  unpaidCustomerBalance: string;
  unpaidSupplierBalance: string;
  inventoryValue: string;
  expiringLotsCount: number;
  expiredLotsCount: number;
};

export type SalesOverTimePoint = {
  date: string; // YYYY-MM-DD
  total: string;
  invoiceCount: number;
};

export type SalesFulfillmentBreakdown = {
  open: number;
  fulfilled: number;
  cancelled: number;
  shortShipped: number;
};

export type TopCustomerRow = {
  customerId: string;
  name: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
  marginPercent: string;
  invoiceCount: number;
};

export type TopProductRow = {
  productId: string;
  name: string;
  sku: string;
  quantityCases: number;
  revenue: string;
  cogs: string;
  grossProfit: string;
  marginPercent: string;
};

export type RecentSupplierInvoiceRow = {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  receiveDate: string;
  totalAmount: string;
  balanceDue: string;
  status: string;
};

export type SpendBySupplierRow = {
  supplierId: string;
  name: string;
  total: string;
  invoiceCount: number;
};

export type InventoryStatusRow = {
  status: string;
  itemCount: number;
  totalCases: number;
};

export type ExpiringLotRow = {
  id: string;
  lotNumber: string;
  expirationDate: string;
  supplierId: string;
  supplierName: string;
  activeItemCount: number;
};

export type TopStockedProductRow = {
  productId: string;
  name: string;
  sku: string;
  activeItemCount: number;
  totalCases: number;
};

export type DashboardSummary = {
  generatedAt: string;
  metrics: DashboardMetrics;
  sales: {
    overTime: SalesOverTimePoint[];
    fulfillment: SalesFulfillmentBreakdown;
    topCustomers: TopCustomerRow[];
    topProducts: TopProductRow[];
  };
  purchasing: {
    recent: RecentSupplierInvoiceRow[];
    unpaid: RecentSupplierInvoiceRow[];
    spendBySupplier: SpendBySupplierRow[];
  };
  inventory: {
    byStatus: InventoryStatusRow[];
    expiringLots: ExpiringLotRow[];
    expiredLots: ExpiringLotRow[];
    topStockedProducts: TopStockedProductRow[];
  };
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toMoney(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

/* -------------------------------------------------------------------------- */
/* Main aggregator                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Aggregate dashboard metrics + section data for the current tenant.
 *
 * Runs a handful of focused SQL aggregations in parallel. All queries are
 * tenant-scoped. Returned money fields are `toFixed(2)` strings so the UI can
 * render them directly without re-introducing rounding.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;

  const now = new Date();
  const today = toDateOnly(now);
  const sevenDaysAgo = toDateOnly(shiftDays(now, -7));
  const thirtyDaysAgo = toDateOnly(shiftDays(now, -30));
  const ninetyDaysAgo = toDateOnly(shiftDays(now, -90));
  const inSevenDays = toDateOnly(shiftDays(now, 7));

  const [
    salesInvoices30dRows,
    unpaidSalesRow,
    purchases30dRow,
    unpaidSupplierRows,
    recentSupplierRows,
    spendBySupplierRows,
    cogs30dRow,
    topCustomersRows,
    topProductsRows,
    salesOrderStatusRows,
    shortShipRow,
    inventoryByStatusRows,
    expiringLotsRaw,
    expiredLotsRaw,
    topStockedProductsRows,
    inventoryValueRes,
  ] = await Promise.all([
    // 1. Sales invoices in the last 30d (feeds sales7d, sales30d, over-time chart).
    db
      .select({
        invoiceDate: salesInvoices.invoiceDate,
        totalAmount: salesInvoices.totalAmount,
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          gte(salesInvoices.invoiceDate, thirtyDaysAgo),
          sql`${salesInvoices.status} <> 'void'`,
        ),
      ),

    // 2. Unpaid customer balance (open AR).
    db
      .select({
        balance: sql<string>`coalesce(sum(${salesInvoices.balanceDue}), 0)`,
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          sql`${salesInvoices.status} <> 'void'`,
          sql`${salesInvoices.balanceDue} > 0`,
        ),
      ),

    // 3. Purchases in the last 30d (completed supplier invoices only).
    db
      .select({
        total: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}), 0)`,
      })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.tenantId, tenantId),
          eq(supplierInvoices.status, "completed"),
          gte(supplierInvoices.receiveDate, thirtyDaysAgo),
        ),
      ),

    // 4. Unpaid supplier invoices: completed invoices with balance > 0.
    db
      .select({
        id: supplierInvoices.id,
        invoiceNumber: supplierInvoices.invoiceNumber,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.name,
        receiveDate: supplierInvoices.receiveDate,
        totalAmount: supplierInvoices.totalAmount,
        status: supplierInvoices.status,
        paid: sql<string>`coalesce(sum(${supplierInvoicePayments.amount}), 0)`,
      })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .leftJoin(
        supplierInvoicePayments,
        eq(supplierInvoicePayments.supplierInvoiceId, supplierInvoices.id),
      )
      .where(
        and(
          eq(supplierInvoices.tenantId, tenantId),
          eq(supplierInvoices.status, "completed"),
        ),
      )
      .groupBy(
        supplierInvoices.id,
        supplierInvoices.invoiceNumber,
        supplierInvoices.supplierId,
        suppliers.name,
        supplierInvoices.receiveDate,
        supplierInvoices.totalAmount,
        supplierInvoices.status,
      )
      .orderBy(desc(supplierInvoices.receiveDate)),

    // 5. Recent supplier invoices (any status) — newest 8.
    db
      .select({
        id: supplierInvoices.id,
        invoiceNumber: supplierInvoices.invoiceNumber,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.name,
        receiveDate: supplierInvoices.receiveDate,
        totalAmount: supplierInvoices.totalAmount,
        status: supplierInvoices.status,
        paid: sql<string>`coalesce(sum(${supplierInvoicePayments.amount}), 0)`,
      })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .leftJoin(
        supplierInvoicePayments,
        eq(supplierInvoicePayments.supplierInvoiceId, supplierInvoices.id),
      )
      .where(eq(supplierInvoices.tenantId, tenantId))
      .groupBy(
        supplierInvoices.id,
        supplierInvoices.invoiceNumber,
        supplierInvoices.supplierId,
        suppliers.name,
        supplierInvoices.receiveDate,
        supplierInvoices.totalAmount,
        supplierInvoices.status,
      )
      .orderBy(desc(supplierInvoices.receiveDate))
      .limit(8),

    // 6. Spend by supplier, last 90d, completed invoices, top 5.
    db
      .select({
        supplierId: supplierInvoices.supplierId,
        name: suppliers.name,
        total: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}), 0)`,
        invoiceCount: sql<number>`count(${supplierInvoices.id})::int`,
      })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .where(
        and(
          eq(supplierInvoices.tenantId, tenantId),
          eq(supplierInvoices.status, "completed"),
          gte(supplierInvoices.receiveDate, ninetyDaysAgo),
        ),
      )
      .groupBy(supplierInvoices.supplierId, suppliers.name)
      .orderBy(
        desc(sql`coalesce(sum(${supplierInvoices.totalAmount}), 0)`),
      )
      .limit(5),

    // 7. Total COGS, last 30d, from frozen invoice-line snapshots.
    db
      .select({
        total: sql<string>`coalesce(sum(${salesInvoiceLines.cogsAmountSnapshot}), 0)`,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesInvoices,
        eq(salesInvoices.id, salesInvoiceLines.salesInvoiceId),
      )
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          sql`${salesInvoices.status} <> 'void'`,
          gte(salesInvoices.invoiceDate, thirtyDaysAgo),
        ),
      ),

    // 8. Top customers by gross profit, last 30d, non-void sales invoices.
    db
      .select({
        customerId: salesInvoices.customerId,
        name: customers.name,
        revenue: sql<string>`coalesce(sum(${salesInvoiceLines.lineTotal}), 0)`,
        cogs: sql<string>`coalesce(sum(${salesInvoiceLines.cogsAmountSnapshot}), 0)`,
        invoiceCount: sql<number>`count(distinct ${salesInvoices.id})::int`,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesInvoices,
        eq(salesInvoices.id, salesInvoiceLines.salesInvoiceId),
      )
      .innerJoin(customers, eq(customers.id, salesInvoices.customerId))
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          sql`${salesInvoices.status} <> 'void'`,
          gte(salesInvoices.invoiceDate, thirtyDaysAgo),
        ),
      )
      .groupBy(salesInvoices.customerId, customers.name)
      .orderBy(
        desc(
          sql`coalesce(sum(${salesInvoiceLines.lineTotal} - ${salesInvoiceLines.cogsAmountSnapshot}), 0)`,
        ),
      )
      .limit(5),

    // 9. Top products by gross profit, last 30d, non-void sales invoices.
    db
      .select({
        productId: salesInvoiceLines.productId,
        name: products.name,
        sku: products.sku,
        quantityCases: sql<number>`coalesce(sum(${salesInvoiceLines.quantityCases}), 0)::int`,
        revenue: sql<string>`coalesce(sum(${salesInvoiceLines.lineTotal}), 0)`,
        cogs: sql<string>`coalesce(sum(${salesInvoiceLines.cogsAmountSnapshot}), 0)`,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesInvoices,
        eq(salesInvoices.id, salesInvoiceLines.salesInvoiceId),
      )
      .innerJoin(products, eq(products.id, salesInvoiceLines.productId))
      .where(
        and(
          eq(salesInvoices.tenantId, tenantId),
          sql`${salesInvoices.status} <> 'void'`,
          gte(salesInvoices.invoiceDate, thirtyDaysAgo),
        ),
      )
      .groupBy(salesInvoiceLines.productId, products.name, products.sku)
      .orderBy(
        desc(
          sql`coalesce(sum(${salesInvoiceLines.lineTotal} - ${salesInvoiceLines.cogsAmountSnapshot}), 0)`,
        ),
      )
      .limit(5),

    // 10. Sales-order status counts (all time).
    db
      .select({
        status: salesOrders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(salesOrders)
      .where(eq(salesOrders.tenantId, tenantId))
      .groupBy(salesOrders.status),

    // 11. Distinct orders with any short-shipped line.
    db
      .select({
        count: sql<number>`count(distinct ${salesOrderLines.salesOrderId})::int`,
      })
      .from(salesOrderLines)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderLines.salesOrderId))
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          isNotNull(salesOrderLines.shortShippedAt),
        ),
      ),

    // 12. Inventory by status (counts + cases) — tenant-scoped via lots.
    db
      .select({
        status: inventoryItems.status,
        itemCount: sql<number>`count(*)::int`,
        totalCases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
      })
      .from(inventoryItems)
      .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
      .where(eq(lots.tenantId, tenantId))
      .groupBy(inventoryItems.status),

    // 13. Expiring-soon lots (expiration within next 7d, with active inventory).
    db
      .select({
        id: lots.id,
        lotNumber: lots.lotNumber,
        expirationDate: lots.expirationDate,
        supplierId: lots.supplierId,
        supplierName: suppliers.name,
        activeItemCount: sql<number>`count(${inventoryItems.id})::int`,
      })
      .from(lots)
      .innerJoin(suppliers, eq(suppliers.id, lots.supplierId))
      .innerJoin(inventoryItems, eq(inventoryItems.lotId, lots.id))
      .where(
        and(
          eq(lots.tenantId, tenantId),
          gte(lots.expirationDate, today),
          sql`${lots.expirationDate} <= ${inSevenDays}`,
          inArray(inventoryItems.status, [...ACTIVE_INVENTORY_STATUSES]),
        ),
      )
      .groupBy(
        lots.id,
        lots.lotNumber,
        lots.expirationDate,
        lots.supplierId,
        suppliers.name,
      )
      .orderBy(lots.expirationDate)
      .limit(10),

    // 14. Expired lots still holding active inventory.
    db
      .select({
        id: lots.id,
        lotNumber: lots.lotNumber,
        expirationDate: lots.expirationDate,
        supplierId: lots.supplierId,
        supplierName: suppliers.name,
        activeItemCount: sql<number>`count(${inventoryItems.id})::int`,
      })
      .from(lots)
      .innerJoin(suppliers, eq(suppliers.id, lots.supplierId))
      .innerJoin(inventoryItems, eq(inventoryItems.lotId, lots.id))
      .where(
        and(
          eq(lots.tenantId, tenantId),
          sql`${lots.expirationDate} < ${today}`,
          inArray(inventoryItems.status, [...ACTIVE_INVENTORY_STATUSES]),
        ),
      )
      .groupBy(
        lots.id,
        lots.lotNumber,
        lots.expirationDate,
        lots.supplierId,
        suppliers.name,
      )
      .orderBy(desc(lots.expirationDate))
      .limit(10),

    // 15. Top stocked products (active inventory only).
    db
      .select({
        productId: inventoryItems.productId,
        name: products.name,
        sku: products.sku,
        activeItemCount: sql<number>`count(*)::int`,
        totalCases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
      })
      .from(inventoryItems)
      .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
      .innerJoin(products, eq(products.id, inventoryItems.productId))
      .where(
        and(
          eq(lots.tenantId, tenantId),
          inArray(inventoryItems.status, [...ACTIVE_INVENTORY_STATUSES]),
        ),
      )
      .groupBy(inventoryItems.productId, products.name, products.sku)
      .orderBy(desc(sql`count(*)`))
      .limit(5),

    // 16. Inventory value from receipt-time cost snapshots stored on each
    // inventory item. This keeps historical value stable even if supplier
    // invoice pricing or product cost config changes later.
    db.execute<{ value: string | null }>(sql`
      SELECT COALESCE(SUM(
        CASE
          WHEN ii.cost_unit_type_snapshot = 'fixed_case'
            THEN ii.cases::numeric * ii.cost_per_unit_snapshot::numeric
          ELSE ii.exact_weight_lbs::numeric * ii.cost_per_unit_snapshot::numeric
        END
      ), 0) AS value
      FROM inventory_items ii
      JOIN lots l ON l.id = ii.lot_id
      WHERE l.tenant_id = ${tenantId}
        AND ii.status IN ('in_stock', 'allocated', 'picked', 'packed')
    `),
  ]);

  /* ------------------------------------------------------------------------ */
  /* Derivations                                                               */
  /* ------------------------------------------------------------------------ */

  // Sales totals + over-time buckets.
  const salesDayBuckets = new Map<string, { total: number; count: number }>();
  // Pre-seed 30 days of buckets so the chart has no gaps.
  for (let i = 29; i >= 0; i--) {
    const d = toDateOnly(shiftDays(now, -i));
    salesDayBuckets.set(d, { total: 0, count: 0 });
  }
  let sales7dTotal = 0;
  let sales30dTotal = 0;
  for (const row of salesInvoices30dRows) {
    const amount = Number(row.totalAmount ?? 0) || 0;
    sales30dTotal += amount;
    if (row.invoiceDate >= sevenDaysAgo) {
      sales7dTotal += amount;
    }
    const bucket = salesDayBuckets.get(row.invoiceDate);
    if (bucket) {
      bucket.total += amount;
      bucket.count += 1;
    }
  }
  const cogs30d = Number(cogs30dRow[0]?.total ?? 0) || 0;
  const grossProfit30d = sales30dTotal - cogs30d;
  const grossMargin30d =
    sales30dTotal > 0 ? (grossProfit30d / sales30dTotal) * 100 : 0;

  const overTime: SalesOverTimePoint[] = [...salesDayBuckets.entries()].map(
    ([date, bucket]) => ({
      date,
      total: toMoney(bucket.total),
      invoiceCount: bucket.count,
    }),
  );

  const unpaidCustomerBalance = toMoney(unpaidSalesRow[0]?.balance ?? 0);
  const purchases30d = toMoney(purchases30dRow[0]?.total ?? 0);

  // Unpaid supplier: keep balanceDue per row + aggregate.
  let unpaidSupplierBalance = 0;
  const unpaidSupplierInvoices: RecentSupplierInvoiceRow[] = [];
  for (const row of unpaidSupplierRows) {
    const total = Number(row.totalAmount ?? 0) || 0;
    const paid = Number(row.paid ?? 0) || 0;
    const balance = Math.max(0, total - paid);
    if (balance <= 0.005) continue;
    unpaidSupplierBalance += balance;
    unpaidSupplierInvoices.push({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      receiveDate: row.receiveDate,
      totalAmount: toMoney(total),
      balanceDue: toMoney(balance),
      status: row.status,
    });
  }
  unpaidSupplierInvoices.sort(
    (a, b) => (a.receiveDate < b.receiveDate ? 1 : -1),
  );

  const recentSupplierInvoices: RecentSupplierInvoiceRow[] =
    recentSupplierRows.map(row => {
      const total = Number(row.totalAmount ?? 0) || 0;
      const paid = Number(row.paid ?? 0) || 0;
      const balance = Math.max(0, total - paid);
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        receiveDate: row.receiveDate,
        totalAmount: toMoney(total),
        balanceDue: toMoney(balance),
        status: row.status,
      };
    });

  // Fulfillment breakdown.
  const fulfillmentCounts: SalesFulfillmentBreakdown = {
    open: 0,
    fulfilled: 0,
    cancelled: 0,
    shortShipped: Number(shortShipRow[0]?.count ?? 0) || 0,
  };
  for (const row of salesOrderStatusRows) {
    const count = Number(row.count ?? 0) || 0;
    switch (row.status) {
      case "fulfilled":
        fulfillmentCounts.fulfilled += count;
        break;
      case "cancelled":
        fulfillmentCounts.cancelled += count;
        break;
      case "sales_order":
      case "confirmed":
        fulfillmentCounts.open += count;
        break;
      default:
        break;
    }
  }

  // Inventory-value scalar.
  const inventoryValue = toMoney(
    inventoryValueRes.rows?.[0]?.value ?? 0,
  );

  // Lot expiration counts (summed across the lot-level rows we fetched).
  const expiringLotsCount = expiringLotsRaw.length;
  const expiredLotsCount = expiredLotsRaw.length;

  const expiringLots: ExpiringLotRow[] = expiringLotsRaw.map(row => ({
    id: row.id,
    lotNumber: row.lotNumber,
    expirationDate: row.expirationDate,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    activeItemCount: Number(row.activeItemCount ?? 0) || 0,
  }));
  const expiredLots: ExpiringLotRow[] = expiredLotsRaw.map(row => ({
    id: row.id,
    lotNumber: row.lotNumber,
    expirationDate: row.expirationDate,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    activeItemCount: Number(row.activeItemCount ?? 0) || 0,
  }));

  const inventoryByStatus: InventoryStatusRow[] = inventoryByStatusRows.map(
    row => ({
      status: row.status as string,
      itemCount: Number(row.itemCount ?? 0) || 0,
      totalCases: Number(row.totalCases ?? 0) || 0,
    }),
  );

  const topCustomers: TopCustomerRow[] = topCustomersRows.map(row => ({
    customerId: row.customerId,
    name: row.name,
    revenue: toMoney(row.revenue ?? 0),
    cogs: toMoney(row.cogs ?? 0),
    grossProfit: toMoney(
      (Number(row.revenue ?? 0) || 0) - (Number(row.cogs ?? 0) || 0),
    ),
    marginPercent: (
      (Number(row.revenue ?? 0) || 0) > 0
        ? (((Number(row.revenue ?? 0) || 0) - (Number(row.cogs ?? 0) || 0)) /
            (Number(row.revenue ?? 0) || 0)) *
          100
        : 0
    ).toFixed(1),
    invoiceCount: Number(row.invoiceCount ?? 0) || 0,
  }));

  const topProducts: TopProductRow[] = topProductsRows.map(row => ({
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    quantityCases: Number(row.quantityCases ?? 0) || 0,
    revenue: toMoney(row.revenue ?? 0),
    cogs: toMoney(row.cogs ?? 0),
    grossProfit: toMoney(
      (Number(row.revenue ?? 0) || 0) - (Number(row.cogs ?? 0) || 0),
    ),
    marginPercent: (
      (Number(row.revenue ?? 0) || 0) > 0
        ? (((Number(row.revenue ?? 0) || 0) - (Number(row.cogs ?? 0) || 0)) /
            (Number(row.revenue ?? 0) || 0)) *
          100
        : 0
    ).toFixed(1),
  }));

  const spendBySupplier: SpendBySupplierRow[] = spendBySupplierRows.map(
    row => ({
      supplierId: row.supplierId,
      name: row.name,
      total: toMoney(row.total ?? 0),
      invoiceCount: Number(row.invoiceCount ?? 0) || 0,
    }),
  );

  const topStockedProducts: TopStockedProductRow[] =
    topStockedProductsRows.map(row => ({
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      activeItemCount: Number(row.activeItemCount ?? 0) || 0,
      totalCases: Number(row.totalCases ?? 0) || 0,
    }));

  return {
    generatedAt: now.toISOString(),
    metrics: {
      sales7d: toMoney(sales7dTotal),
      sales30d: toMoney(sales30dTotal),
      cogs30d: toMoney(cogs30d),
      grossProfit30d: toMoney(grossProfit30d),
      grossMargin30d: grossMargin30d.toFixed(1),
      purchases30d,
      unpaidCustomerBalance,
      unpaidSupplierBalance: toMoney(unpaidSupplierBalance),
      inventoryValue,
      expiringLotsCount,
      expiredLotsCount,
    },
    sales: {
      overTime,
      fulfillment: fulfillmentCounts,
      topCustomers,
      topProducts,
    },
    purchasing: {
      recent: recentSupplierInvoices,
      unpaid: unpaidSupplierInvoices.slice(0, 8),
      spendBySupplier,
    },
    inventory: {
      byStatus: inventoryByStatus,
      expiringLots,
      expiredLots,
      topStockedProducts,
    },
  };
}
