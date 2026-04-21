import { and, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";

import { getCurrentTenant } from "./tenants";

export type ActivityScope =
  | "order"
  | "line"
  | "allocation"
  | "invoice"
  | "payment"
  | "file"
  | "other";

export type ActivitySource = "audit" | "derived";

export interface ActivityTimelineItem {
  id: string;
  source: ActivitySource;
  scope: ActivityScope;
  action: string;
  summary: string;
  at: string;
  actor: {
    id: string | null;
    name: string | null;
    email: string | null;
    type: "portal_user" | "platform_user" | "system" | null;
  };
  entityTable: string;
  entityId: string;
  entityLabel: string | null;
  changedFields: string[] | null;
}

const ENTITY_SCOPE: Record<string, ActivityScope> = {
  sales_orders: "order",
  sales_order_lines: "line",
  sales_order_line_allocations: "allocation",
  sales_invoices: "invoice",
  sales_invoice_lines: "invoice",
  sales_invoice_files: "file",
  payments: "payment",
};

function entityToScope(entityTable: string): ActivityScope {
  return ENTITY_SCOPE[entityTable] ?? "other";
}

function summarizeAudit(row: {
  action: string;
  entityTable: string;
  entityLabel: string | null;
  changedFieldsJson: string | null;
}): string {
  const label =
    row.entityLabel ?? prettyEntity(row.entityTable);
  switch (row.action) {
    case "insert":
      return `Created ${label}`;
    case "update": {
      const fields = safeParseStringArray(row.changedFieldsJson);
      if (fields && fields.length > 0) {
        return `Updated ${label}: ${fields.join(", ")}`;
      }
      return `Updated ${label}`;
    }
    case "delete":
      return `Deleted ${label}`;
    case "soft_delete":
      return `Archived ${label}`;
    case "restore":
      return `Restored ${label}`;
    case "invite_sent":
      return `Invite sent for ${label}`;
    case "invite_accepted":
      return `Invite accepted for ${label}`;
    case "file_uploaded":
      return `Uploaded file to ${label}`;
    case "file_deleted":
      return `Removed file from ${label}`;
    default:
      return `${row.action} on ${label}`;
  }
}

function prettyEntity(table: string): string {
  switch (table) {
    case "sales_orders":
      return "order";
    case "sales_order_lines":
      return "line item";
    case "sales_order_line_allocations":
      return "allocation";
    case "sales_invoices":
      return "invoice";
    case "sales_invoice_lines":
      return "invoice line";
    case "sales_invoice_files":
      return "invoice file";
    case "payments":
      return "payment";
    default:
      return table.replace(/_/g, " ");
  }
}

function safeParseStringArray(input: string | null): string[] | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return null;
  } catch {
    return null;
  }
}

