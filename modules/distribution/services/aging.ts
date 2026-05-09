import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

/* -------------------------------------------------------------------------- */
/* Shared types                                                                */
/* -------------------------------------------------------------------------- */

export const AGING_BUCKETS = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABEL: Record<AgingBucketKey, string> = {
  current: "Current",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "90+ days",
};

export type AgingBucketRow = {
  key: AgingBucketKey;
  label: string;
  total: string; // "0.00"
  invoiceCount: number;
};

export type ArAgingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string | null;
  balanceDue: string;
  daysOverdue: number; // 0 when current
  bucket: AgingBucketKey;
};

export type ArAgingCustomerRow = {
  customerId: string;
  name: string;
  totalBalance: string;
  totalOverdue: string;
  invoiceCount: number;
  oldestDaysOverdue: number;
};

export type ArAging = {
  generatedAt: string;
  totalOpen: string;
  totalOverdue: string;
  buckets: AgingBucketRow[];
  topCustomers: ArAgingCustomerRow[];
  recentOverdueInvoices: ArAgingInvoiceRow[];
};

export type ApAgingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: string;
  receiveDate: string;
  /** Effective due date = invoice_date + supplier.netDays (0 when not set). */
  dueDate: string;
  /** Payment terms used for this invoice's due date; `null` means Net-0 fallback. */
  netDays: number | null;
  balanceDue: string;
  daysOverdue: number;
  bucket: AgingBucketKey;
};

export type ApAgingSupplierRow = {
  supplierId: string;
  name: string;
  totalBalance: string;
  totalOverdue: string;
  invoiceCount: number;
  oldestDaysOverdue: number;
};

