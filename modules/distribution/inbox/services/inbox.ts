import "server-only";

import { and, asc, count, desc, eq, gte, isNull, lt, lte, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccountBalanceSnapshots,
  bankAccounts,
  bankTransactions,
  customers,
  lots,
  inventoryItems,
  plaidConnections,
  products,
  salesOrders,
  supplierInvoices,
  supplierInvoiceLines,
  suppliers,
  tenants,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import type {
  CashFlowSummary,
  InboxData,
  InboxItem,
  ExpiringLotEntry,
  MysteryOutflow,
  PriceMover,
  InboxStats,
  ActiveSession,
  ReauthBanner,
  TodayScheduleEntry,
} from "../types";

// ── Date helpers ───────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fourWeeksAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return d;
}

function hoursUntil(dateStr: string): number {
  const target = new Date(dateStr + "T23:59:59");
  return Math.round((target.getTime() - Date.now()) / 3_600_000);
}

function guessCategoryFromName(name: string): ExpiringLotEntry["category"] {
  const lower = name.toLowerCase();
  if (lower.includes("beef") || lower.includes("brisket") || lower.includes("steak") || lower.includes("ground")) return "beef";
  if (lower.includes("chicken") || lower.includes("tender") || lower.includes("wing") || lower.includes("poultry")) return "chicken";
  if (lower.includes("lamb") || lower.includes("chop")) return "lamb";
  return "other";
}

// ── Main query ─────────────────────────────────────────────────────────────

