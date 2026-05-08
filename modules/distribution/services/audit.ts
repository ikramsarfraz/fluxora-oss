import { and, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  supplierInvoices,
  salesOrderLineAllocations,
  salesOrderFulfillments,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";

import { getCurrentTenant } from "@/services/tenants";

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
  sales_order_fulfillments: "allocation",
  sales_invoices: "invoice",
  sales_invoice_lines: "invoice",
  sales_invoice_files: "file",
  payments: "payment",
  inventory_items: "other",
  inventory_adjustments: "other",
  supplier_invoices: "invoice",
  supplier_invoice_payments: "payment",
  supplier_invoice_attachments: "file",
};

function entityToScope(entityTable: string): ActivityScope {
  return ENTITY_SCOPE[entityTable] ?? "other";
}

function summarizeAudit(row: {
  action: string;
  entityTable: string;
  entityLabel: string | null;
  changedFieldsJson: string | null;
  contextJson?: string | null;
}): string {
  const label =
    row.entityLabel ?? prettyEntity(row.entityTable);
  const context = safeParseObject(row.contextJson);
  const contextAction = getContextString(context, "action");
  const contextReason = getContextString(context, "reason");
  const contextAmount = getContextString(context, "amount");
  const contextMethod = getContextString(context, "paymentMethod");
  const contextReference = getContextString(context, "reference");

  if (row.entityTable === "supplier_invoices") {
    if (contextAction === "complete_receipt") {
      return `Completed and received ${label}`;
    }
    if (contextAction === "reverse_receipt") {
      return contextReason
        ? `Reversed receipt for ${label}: ${contextReason}`
        : `Reversed receipt for ${label}`;
    }
  }

  if (row.entityTable === "supplier_invoice_payments" && row.action === "insert") {
    const amount = contextAmount ? ` ${contextAmount}` : "";
    const method = contextMethod ? ` via ${contextMethod}` : "";
    const reference = contextReference ? ` · Ref ${contextReference}` : "";
    return `Recorded payment${amount}${method}${reference}`;
  }

  if (row.entityTable === "supplier_invoice_attachments") {
    if (row.action === "file_uploaded") {
      return `Uploaded attachment ${label}`;
    }
    if (row.action === "file_deleted") {
      return `Removed attachment ${label}`;
    }
  }

  if (row.entityTable === "inventory_items" && row.action === "update") {
    if (contextAction === "inventory_adjustment") {
      return contextReason
        ? `Inventory adjusted for ${label}: ${contextReason.replace(/_/g, " ")}`
        : `Inventory adjusted for ${label}`;
    }
    if (contextAction === "lot_bulk_adjustment") {
      return contextReason
        ? `Lot action updated ${label}: ${contextReason.replace(/_/g, " ")}`
        : `Lot action updated ${label}`;
    }
  }

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
    case "sales_order_fulfillments":
      return "fulfillment";
    case "sales_invoices":
      return "invoice";
    case "sales_invoice_lines":
      return "invoice line";
    case "sales_invoice_files":
      return "invoice file";
    case "payments":
      return "payment";
    case "inventory_items":
      return "inventory item";
    case "inventory_adjustments":
      return "inventory adjustment";
    case "supplier_invoices":
      return "supplier invoice";
    case "supplier_invoice_payments":
      return "supplier invoice payment";
    case "supplier_invoice_attachments":
      return "supplier invoice attachment";
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

function safeParseObject(input: string | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getContextString(
  context: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = context?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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
          shortShippedAt: true,
          shortShipNotes: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          product: { columns: { sku: true, name: true } },
          shortShippedBy: {
            columns: { id: true, fullName: true, email: true },
          },
          fulfillments: {
            columns: {
              id: true,
              quantityFulfilled: true,
              weightLbs: true,
              fulfilledAt: true,
              notes: true,
              reversedAt: true,
              reversalReason: true,
            },
            with: {
              fulfilledBy: {
                columns: { id: true, fullName: true, email: true },
              },
              reversedBy: {
                columns: { id: true, fullName: true, email: true },
              },
              inventoryItem: {
                columns: { barcodeId: true },
              },
              lot: {
                columns: { lotNumber: true },
              },
            },
          },
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
  const fulfillmentIds =
    lineIds.length === 0
      ? []
      : (
          await db.query.salesOrderFulfillments.findMany({
            where: inArray(salesOrderFulfillments.salesOrderLineId, lineIds),
            columns: { id: true },
          })
        ).map(fulfillment => fulfillment.id);
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
  if (fulfillmentIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "sales_order_fulfillments"),
        inArray(auditLogs.entityId, fulfillmentIds),
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

    for (const fulfillment of line.fulfillments ?? []) {
      const parts = [`${fulfillment.quantityFulfilled} qty`];
      if (fulfillment.weightLbs) {
        parts.push(`${Number(fulfillment.weightLbs).toFixed(2)} lbs`);
      }
      if (fulfillment.inventoryItem?.barcodeId) {
        parts.push(fulfillment.inventoryItem.barcodeId);
      } else if (fulfillment.lot?.lotNumber) {
        parts.push(`Lot ${fulfillment.lot.lotNumber}`);
      }

      derivedItems.push({
        id: `derived:fulfillment:${fulfillment.id}`,
        source: "derived",
        scope: "allocation",
        action: "insert",
        summary: `Fulfilled ${productLabel}: ${parts.join(" · ")}`,
        at: fulfillment.fulfilledAt.toISOString(),
        actor: {
          id: fulfillment.fulfilledBy?.id ?? null,
          name: fulfillment.fulfilledBy?.fullName ?? null,
          email: fulfillment.fulfilledBy?.email ?? null,
          type: fulfillment.fulfilledBy ? "portal_user" : "system",
        },
        entityTable: "sales_order_fulfillments",
        entityId: fulfillment.id,
        entityLabel: productLabel,
        changedFields: fulfillment.notes ? ["notes"] : null,
      });

      if (fulfillment.reversedAt) {
        derivedItems.push({
          id: `derived:fulfillment-reversed:${fulfillment.id}`,
          source: "derived",
          scope: "allocation",
          action: "update",
          summary: `Reversed fulfillment for ${productLabel}${fulfillment.reversalReason ? ` · ${fulfillment.reversalReason}` : ""}`,
          at: fulfillment.reversedAt.toISOString(),
          actor: {
            id: fulfillment.reversedBy?.id ?? null,
            name: fulfillment.reversedBy?.fullName ?? null,
            email: fulfillment.reversedBy?.email ?? null,
            type: fulfillment.reversedBy ? "portal_user" : "system",
          },
          entityTable: "sales_order_fulfillments",
          entityId: fulfillment.id,
          entityLabel: productLabel,
          changedFields: fulfillment.reversalReason ? ["reversalReason"] : null,
        });
      }
    }

    if (line.shortShippedAt) {
      const shortQuantity = Math.max(
        0,
        line.expectedCases - line.fulfilledCases,
      );
      derivedItems.push({
        id: `derived:line-short-ship:${line.id}`,
        source: "derived",
        scope: "line",
        action: "update",
        summary: `${productLabel}: short shipped ${shortQuantity} case${shortQuantity === 1 ? "" : "s"}`,
        at: line.shortShippedAt.toISOString(),
        actor: {
          id: line.shortShippedBy?.id ?? null,
          name: line.shortShippedBy?.fullName ?? null,
          email: line.shortShippedBy?.email ?? null,
          type: line.shortShippedBy ? "portal_user" : "system",
        },
        entityTable: "sales_order_lines",
        entityId: line.id,
        entityLabel: productLabel,
        changedFields: line.shortShipNotes ? ["shortShipNotes"] : null,
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

export async function getActivityForSupplierInvoice(
  supplierInvoiceId: string,
): Promise<ActivityTimelineItem[]> {
  const tenant = await getCurrentTenant();

  const invoice = await db.query.supplierInvoices.findFirst({
    where: and(
      eq(supplierInvoices.id, supplierInvoiceId),
      eq(supplierInvoices.tenantId, tenant.id),
    ),
    with: {
      supplier: { columns: { name: true } },
      createdBy: { columns: { id: true, fullName: true, email: true } },
      updatedBy: { columns: { id: true, fullName: true, email: true } },
      completedBy: { columns: { id: true, fullName: true, email: true } },
      attachments: {
        columns: {
          supplierInvoiceId: true,
          fileId: true,
          createdAt: true,
        },
        with: {
          file: {
            columns: {
              id: true,
              originalFilename: true,
              createdAt: true,
            },
            with: {
              uploadedByUser: {
                columns: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      },
      payments: {
        columns: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentDate: true,
          reference: true,
          createdAt: true,
        },
        with: {
          createdBy: {
            columns: { id: true, fullName: true, email: true },
          },
        },
      },
    },
  });

  if (!invoice) return [];

  const paymentIds = (invoice.payments ?? []).map(payment => payment.id);
  const attachmentIds = (invoice.attachments ?? []).map(
    attachment => attachment.fileId,
  );

  const entityFilters = [
    and(
      eq(auditLogs.entityTable, "supplier_invoices"),
      eq(auditLogs.entityId, supplierInvoiceId),
    ),
  ];

  if (paymentIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "supplier_invoice_payments"),
        inArray(auditLogs.entityId, paymentIds),
      ),
    );
  }

  if (attachmentIds.length > 0) {
    entityFilters.push(
      and(
        eq(auditLogs.entityTable, "supplier_invoice_attachments"),
        inArray(auditLogs.entityId, attachmentIds),
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

  const hasAuditEvent = (matcher: (row: typeof auditRows[number]) => boolean) =>
    auditRows.some(matcher);
  const hasSupplierInvoiceAudit = (
    action: string,
    contextAction?: string,
  ) =>
    hasAuditEvent(row => {
      const context = safeParseObject(row.contextJson);
      return (
        row.entityTable === "supplier_invoices" &&
        row.entityId === invoice.id &&
        row.action === action &&
        (contextAction === undefined ||
          getContextString(context, "action") === contextAction)
      );
    });

  const derivedItems: ActivityTimelineItem[] = [];

  if (!hasSupplierInvoiceAudit("insert")) {
    derivedItems.push({
      id: `derived:supplier-invoice-created:${invoice.id}`,
      source: "derived",
      scope: "invoice",
      action: "insert",
      summary: `Supplier invoice ${invoice.invoiceNumber} created`,
      at: invoice.createdAt.toISOString(),
      actor: {
        id: invoice.createdBy?.id ?? null,
        name: invoice.createdBy?.fullName ?? null,
        email: invoice.createdBy?.email ?? null,
        type: invoice.createdBy ? "portal_user" : "system",
      },
      entityTable: "supplier_invoices",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      changedFields: null,
    });
  }

  if (
    invoice.updatedAt &&
    invoice.updatedAt.getTime() - invoice.createdAt.getTime() > 1000 &&
    !hasAuditEvent(row => {
      const context = safeParseObject(row.contextJson);
      return (
        row.entityTable === "supplier_invoices" &&
        row.entityId === invoice.id &&
        row.action === "update" &&
        !getContextString(context, "action")
      );
    })
  ) {
    derivedItems.push({
      id: `derived:supplier-invoice-updated:${invoice.id}`,
      source: "derived",
      scope: "invoice",
      action: "update",
      summary: `Supplier invoice ${invoice.invoiceNumber} updated`,
      at: invoice.updatedAt.toISOString(),
      actor: {
        id: invoice.updatedBy?.id ?? null,
        name: invoice.updatedBy?.fullName ?? null,
        email: invoice.updatedBy?.email ?? null,
        type: invoice.updatedBy ? "portal_user" : "system",
      },
      entityTable: "supplier_invoices",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      changedFields: null,
    });
  }

  if (
    invoice.completedAt &&
    !hasSupplierInvoiceAudit("update", "complete_receipt")
  ) {
    derivedItems.push({
      id: `derived:supplier-invoice-completed:${invoice.id}`,
      source: "derived",
      scope: "invoice",
      action: "update",
      summary: `Supplier invoice ${invoice.invoiceNumber} completed and received`,
      at: invoice.completedAt.toISOString(),
      actor: {
        id: invoice.completedBy?.id ?? null,
        name: invoice.completedBy?.fullName ?? null,
        email: invoice.completedBy?.email ?? null,
        type: invoice.completedBy ? "portal_user" : "system",
      },
      entityTable: "supplier_invoices",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      changedFields: ["status"],
    });
  }

  for (const payment of invoice.payments ?? []) {
    if (
      hasAuditEvent(
        row =>
          row.entityTable === "supplier_invoice_payments" &&
          row.entityId === payment.id &&
          row.action === "insert",
      )
    ) {
      continue;
    }
    derivedItems.push({
      id: `derived:supplier-invoice-payment:${payment.id}`,
      source: "derived",
      scope: "payment",
      action: "insert",
      summary: `Payment recorded: ${Number(payment.amount).toFixed(2)} via ${payment.paymentMethod.replace(/_/g, " ")}${payment.reference ? ` · Ref ${payment.reference}` : ""}`,
      at: payment.createdAt.toISOString(),
      actor: {
        id: payment.createdBy?.id ?? null,
        name: payment.createdBy?.fullName ?? null,
        email: payment.createdBy?.email ?? null,
        type: payment.createdBy ? "portal_user" : "system",
      },
      entityTable: "supplier_invoice_payments",
      entityId: payment.id,
      entityLabel: invoice.invoiceNumber,
      changedFields: null,
    });
  }

  for (const attachment of invoice.attachments ?? []) {
    if (
      hasAuditEvent(
        row =>
          row.entityTable === "supplier_invoice_attachments" &&
          row.entityId === attachment.fileId &&
          row.action === "file_uploaded",
      )
    ) {
      continue;
    }
    derivedItems.push({
      id: `derived:supplier-invoice-attachment:${attachment.fileId}`,
      source: "derived",
      scope: "file",
      action: "file_uploaded",
      summary: `Attachment uploaded: ${attachment.file.originalFilename ?? "file"}`,
      at: attachment.createdAt.toISOString(),
      actor: {
        id: attachment.file.uploadedByUser?.id ?? null,
        name: attachment.file.uploadedByUser?.fullName ?? null,
        email: attachment.file.uploadedByUser?.email ?? null,
        type: attachment.file.uploadedByUser ? "portal_user" : "system",
      },
      entityTable: "supplier_invoice_attachments",
      entityId: attachment.fileId,
      entityLabel: attachment.file.originalFilename,
      changedFields: null,
    });
  }

  const all = [...auditItems, ...derivedItems];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return all;
}