export type ApAging = {
  generatedAt: string;
  /**
   * Which policy drives the effective due date for supplier invoices.
   * `supplier_net_days` means: due_date = invoice_date + suppliers.net_days,
   * falling back to invoice_date (Net-0) when a supplier has no net_days set.
   * Surface this so the UI can explain the derivation.
   */
  dueDateBasis: "supplier_net_days";
  totalOpen: string;
  totalOverdue: string;
  buckets: AgingBucketRow[];
  topSuppliers: ApAgingSupplierRow[];
  recentOverdueInvoices: ApAgingInvoiceRow[];
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function toInt(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Normalize a bucket key coming back from SQL (which always sends strings)
 * against the known union. Any stray value collapses to "current" so the UI
 * doesn't accidentally silently drop a row.
 */
function normalizeBucket(value: unknown): AgingBucketKey {
  if (typeof value === "string" && (AGING_BUCKETS as readonly string[]).includes(value)) {
    return value as AgingBucketKey;
  }
  return "current";
}

/**
 * Build a fully-populated bucket list (so the UI can render all five buckets
 * even when no rows land in a bucket).
 */
function fillBuckets(
  rows: Array<{ bucket: unknown; invoice_count: unknown; total: unknown }>,
): AgingBucketRow[] {
  const map = new Map<AgingBucketKey, AgingBucketRow>();
  for (const key of AGING_BUCKETS) {
    map.set(key, {
      key,
      label: AGING_BUCKET_LABEL[key],
      total: "0.00",
      invoiceCount: 0,
    });
  }
  for (const row of rows) {
    const key = normalizeBucket(row.bucket);
    const entry = map.get(key);
    if (!entry) continue;
    entry.total = toMoney(row.total as string | number | null);
    entry.invoiceCount = toInt(row.invoice_count as string | number | null);
  }
  return [...map.values()];
}

/* -------------------------------------------------------------------------- */
/* AR aging                                                                    */
/* -------------------------------------------------------------------------- */

type ArBucketSqlRow = {
  bucket: string;
  invoice_count: string | number;
  total: string | number | null;
};

type ArCustomerSqlRow = {
  customer_id: string;
  name: string;
  total_balance: string | number | null;
  total_overdue: string | number | null;
  invoice_count: string | number;
  oldest_days_overdue: string | number | null;
};

type ArInvoiceSqlRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  invoice_date: string;
  due_date: string | null;
  balance_due: string | number;
  days_overdue: string | number;
  bucket: string;
};

/**
 * Server-side aggregation bucketing open customer invoices (non-void,
 * balance_due > 0) by days overdue. Invoices without a due_date are treated
 * as "current" because there is no enforced deadline.
 *
 * All queries are tenant-scoped and run in parallel.
 */
export async function getArAging(): Promise<ArAging> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;

  const bucketExpr = sql`CASE
    WHEN si.due_date IS NULL OR si.due_date >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - si.due_date <= 30 THEN 'd1_30'
    WHEN CURRENT_DATE - si.due_date <= 60 THEN 'd31_60'
    WHEN CURRENT_DATE - si.due_date <= 90 THEN 'd61_90'
    ELSE 'd90_plus'
  END`;

  const [bucketsRes, totalsRes, topCustomersRes, recentOverdueRes] =
    await Promise.all([
      db.execute<ArBucketSqlRow>(sql`
        SELECT ${bucketExpr} AS bucket,
          COUNT(*)::int AS invoice_count,
          COALESCE(SUM(si.balance_due::numeric), 0) AS total
        FROM sales_invoices si
        WHERE si.tenant_id = ${tenantId}
          AND si.status <> 'void'
          AND si.balance_due::numeric > 0.005
        GROUP BY ${bucketExpr}
      `),

      db.execute<{ total_open: string | number | null; total_overdue: string | number | null }>(sql`
        SELECT
          COALESCE(SUM(si.balance_due::numeric), 0) AS total_open,
          COALESCE(SUM(
            CASE WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE
                 THEN si.balance_due::numeric ELSE 0 END
          ), 0) AS total_overdue
        FROM sales_invoices si
        WHERE si.tenant_id = ${tenantId}
          AND si.status <> 'void'
          AND si.balance_due::numeric > 0.005
      `),

      db.execute<ArCustomerSqlRow>(sql`
        SELECT si.customer_id,
          c.name,
          COALESCE(SUM(si.balance_due::numeric), 0) AS total_balance,
          COALESCE(SUM(
            CASE WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE
                 THEN si.balance_due::numeric ELSE 0 END
          ), 0) AS total_overdue,
          COUNT(*)::int AS invoice_count,
          COALESCE(MAX(
            CASE WHEN si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE
                 THEN (CURRENT_DATE - si.due_date) ELSE 0 END
          ), 0) AS oldest_days_overdue
        FROM sales_invoices si
        JOIN customers c ON c.id = si.customer_id
        WHERE si.tenant_id = ${tenantId}
          AND si.status <> 'void'
          AND si.balance_due::numeric > 0.005
        GROUP BY si.customer_id, c.name
        ORDER BY total_overdue DESC, total_balance DESC
        LIMIT 5
      `),

      db.execute<ArInvoiceSqlRow>(sql`
        SELECT si.id,
          si.invoice_number,
          si.customer_id,
          c.name AS customer_name,
          si.invoice_date,
          si.due_date,
          si.balance_due::numeric AS balance_due,
          (CURRENT_DATE - si.due_date) AS days_overdue,
          ${bucketExpr} AS bucket
        FROM sales_invoices si
        JOIN customers c ON c.id = si.customer_id
        WHERE si.tenant_id = ${tenantId}
          AND si.status <> 'void'
          AND si.balance_due::numeric > 0.005
          AND si.due_date IS NOT NULL
          AND si.due_date < CURRENT_DATE
        ORDER BY si.due_date ASC
        LIMIT 8
      `),
    ]);

  const buckets = fillBuckets(bucketsRes.rows ?? []);

  const totalsRow = totalsRes.rows?.[0];
  const totalOpen = toMoney(totalsRow?.total_open ?? 0);
  const totalOverdue = toMoney(totalsRow?.total_overdue ?? 0);

  const topCustomers: ArAgingCustomerRow[] = (topCustomersRes.rows ?? []).map(
    row => ({
      customerId: row.customer_id,
      name: row.name,
      totalBalance: toMoney(row.total_balance),
      totalOverdue: toMoney(row.total_overdue),
      invoiceCount: toInt(row.invoice_count),
      oldestDaysOverdue: toInt(row.oldest_days_overdue),
    }),
  );

  const recentOverdueInvoices: ArAgingInvoiceRow[] = (
    recentOverdueRes.rows ?? []
  ).map(row => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    balanceDue: toMoney(row.balance_due),
    daysOverdue: Math.max(0, toInt(row.days_overdue)),
    bucket: normalizeBucket(row.bucket),
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalOpen,
    totalOverdue,
    buckets,
    topCustomers,
    recentOverdueInvoices,
  };
}

/* -------------------------------------------------------------------------- */
/* AP aging                                                                    */
/* -------------------------------------------------------------------------- */

type ApBucketSqlRow = {
  bucket: string;
  invoice_count: string | number;
  total: string | number | null;
};

type ApSupplierSqlRow = {
  supplier_id: string;
  name: string;
  total_balance: string | number | null;
  total_overdue: string | number | null;
  invoice_count: string | number;
  oldest_days_overdue: string | number | null;
};

type ApInvoiceSqlRow = {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  invoice_date: string;
  receive_date: string;
  due_date: string;
  net_days: string | number | null;
  balance_due: string | number;
  days_overdue: string | number;
  bucket: string;
};

/**
 * AP aging for completed supplier invoices with remaining balance.
 *
 * Effective due date is derived per-supplier:
 *   due_date = invoice_date + COALESCE(suppliers.net_days, 0) days
 *
 * When a supplier has no `net_days` configured we fall back to Net-0 (the
 * original behavior), and the per-row `netDays` comes back as `null` so the
 * UI can still distinguish "configured terms" from "fallback".
 *
 * Remaining balance is always derived from `supplier_invoice_payments`
 * (authoritative) rather than the stale `supplier_invoices.amount_paid`
 * denormalization.
 */