export async function getActivityForSalesOrder(
  orderId: string,
): Promise<ActivityTimelineItem[]> {
  const tenant = await getCurrentTenant();

  const order = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.id, orderId), eq(salesOrders.tenantId, tenant.id)),
    with: {
      createdBy: { columns: { id: true, fullName: true, email: true } },
      updatedBy: { columns: { id: true, fullName: true, email: true } },
      lines: {
        columns: {
          id: true,
          expectedCases: true,
          fulfilledCases: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          product: { columns: { sku: true, name: true } },
          allocations: {
            columns: {
              id: true,
              allocatedWeightLbs: true,
              createdAt: true,
            },
            with: {
              inventoryItem: { columns: { barcodeId: true } },
            },
          },
        },
      },
      invoices: {
        columns: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          createdAt: true,
        },
        with: {
          payments: {
            columns: {
              id: true,
              amount: true,
              paymentMethod: true,
              paymentDate: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!order) return [];

  const lineIds = (order.lines ?? []).map(l => l.id);
  const allocationIds =
    lineIds.length === 0
      ? []
      : (
          await db.query.salesOrderLineAllocations.findMany({
            where: inArray(salesOrderLineAllocations.salesOrderLineId, lineIds),
            columns: { id: true },
          })
        ).map(a => a.id);
  const invoiceIds = (order.invoices ?? []).map(i => i.id);
  const paymentIds = (order.invoices ?? []).flatMap(i =>
    (i.payments ?? []).map(p => p.id),
  );

  const entityFilters = [
    and(
      eq(auditLogs.entityTable, "sales_orders"),
      eq(auditLogs.entityId, orderId),
    ),
  ];
  if (lineIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "sales_order_lines"),
        inArray(auditLogs.entityId, lineIds),
      ),
    );
  }
  if (allocationIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "sales_order_line_allocations"),
        inArray(auditLogs.entityId, allocationIds),
      ),
    );
  }
  if (invoiceIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "sales_invoices"),
        inArray(auditLogs.entityId, invoiceIds),
      ),
      and(
        eq(auditLogs.entityTable, "sales_invoice_files"),
        inArray(auditLogs.entityId, invoiceIds),
      ),
    );
  }
  if (paymentIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "payments"),
        inArray(auditLogs.entityId, paymentIds),
      ),
    );
  }

  const auditRows = await db.query.auditLogs.findMany({
    where: and(eq(auditLogs.tenantId, tenant.id), or(...entityFilters)),
    with: {
      actorPortalUser: {
        columns: { id: true, fullName: true, email: true },
      },
    },
    orderBy: [desc(auditLogs.createdAt)],
    limit: 200,
  });

  const auditItems: ActivityTimelineItem[] = auditRows.map(row => ({
    id: row.id,
    source: "audit",
    scope: entityToScope(row.entityTable),
    action: row.action,
    summary: summarizeAudit(row),
    at: row.createdAt.toISOString(),
    actor: {
      id: row.actorPortalUserId ?? row.actorPlatformUserId ?? null,
      name: row.actorPortalUser?.fullName ?? null,
      email: row.actorPortalUser?.email ?? null,
      type: row.actorType,
    },
    entityTable: row.entityTable,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    changedFields: safeParseStringArray(row.changedFieldsJson),
  }));

  // Guaranteed baseline events derived from entities, so the timeline is
  // useful even before (or alongside) audit_logs writes.
  const derivedItems: ActivityTimelineItem[] = [];

  derivedItems.push({
    id: `derived:order-created:${order.id}`,
    source: "derived",
    scope: "order",
    action: "insert",
    summary: "Order created",
    at: order.createdAt.toISOString(),
    actor: {
      id: order.createdBy?.id ?? null,
      name: order.createdBy?.fullName ?? null,
      email: order.createdBy?.email ?? null,
      type: order.createdBy ? "portal_user" : "system",
    },
    entityTable: "sales_orders",
    entityId: order.id,
    entityLabel: order.orderNumber,
    changedFields: null,
  });

  if (
    order.updatedAt &&
    order.updatedAt.getTime() - order.createdAt.getTime() > 1000
  ) {
    derivedItems.push({
      id: `derived:order-updated:${order.id}`,
      source: "derived",
      scope: "order",
      action: "update",
      summary: "Order updated",
      at: order.updatedAt.toISOString(),
      actor: {
        id: order.updatedBy?.id ?? null,
        name: order.updatedBy?.fullName ?? null,
        email: order.updatedBy?.email ?? null,
        type: order.updatedBy ? "portal_user" : "system",
      },
      entityTable: "sales_orders",
      entityId: order.id,
      entityLabel: order.orderNumber,
      changedFields: null,
    });
  }

  for (const line of order.lines ?? []) {
    const productLabel = line.product
      ? `${line.product.sku} · ${line.product.name}`
      : "Line item";

    for (const alloc of line.allocations ?? []) {
      derivedItems.push({
        id: `derived:alloc:${alloc.id}`,
        source: "derived",
        scope: "allocation",
        action: "insert",
        summary: `Allocated ${Number(alloc.allocatedWeightLbs).toFixed(2)} lbs from ${alloc.inventoryItem?.barcodeId ?? "box"} to ${productLabel}`,
        at: alloc.createdAt.toISOString(),
        actor: { id: null, name: null, email: null, type: "system" },
        entityTable: "sales_order_line_allocations",
        entityId: alloc.id,
        entityLabel: null,
        changedFields: null,
      });
    }

    if (
      line.fulfilledCases > 0 &&
      line.updatedAt &&
      line.updatedAt.getTime() - line.createdAt.getTime() > 1000
    ) {
      derivedItems.push({
        id: `derived:line-fulfilled:${line.id}`,
        source: "derived",
        scope: "line",
        action: "update",
        summary: `${productLabel}: ${line.fulfilledCases} / ${line.expectedCases} cases fulfilled`,
        at: line.updatedAt.toISOString(),
        actor: { id: null, name: null, email: null, type: "system" },
        entityTable: "sales_order_lines",
        entityId: line.id,
        entityLabel: productLabel,
        changedFields: ["fulfilledCases"],
      });
    }
  }

  for (const inv of order.invoices ?? []) {
    derivedItems.push({
      id: `derived:invoice-created:${inv.id}`,
      source: "derived",
      scope: "invoice",
      action: "insert",
      summary: `Invoice ${inv.invoiceNumber} generated (${Number(inv.totalAmount).toFixed(2)})`,
      at: inv.createdAt.toISOString(),
      actor: { id: null, name: null, email: null, type: "system" },
      entityTable: "sales_invoices",
      entityId: inv.id,
      entityLabel: inv.invoiceNumber,
      changedFields: null,
    });
    for (const p of inv.payments ?? []) {
      derivedItems.push({
        id: `derived:payment:${p.id}`,
        source: "derived",
        scope: "payment",
        action: "insert",
        summary: `Payment received: ${Number(p.amount).toFixed(2)} via ${p.paymentMethod.replace(/_/g, " ")}`,
        at: p.createdAt.toISOString(),
        actor: { id: null, name: null, email: null, type: "system" },
        entityTable: "payments",
        entityId: p.id,
        entityLabel: inv.invoiceNumber,
        changedFields: null,
      });
    }
  }

  const all = [...auditItems, ...derivedItems];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return all;
}