export async function getInboxData(): Promise<InboxData> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;
  const now = new Date();
  const weekStart = startOfWeek();
  const fourWeeksBack = fourWeeksAgo();
  const in7Days = daysFromNow(7);
  const in2Days = daysFromNow(2);

  // ── 1. Draft supplier invoices (bills needing review) ────────────────────
  const draftBills = await db
    .select({
      id: supplierInvoices.id,
      // Use reference_number as the canonical identifier; invoice_number is
      // optional and may be null for bills without a printed supplier number.
      invoiceNumber: supplierInvoices.referenceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      totalAmount: supplierInvoices.totalAmount,
      createdAt: supplierInvoices.createdAt,
      supplierName: suppliers.name,
      lineCount: sql<number>`count(${supplierInvoiceLines.id})::int`,
    })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .leftJoin(supplierInvoiceLines, eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id))
    .where(and(eq(supplierInvoices.tenantId, tenantId), eq(supplierInvoices.status, "draft")))
    .groupBy(supplierInvoices.id, suppliers.name)
    .orderBy(desc(supplierInvoices.createdAt))
    .limit(10);

  // ── 2. Expiring lots within 7 days ────────────────────────────────────────
  const expiringLotsRaw = await db
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      expirationDate: lots.expirationDate,
      productName: products.name,
      totalWeight: sql<string>`sum(${inventoryItems.exactWeightLbs})`,
    })
    .from(lots)
    .innerJoin(inventoryItems, and(
      eq(inventoryItems.lotId, lots.id),
      eq(inventoryItems.status, "in_stock"),
    ))
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .where(and(
      eq(lots.tenantId, tenantId),
      lte(lots.expirationDate, in7Days.toISOString().split("T")[0]),
      gte(lots.expirationDate, now.toISOString().split("T")[0]),
    ))
    .groupBy(lots.id, lots.lotNumber, lots.expirationDate, products.name)
    .orderBy(lots.expirationDate)
    .limit(8);

  // ── 3. Week spend ──────────────────────────────────────────────────────────
  const [weekSpendRow] = await db
    .select({ total: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}), 0)` })
    .from(supplierInvoices)
    .where(and(
      eq(supplierInvoices.tenantId, tenantId),
      eq(supplierInvoices.status, "completed"),
      gte(supplierInvoices.createdAt, weekStart),
    ));

  const [priorSpendRow] = await db
    .select({ total: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}), 0)` })
    .from(supplierInvoices)
    .where(and(
      eq(supplierInvoices.tenantId, tenantId),
      eq(supplierInvoices.status, "completed"),
      gte(supplierInvoices.createdAt, fourWeeksBack),
      lt(supplierInvoices.createdAt, weekStart),
    ));

  const weekSpend = parseFloat(weekSpendRow?.total ?? "0");
  const priorAvgSpend = parseFloat(priorSpendRow?.total ?? "0") / 4;
  const weekSpendDeltaPct = priorAvgSpend > 0
    ? ((weekSpend - priorAvgSpend) / priorAvgSpend) * 100
    : 0;

  // ── 4. Price movers (top 3 SKUs by deviation in last 7 days) ─────────────
  const recentLines = await db
    .select({
      productId: supplierInvoiceLines.productId,
      productName: products.name,
      unitPrice: supplierInvoiceLines.unitPrice,
      invoiceDate: supplierInvoices.invoiceDate,
      supplierName: suppliers.name,
    })
    .from(supplierInvoiceLines)
    .innerJoin(supplierInvoices, eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id))
    .innerJoin(products, eq(supplierInvoiceLines.productId, products.id))
    .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(and(
      eq(supplierInvoices.tenantId, tenantId),
      eq(supplierInvoices.status, "completed"),
      gte(supplierInvoices.invoiceDate, new Date(Date.now() - 90 * 86_400_000).toISOString().split("T")[0]),
    ))
    .orderBy(supplierInvoiceLines.productId, supplierInvoices.invoiceDate)
    .limit(200);

  // Group by product, compute 7-day vs prior delta
  const productPrices = new Map<string, {
    name: string;
    supplier: string;
    recentPrices: number[];
    priorPrices: number[];
  }>();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];

  for (const row of recentLines) {
    if (!row.productId) continue;
    const price = parseFloat(row.unitPrice ?? "0");
    if (!productPrices.has(row.productId)) {
      productPrices.set(row.productId, {
        name: row.productName,
        supplier: row.supplierName ?? "",
        recentPrices: [],
        priorPrices: [],
      });
    }
    const entry = productPrices.get(row.productId)!;
    if (row.invoiceDate >= sevenDaysAgo) {
      entry.recentPrices.push(price);
    } else {
      entry.priorPrices.push(price);
    }
  }

  const movers: PriceMover[] = [];
  for (const [productId, data] of productPrices) {
    if (data.recentPrices.length === 0 || data.priorPrices.length === 0) continue;
    const recentAvg = data.recentPrices.reduce((a, b) => a + b, 0) / data.recentPrices.length;
    const priorAvg = data.priorPrices.reduce((a, b) => a + b, 0) / data.priorPrices.length;
    const deltaPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;
    if (Math.abs(deltaPct) < 3) continue;
    movers.push({
      productId,
      productName: data.name,
      supplierName: data.supplier,
      deltaPct,
      sparkData: data.priorPrices.slice(-5).concat(data.recentPrices.slice(-2)),
    });
  }
  movers.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  const topMovers = movers.slice(0, 3);

  // ── 5. Today's schedule: bills due/overdue + sales orders due today ────────

  const todayStr = now.toISOString().split("T")[0]!;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]!;

  const [billsDue, ordersDueToday] = await Promise.all([
    // Bills where computed due date (invoice_date + net_days) is today or overdue
    // (limited to 30 days back so ancient unpaid bills don't flood the list)
    db
      .select({
        id: supplierInvoices.id,
        invoiceNumber: supplierInvoices.referenceNumber,
        invoiceDate: supplierInvoices.invoiceDate,
        totalAmount: supplierInvoices.totalAmount,
        supplierName: suppliers.name,
        netDays: suppliers.netDays,
      })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .where(
        and(
          eq(supplierInvoices.tenantId, tenantId),
          sql`${supplierInvoices.status} IN ('posted', 'receiving', 'reconciled', 'completed')`,
          // due date = invoice_date + net_days ≤ today
          sql`(${supplierInvoices.invoiceDate}::date + COALESCE(${suppliers.netDays}, 0)) <= ${todayStr}::date`,
          // don't show bills older than 30 days overdue
          sql`(${supplierInvoices.invoiceDate}::date + COALESCE(${suppliers.netDays}, 0)) >= ${thirtyDaysAgoStr}::date`,
        ),
      )
      .orderBy(sql`(${supplierInvoices.invoiceDate}::date + COALESCE(${suppliers.netDays}, 0))`)
      .limit(10),

    // Sales orders with dueDate = today that haven't shipped
    db
      .select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        dueDate: salesOrders.dueDate,
        customerName: customers.name,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          eq(salesOrders.dueDate, todayStr),
          sql`${salesOrders.status} NOT IN ('fulfilled', 'cancelled')`,
        ),
      )
      .orderBy(salesOrders.orderNumber)
      .limit(10),
  ]);

  const todaySchedule: TodayScheduleEntry[] = [
    ...billsDue.map(b => {
      const dueDate = new Date(b.invoiceDate + "T00:00:00");
      dueDate.setDate(dueDate.getDate() + (b.netDays ?? 0));
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
      return {
        id: b.id,
        type: "bill_due" as const,
        entityLabel: b.supplierName,
        reference: b.invoiceNumber,
        amount: parseFloat(b.totalAmount),
        route: `/supplier-invoices/${b.id}`,
        daysOverdue: Math.max(0, daysOverdue),
      };
    }),
    ...ordersDueToday.map(o => ({
      id: o.id,
      type: "order_to_ship" as const,
      entityLabel: o.customerName,
      reference: o.orderNumber ?? o.id.slice(0, 8),
      amount: 0, // order total not aggregated here
      route: `/orders/${o.id}`,
      daysOverdue: 0,
    })),
  ];

  // ── Build inbox items ────────────────────────────────────────────────────

  const actionItems: InboxItem[] = [];
  const informationalItems: InboxItem[] = [];

  // Draft bills → new_bill items
  for (const bill of draftBills) {
    actionItems.push({
      id: `new_bill_${bill.id}`,
      urgency: "today",
      category: "new_bill",
      title: `New bill from ${bill.supplierName ?? "supplier"} · ${bill.lineCount ?? 0} lines`,
      meta: `${bill.invoiceNumber} · $${parseFloat(bill.totalAmount).toFixed(2)} · created ${new Date(bill.createdAt).toLocaleDateString()}`,
      pills: [{ label: "Draft · needs review", tone: "blue" }],
      actions: [{ label: "Review →", kind: "primary", route: `/supplier-invoices/${bill.id}/edit` }],
      relatedEntity: { type: "bill", id: bill.id },
      createdAt: new Date(bill.createdAt),
    });
  }

  // Expiring lots → expiring_lot items
  const urgentLots = expiringLotsRaw.filter(l => hoursUntil(l.expirationDate) < 48);
  for (const lot of urgentLots) {
    const hours = hoursUntil(lot.expirationDate);
    const urgency = hours < 24 ? "blocking_others" : "today";
    actionItems.push({
      id: `expiring_lot_${lot.lotId}`,
      urgency,
      category: "expiring_lot",
      title: `${parseFloat(lot.totalWeight ?? "0").toFixed(0)} lb of ${lot.productName} expires ${hours < 24 ? "today" : "tomorrow"} · markdown decision`,
      meta: `Lot ${lot.lotNumber} · ${hours}h left`,
      detail: "No active customer order will pull this lot in time. Consider markdown or donation.",
      detailTone: hours < 24 ? "red" : "amber",
      pills: [{ label: `${hours}h left`, tone: hours < 24 ? "red" : "amber" }],
      actions: [
        { label: "Markdown", kind: "secondary", route: `/lots/${lot.lotId}` },
        { label: "View lot", kind: "ghost", route: `/lots/${lot.lotId}` },
      ],
      relatedEntity: { type: "lot", id: lot.lotId },
      createdAt: new Date(),
      expiresAt: new Date(lot.expirationDate + "T23:59:59"),
    });
  }

  // Price spike items
  const spikes = topMovers.filter(m => m.deltaPct > 15);
  for (const spike of spikes) {
    actionItems.push({
      id: `price_spike_${spike.productId}`,
      urgency: "today",
      category: "price_spike",
      title: `${spike.productName} up ${spike.deltaPct.toFixed(0)}% on latest bill · verify with supplier`,
      meta: `${spike.supplierName} · +${spike.deltaPct.toFixed(1)}% vs 90-day average`,
      pills: [{ label: `+${spike.deltaPct.toFixed(0)}% vs avg`, tone: "red" }],
      actions: [
        { label: "See history", kind: "secondary", route: `/price-chart?productId=${spike.productId}` },
        { label: "Email supplier", kind: "primary" },
      ],
      relatedEntity: { type: "sku", id: spike.productId },
      createdAt: new Date(),
    });
  }

  // Sort by urgency
  const urgencyOrder: Record<string, number> = { blocking_others: 0, today: 1, this_week: 2, informational: 3 };
  actionItems.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));

  const blockingItems = actionItems.filter(i => i.urgency === "blocking_others");

  // ── Expiring lots list (right column) ─────────────────────────────────────

  const expiringLots: ExpiringLotEntry[] = expiringLotsRaw.map(l => ({
    lotId: l.lotId,
    lotNumber: l.lotNumber,
    productName: l.productName,
    category: guessCategoryFromName(l.productName),
    weightLbs: parseFloat(l.totalWeight ?? "0"),
    expirationDate: l.expirationDate,
    hoursRemaining: hoursUntil(l.expirationDate),
  }));

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats: InboxStats = {
    billsToReview: draftBills.length,
    receivingNow: 0,
    expectedToday: ordersDueToday.length,
    creditsOpenAmount: 0,
    creditsOpenCount: 0,
    creditsOverdue: 0,
    weekSpend,
    weekSpendDeltaPct,
    priceAlerts: spikes.length,
  };

  // ── Active sessions (placeholder — would come from real-time state) ────────

  const activeSessions: ActiveSession[] = [];

  // ── billCount + dayCount ───────────────────────────────────────────────────
  const [tenantRow, oldestInvoiceRow] = await Promise.all([
    db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { billCount: true },
    }),
    db.query.supplierInvoices.findFirst({
      where: and(
        eq(supplierInvoices.tenantId, tenantId),
        sql`${supplierInvoices.status} != 'draft'`,
      ),
      columns: { invoiceDate: true },
      orderBy: [asc(supplierInvoices.invoiceDate)],
    }),
  ]);

  const dayCount = oldestInvoiceRow?.invoiceDate
    ? Math.floor(
        (now.getTime() - new Date(oldestInvoiceRow.invoiceDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // ── Plaid: cash flow + re-auth banners ────────────────────────────────────
  const connections = await db.query.plaidConnections.findMany({
    where: and(eq(plaidConnections.tenantId, tenantId)),
    with: { bankAccounts: true },
  });

  const activeConns = connections.filter(c => c.status !== "disconnected");
  const reauthBanners: ReauthBanner[] = connections
    .filter(c => c.status === "requires_reauth")
    .map(c => ({
      connectionId: c.id,
      institutionName: c.institutionName,
      lastSyncAt: c.lastSyncAt ? new Date(c.lastSyncAt) : null,
    }));

  let cashFlow: CashFlowSummary | null = null;

  if (activeConns.length > 0) {
    const allAccountIds = activeConns.flatMap(c => c.bankAccounts.map(a => a.id));
    const totalBalance = activeConns
      .flatMap(c => c.bankAccounts)
      .reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff7d = sevenDaysAgo.toISOString().split("T")[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const future7d = futureDate.toISOString().split("T")[0];

    // Last 7 days outflows (amount > 0 in Plaid = money out)
    const [outRow] = await db
      .select({ total: sql<string>`coalesce(sum(${bankTransactions.amount}), 0)` })
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.tenantId, tenantId),
        gte(bankTransactions.date, cutoff7d),
        sql`${bankTransactions.amount} > 0`,
        eq(bankTransactions.pending, false),
      ));

    // Last 7 days inflows (amount < 0 in Plaid = money in)
    const [inRow] = await db
      .select({ total: sql<string>`coalesce(sum(abs(${bankTransactions.amount})), 0)` })
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.tenantId, tenantId),
        gte(bankTransactions.date, cutoff7d),
        sql`${bankTransactions.amount} < 0`,
        eq(bankTransactions.pending, false),
      ));

    // Next 7 days scheduled = bills due in window
    const [scheduledRow] = await db
      .select({ total: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}), 0)` })
      .from(supplierInvoices)
      .where(and(
        eq(supplierInvoices.tenantId, tenantId),
        sql`${supplierInvoices.status} in ('posted', 'reconciled', 'completed')`,
        gte(supplierInvoices.invoiceDate, now.toISOString().split("T")[0]),
        lte(supplierInvoices.invoiceDate, future7d),
      ));

    // 7-day balance change from snapshots
    const [snapshotRow] = await db
      .select({ total: sql<string>`coalesce(sum(${bankAccountBalanceSnapshots.balance}), 0)` })
      .from(bankAccountBalanceSnapshots)
      .where(and(
        eq(bankAccountBalanceSnapshots.tenantId, tenantId),
        eq(bankAccountBalanceSnapshots.snapshotDate, cutoff7d),
      ));
    const balance7dAgo = parseFloat(snapshotRow?.total ?? "0");
    const balanceChange7d = balance7dAgo > 0 ? totalBalance - balance7dAgo : 0;

    cashFlow = {
      totalBalance,
      balanceChange7d,
      last7dOut: parseFloat(outRow?.total ?? "0"),
      last7dIn: parseFloat(inRow?.total ?? "0"),
      next7dScheduled: parseFloat(scheduledRow?.total ?? "0"),
    };
  }

  // ── Mystery outflows (flagged unmatched outflows above threshold) ──────────
  let mysteryOutflows: MysteryOutflow[] = [];

  if (activeConns.length > 0) {
    const last30d = new Date();
    last30d.setDate(last30d.getDate() - 30);
    const cutoff30d = last30d.toISOString().split("T")[0];

    const rawMysteries = await db.query.bankTransactions.findMany({
      where: and(
        eq(bankTransactions.tenantId, tenantId),
        eq(bankTransactions.isMysteryOutflow, true),
        isNull(bankTransactions.mysteryDismissedAt),
        eq(bankTransactions.pending, false),
        gte(bankTransactions.date, cutoff30d),
      ),
      with: {
        bankAccount: { with: { plaidConnection: true } },
      },
      orderBy: (t, { desc }) => [desc(t.amount)],
      limit: 5,
    });

    mysteryOutflows = rawMysteries.map(t => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      merchantName: t.merchantName,
      rawDescription: t.rawDescription,
      paymentMethod: t.paymentMethod ?? "other",
      accountName: t.bankAccount?.name ?? "Bank account",
      accountMask: t.bankAccount?.mask ?? null,
      institutionName: t.bankAccount?.plaidConnection?.institutionName ?? null,
    }));
  }

  return {
    stats,
    blockingItems,
    actionItems: actionItems.filter(i => i.urgency !== "blocking_others"),
    informationalItems,
    activeSessions,
    expiringLots,
    priceMovers: topMovers,
    billCount: tenantRow?.billCount ?? 0,
    dayCount,
    cashFlow,
    reauthBanners,
    todaySchedule,
    mysteryOutflows,
  };
}

// ── Inbox bell summary ─────────────────────────────────────────────────────
// Used by the bell popover next to the user card. Slim digest of the same
// inbox dataset, capped at 5 items, with a derived count for the unread dot.

export type InboxBellItem = {
  id: string;
  title: string;
  meta: string;
  href: string;
  createdAt: Date;
  /**
   * Urgency from the underlying inbox item — drives the small accent dot in the
   * popover row. `blocking_others` and `today` are surfaced visibly.
   */
  urgency: InboxItem["urgency"];
};

export type InboxBellSummary = {
  /** Items the user hasn't acted on. Drives the green dot on the bell. */
  unreadCount: number;
  /** Top 5 most-recent blocking + action items. */
  items: InboxBellItem[];
};

// Slim path: just the two cheap, time-sensitive sources (drafts + urgent lots).
// Price spikes are excluded because the only way to detect one is the same
// 200-row line scan + per-product math the full inbox does, which we want to
// avoid on every header render. They still surface on /inbox.
export async function getInboxBellSummary(): Promise<InboxBellSummary> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;
  const now = new Date();
  const in2Days = daysFromNow(2);

  const [draftBills, urgentLots] = await Promise.all([
    db
      .select({
        id: supplierInvoices.id,
        invoiceNumber: supplierInvoices.referenceNumber,
        totalAmount: supplierInvoices.totalAmount,
        createdAt: supplierInvoices.createdAt,
        supplierName: suppliers.name,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .where(and(
        eq(supplierInvoices.tenantId, tenantId),
        eq(supplierInvoices.status, "draft"),
      ))
      .orderBy(desc(supplierInvoices.createdAt))
      .limit(10),
    db
      .select({
        lotId: lots.id,
        lotNumber: lots.lotNumber,
        expirationDate: lots.expirationDate,
        productName: products.name,
      })
      .from(lots)
      .innerJoin(inventoryItems, and(
        eq(inventoryItems.lotId, lots.id),
        eq(inventoryItems.status, "in_stock"),
      ))
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .where(and(
        eq(lots.tenantId, tenantId),
        lte(lots.expirationDate, in2Days.toISOString().split("T")[0]),
        gte(lots.expirationDate, now.toISOString().split("T")[0]),
      ))
      .groupBy(lots.id, lots.lotNumber, lots.expirationDate, products.name)
      .orderBy(lots.expirationDate)
      .limit(5),
  ]);

  // Urgent lots lead — they're the most time-bound source. Then newest drafts
  // fill the rest of the 5-slot list.
  const lotItems: InboxBellItem[] = urgentLots.map(lot => {
    const hours = hoursUntil(lot.expirationDate);
    return {
      id: `expiring_lot_${lot.lotId}`,
      title: `${lot.productName} lot expires ${hours < 24 ? "today" : "tomorrow"}`,
      meta: `Lot ${lot.lotNumber} · ${hours}h left`,
      href: `/inventory/lots/${lot.lotId}`,
      createdAt: now,
      urgency: hours < 24 ? "blocking_others" : "today",
    };
  });

  const draftItems: InboxBellItem[] = draftBills.map(bill => ({
    id: `new_bill_${bill.id}`,
    title: `New bill from ${bill.supplierName ?? "supplier"}`,
    meta: `${bill.invoiceNumber} · $${parseFloat(bill.totalAmount).toFixed(2)}`,
    href: `/supplier-invoices/${bill.id}`,
    createdAt: new Date(bill.createdAt),
    urgency: "today",
  }));

  const items = [...lotItems, ...draftItems].slice(0, 5);
  return {
    unreadCount: draftBills.length + urgentLots.length,
    items,
  };
}