export async function getApAging(): Promise<ApAging> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;

  const openCte = sql`
    WITH paid AS (
      SELECT sip.supplier_invoice_id, SUM(sip.amount::numeric) AS paid
      FROM supplier_invoice_payments sip
      GROUP BY sip.supplier_invoice_id
    ),
    open_supplier_invoices AS (
      SELECT si.id,
        si.invoice_number,
        si.supplier_id,
        si.invoice_date,
        si.receive_date,
        s.net_days AS net_days,
        (si.invoice_date + (COALESCE(s.net_days, 0) || ' days')::interval)::date AS due_date,
        (si.total_amount::numeric - COALESCE(p.paid, 0)) AS balance_due,
        (CURRENT_DATE - (si.invoice_date + (COALESCE(s.net_days, 0) || ' days')::interval)::date) AS days_overdue
      FROM supplier_invoices si
      JOIN suppliers s ON s.id = si.supplier_id
      LEFT JOIN paid p ON p.supplier_invoice_id = si.id
      WHERE si.tenant_id = ${tenantId}
        AND si.status = 'completed'
        AND (si.total_amount::numeric - COALESCE(p.paid, 0)) > 0.005
    )
  `;

  const bucketExpr = sql`CASE
    WHEN days_overdue <= 0 THEN 'current'
    WHEN days_overdue <= 30 THEN 'd1_30'
    WHEN days_overdue <= 60 THEN 'd31_60'
    WHEN days_overdue <= 90 THEN 'd61_90'
    ELSE 'd90_plus'
  END`;

  const [bucketsRes, totalsRes, topSuppliersRes, recentOverdueRes] =
    await Promise.all([
      db.execute<ApBucketSqlRow>(sql`
        ${openCte}
        SELECT ${bucketExpr} AS bucket,
          COUNT(*)::int AS invoice_count,
          COALESCE(SUM(balance_due), 0) AS total
        FROM open_supplier_invoices
        GROUP BY ${bucketExpr}
      `),

      db.execute<{
        total_open: string | number | null;
        total_overdue: string | number | null;
      }>(sql`
        ${openCte}
        SELECT
          COALESCE(SUM(balance_due), 0) AS total_open,
          COALESCE(SUM(CASE WHEN days_overdue > 0 THEN balance_due ELSE 0 END), 0) AS total_overdue
        FROM open_supplier_invoices
      `),

      db.execute<ApSupplierSqlRow>(sql`
        ${openCte}
        SELECT o.supplier_id,
          s.name,
          COALESCE(SUM(o.balance_due), 0) AS total_balance,
          COALESCE(SUM(CASE WHEN o.days_overdue > 0 THEN o.balance_due ELSE 0 END), 0) AS total_overdue,
          COUNT(*)::int AS invoice_count,
          COALESCE(MAX(CASE WHEN o.days_overdue > 0 THEN o.days_overdue ELSE 0 END), 0) AS oldest_days_overdue
        FROM open_supplier_invoices o
        JOIN suppliers s ON s.id = o.supplier_id
        GROUP BY o.supplier_id, s.name
        ORDER BY total_overdue DESC, total_balance DESC
        LIMIT 5
      `),

      db.execute<ApInvoiceSqlRow>(sql`
        ${openCte}
        SELECT o.id,
          o.invoice_number,
          o.supplier_id,
          s.name AS supplier_name,
          o.invoice_date,
          o.receive_date,
          o.due_date,
          o.net_days,
          o.balance_due,
          o.days_overdue,
          ${bucketExpr} AS bucket
        FROM open_supplier_invoices o
        JOIN suppliers s ON s.id = o.supplier_id
        WHERE o.days_overdue > 0
        ORDER BY o.days_overdue DESC
        LIMIT 8
      `),
    ]);

  const buckets = fillBuckets(bucketsRes.rows ?? []);
  const totalsRow = totalsRes.rows?.[0];
  const totalOpen = toMoney(totalsRow?.total_open ?? 0);
  const totalOverdue = toMoney(totalsRow?.total_overdue ?? 0);

  const topSuppliers: ApAgingSupplierRow[] = (topSuppliersRes.rows ?? []).map(
    row => ({
      supplierId: row.supplier_id,
      name: row.name,
      totalBalance: toMoney(row.total_balance),
      totalOverdue: toMoney(row.total_overdue),
      invoiceCount: toInt(row.invoice_count),
      oldestDaysOverdue: toInt(row.oldest_days_overdue),
    }),
  );

  const recentOverdueInvoices: ApAgingInvoiceRow[] = (
    recentOverdueRes.rows ?? []
  ).map(row => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    invoiceDate: row.invoice_date,
    receiveDate: row.receive_date,
    dueDate: row.due_date,
    netDays: row.net_days == null ? null : toInt(row.net_days),
    balanceDue: toMoney(row.balance_due),
    daysOverdue: Math.max(0, toInt(row.days_overdue)),
    bucket: normalizeBucket(row.bucket),
  }));

  return {
    generatedAt: new Date().toISOString(),
    dueDateBasis: "supplier_net_days",
    totalOpen,
    totalOverdue,
    buckets,
    topSuppliers,
    recentOverdueInvoices,
  };
}
