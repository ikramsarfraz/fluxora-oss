import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  expenses,
  inventoryAdjustments,
  inventoryItems,
  lots,
  products,
  supplierInvoiceLines,
  suppliers,
  unitsOfMeasure,
} from "@/db/schema";
import type { PortalUserRole } from "@/modules/shared/services/portal-users";

import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  type InventoryLifecycleState,
  getInventoryStatusLabel,
} from "../utils/insights";
import {
  INVENTORY_ADJUSTMENT_REASON_OPTIONS,
  type InventoryAdjustmentReason,
} from "../utils/adjustments";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";
import { serializeCsv } from "@/lib/csv/serialize";

function canAdjustInventory(role: PortalUserRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "warehouse";
}

function requireInventoryAdjustmentPermission(
  role: PortalUserRole | null | undefined,
) {
  if (!canAdjustInventory(role)) {
    throw new Error(
      "Forbidden: Your role does not allow adjusting inventory or applying lot actions.",
    );
  }
}

function isLockedInventoryStatus(status: InventoryLifecycleState) {
  return status === "shipped" || status === "sold";
}

function isOpenWarehouseStatus(status: InventoryLifecycleState) {
  return (
    status === "in_stock" ||
    status === "allocated" ||
    status === "picked" ||
    status === "packed"
  );
}

function roundInventoryWeight(value: number) {
  return value.toFixed(4);
}

function normalizeAdjustmentReason(value: string): InventoryAdjustmentReason {
  if (
    INVENTORY_ADJUSTMENT_REASON_OPTIONS.some(option => option.value === value)
  ) {
    return value as InventoryAdjustmentReason;
  }
  throw new Error("Invalid adjustment reason.");
}

function ensureSafeInventoryAdjustment(args: {
  status: InventoryLifecycleState;
  hasAllocations: boolean;
  hasActiveFulfillments: boolean;
}) {
  if (isLockedInventoryStatus(args.status)) {
    throw new Error(
      `Inventory in status "${getInventoryStatusLabel(args.status)}" is locked and cannot be adjusted.`,
    );
  }

  if (args.hasAllocations) {
    throw new Error(
      "Inventory with active sales-order allocations cannot be adjusted from this screen.",
    );
  }

  if (args.hasActiveFulfillments) {
    throw new Error(
      "Inventory with active fulfillment history cannot be adjusted from this screen.",
    );
  }
}

function getAdjustmentChangedFields(args: {
  statusBefore: InventoryLifecycleState;
  statusAfter: InventoryLifecycleState;
  casesBefore: number;
  casesAfter: number;
  weightBefore: string;
  weightAfter: string;
}) {
  const fields: string[] = [];
  if (args.statusBefore !== args.statusAfter) fields.push("status");
  if (args.casesBefore !== args.casesAfter) fields.push("cases");
  if (args.weightBefore !== args.weightAfter) fields.push("exactWeightLbs");
  return fields;
}

async function getTenantLotIds(tenantId: string) {
  const tenantLots = await db.query.lots.findMany({
    where: eq(lots.tenantId, tenantId),
    columns: { id: true },
  });

  return tenantLots.map(lot => lot.id);
}

export async function getInventoryItems() {
  const tenant = await getCurrentTenant();
  const lotIds = await getTenantLotIds(tenant.id);

  if (lotIds.length === 0) {
    return [];
  }

  return await db.query.inventoryItems.findMany({
    where: inArray(inventoryItems.lotId, lotIds),
    with: {
      product: {
        columns: {
          id: true,
          sku: true,
          name: true,
        },
        // Eager-load the product's base UOM so the inventory grid can
        // render "/lb" vs "/ea" vs "/gal" per row without an extra
        // roundtrip. The `cost_unit_type_snapshot` column already tells
        // us catch-weight vs not — but the literal abbreviation is what
        // we need to display.
        with: {
          baseUnit: {
            columns: { id: true, abbreviation: true, family: true },
          },
        },
      },
      lot: {
        columns: {
          id: true,
          lotNumber: true,
          receiveDate: true,
          expirationDate: true,
        },
        with: {
          supplier: {
            columns: {
              id: true,
              name: true,
            },
          },
          lotReceipts: {
            columns: {
              id: true,
              supplierInvoiceLineId: true,
            },
            with: {
              supplierInvoiceLine: {
                columns: {
                  id: true,
                },
                with: {
                  supplierInvoice: {
                    columns: {
                      id: true,
                      invoiceNumber: true,
                      invoiceDate: true,
                      receiveDate: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [desc(inventoryItems.updatedAt), desc(inventoryItems.createdAt)],
  });
}

export type InventoryListSort =
  | "barcode"
  | "product"
  | "lot"
  | "cases"
  | "weight"
  | "status"
  | "expiration"
  | "receive"
  | "supplier";

export type InventoryListFilters = {
  productId?: string;
  status?: InventoryLifecycleState | "all";
  supplierId?: string;
  // `lotId` is for programmatic deep-linking (uuid). `lotNumber` is the
  // human-typed filter that the UI exposes — partial, case-insensitive.
  lotId?: string;
  lotNumber?: string;
  expiration?: "all" | "fresh" | "expiring_soon" | "expired";
};

export type InventoryListParams = PaginatedQueryInput<
  InventoryListSort,
  InventoryListFilters
>;

function getInventoryExpirationFilterSql(
  expiration: InventoryListFilters["expiration"],
) {
  if (!expiration || expiration === "all") {
    return undefined;
  }

  if (expiration === "expired") {
    return sql`${lots.expirationDate} < current_date`;
  }

  if (expiration === "expiring_soon") {
    return sql`${lots.expirationDate} >= current_date and ${lots.expirationDate} <= current_date + interval '1 day'`;
  }

  return sql`${lots.expirationDate} > current_date + interval '1 day'`;
}

function buildInventoryWhere(args: {
  tenantId: string;
  search: string;
  filters: InventoryListFilters;
}) {
  return and(
    eq(lots.tenantId, args.tenantId),
    buildTextSearchCondition(args.search, [
      inventoryItems.barcodeId,
      inventoryItems.id,
      products.name,
      products.sku,
      lots.lotNumber,
      suppliers.name,
    ]),
    args.filters.productId && args.filters.productId !== "all"
      ? eq(inventoryItems.productId, args.filters.productId)
      : undefined,
    args.filters.status && args.filters.status !== "all"
      ? eq(inventoryItems.status, args.filters.status)
      : undefined,
    args.filters.lotId && args.filters.lotId !== "all"
      ? eq(inventoryItems.lotId, args.filters.lotId)
      : undefined,
    // Partial, case-insensitive lot-number search (warehouse staff don't
    // remember UUIDs). Trims to avoid surprises from trailing whitespace.
    args.filters.lotNumber && args.filters.lotNumber.trim().length > 0
      ? sql`${lots.lotNumber} ilike ${"%" + args.filters.lotNumber.trim() + "%"}`
      : undefined,
    args.filters.supplierId && args.filters.supplierId !== "all"
      ? eq(lots.supplierId, args.filters.supplierId)
      : undefined,
    getInventoryExpirationFilterSql(args.filters.expiration),
  );
}

export async function getInventoryItemsPage(input?: InventoryListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "expiration",
    defaultDirection: "asc",
    defaultFilters: {
      productId: "all",
      status: "all",
      supplierId: "all",
      lotId: "all",
      lotNumber: undefined,
      expiration: "all",
    },
  });
  const where = buildInventoryWhere({
    tenantId: tenant.id,
    search: query.search,
    filters: query.filters,
  });

  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${inventoryItems.id})::int` })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(where);

  const [summaryRow] = await db
    .select({
      totalItems: sql<number>`count(distinct ${inventoryItems.id})::int`,
      totalCases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
      // Sum weight only across weight-priced inventory rows. Mixed
      // catalogs would otherwise hide weight items inside an aggregate
      // that includes "0.00 lb" beverage rows — the count is correct
      // but the label would mislead. Per_each / per_unit rows feed the
      // separate totalUnits aggregate below.
      totalWeight: sql<string>`coalesce(sum(case when ${inventoryItems.costUnitTypeSnapshot} in ('catch_weight','fixed_case') or ${inventoryItems.costUnitTypeSnapshot} is null then ${inventoryItems.exactWeightLbs}::numeric else 0 end), 0)::text`,
      // Total base-units (eaches) across non-weight rows. Multiply
      // cases × pack size so 5 cases of a 24-pack contribute 120, not
      // 5. Pack size defaults to 1 when the snapshot is null (legacy
      // rows or per_each lines where one row = one base unit).
      totalUnits: sql<number>`coalesce(sum(case when ${inventoryItems.costUnitTypeSnapshot} in ('per_each','per_unit') then ${inventoryItems.cases}::numeric * coalesce(${inventoryItems.unitsPerPackageSnapshot}::numeric, 1) else 0 end), 0)::int`,
      expiringCount: sql<number>`coalesce(sum(case when ${lots.expirationDate} >= current_date and ${lots.expirationDate} <= current_date + interval '1 day' then 1 else 0 end), 0)::int`,
    })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(where);

  const itemIds = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          barcode: inventoryItems.barcodeId,
          product: products.name,
          lot: lots.lotNumber,
          cases: inventoryItems.cases,
          weight: inventoryItems.exactWeightLbs,
          status: inventoryItems.status,
          expiration: lots.expirationDate,
          receive: lots.receiveDate,
          supplier: suppliers.name,
        },
      }),
      desc(inventoryItems.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  const ids = itemIds.map(row => row.id);
  const rows =
    ids.length === 0
      ? []
      : await db.query.inventoryItems.findMany({
          where: inArray(inventoryItems.id, ids),
          with: {
            product: {
              columns: {
                id: true,
                sku: true,
                name: true,
              },
              // Same eager-load as the unpaginated path — needed by
              // formatInventoryQuantity to render mixed-UOM rows.
              with: {
                baseUnit: {
                  columns: { id: true, abbreviation: true, family: true },
                },
              },
            },
            lot: {
              columns: {
                id: true,
                lotNumber: true,
                receiveDate: true,
                expirationDate: true,
              },
              with: {
                supplier: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
                lotReceipts: {
                  columns: {
                    id: true,
                    supplierInvoiceLineId: true,
                  },
                  with: {
                    supplierInvoiceLine: {
                      columns: {
                        id: true,
                      },
                      with: {
                        supplierInvoice: {
                          columns: {
                            id: true,
                            invoiceNumber: true,
                            invoiceDate: true,
                            receiveDate: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

  const rowMap = new Map(rows.map(row => [row.id, row]));
  const productOptions = await db
    .selectDistinct({
      id: products.id,
      name: products.name,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .where(eq(lots.tenantId, tenant.id))
    .orderBy(products.name);
  const lotOptions = await db
    .selectDistinct({
      id: lots.id,
      lotNumber: lots.lotNumber,
    })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .where(eq(lots.tenantId, tenant.id))
    .orderBy(lots.lotNumber);
  // Only suppliers that currently have inventory — keeps the dropdown short
  // and prevents stale options for suppliers we no longer buy from.
  const supplierOptions = await db
    .selectDistinct({
      id: suppliers.id,
      name: suppliers.name,
    })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(eq(lots.tenantId, tenant.id))
    .orderBy(suppliers.name);

  return {
    ...createPaginatedResult({
      data: ids
        .map(id => rowMap.get(id))
        .filter((row): row is (typeof rows)[number] => Boolean(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    }),
    summary: {
      totalItems: summaryRow?.totalItems ?? 0,
      totalCases: summaryRow?.totalCases ?? 0,
      totalWeight: summaryRow?.totalWeight ?? "0",
      totalUnits: summaryRow?.totalUnits ?? 0,
      expiringCount: summaryRow?.expiringCount ?? 0,
    },
    filterOptions: {
      products: productOptions,
      lots: lotOptions,
      suppliers: supplierOptions,
    },
  };
}

/**
 * Export inventory rows matching the same search + filter shape as the list
 * page. Returns the file body and a stamped filename. The result is in-memory
 * (matches the pattern in customers / orders) — fine up to ~50k rows. If a
 * tenant outgrows that, switch to streaming or chunked pagination later.
 */
export async function exportInventoryCsv(input?: {
  search?: string;
  filters?: InventoryListFilters;
}): Promise<{ filename: string; csv: string }> {
  const tenant = await getCurrentTenant();
  const search = input?.search ?? "";
  const filters: InventoryListFilters = {
    productId: input?.filters?.productId ?? "all",
    status: input?.filters?.status ?? "all",
    supplierId: input?.filters?.supplierId ?? "all",
    lotId: input?.filters?.lotId ?? "all",
    lotNumber: input?.filters?.lotNumber,
    expiration: input?.filters?.expiration ?? "all",
  };
  const where = buildInventoryWhere({
    tenantId: tenant.id,
    search,
    filters,
  });

  const rows = await db
    .select({
      id: inventoryItems.id,
      barcodeId: inventoryItems.barcodeId,
      productName: products.name,
      productSku: products.sku,
      lotNumber: lots.lotNumber,
      cases: inventoryItems.cases,
      exactWeightLbs: inventoryItems.exactWeightLbs,
      unitsPerPackageSnapshot: inventoryItems.unitsPerPackageSnapshot,
      costPerUnitSnapshot: inventoryItems.costPerUnitSnapshot,
      costUnitTypeSnapshot: inventoryItems.costUnitTypeSnapshot,
      status: inventoryItems.status,
      expirationDate: lots.expirationDate,
      receiveDate: lots.receiveDate,
      supplierName: suppliers.name,
      // Pull the first linked supplier-invoice number per item. Most items
      // map 1:1 to a single receipt line; if a lot was split-received across
      // multiple invoices the first one is fine for an export snapshot.
      supplierInvoiceNumber: sql<string | null>`(
        select si.invoice_number
        from lot_receipts lr
        inner join supplier_invoice_lines sil on sil.id = lr.supplier_invoice_line_id
        inner join supplier_invoices si on si.id = sil.supplier_invoice_id
        where lr.lot_id = ${lots.id}
        order by si.invoice_date desc nulls last
        limit 1
      )`,
      createdAt: inventoryItems.createdAt,
    })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .leftJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(where)
    .orderBy(desc(inventoryItems.createdAt));

  const headers = [
    { key: "barcode_id", label: "barcode_id" },
    { key: "product_name", label: "product_name" },
    { key: "product_sku", label: "product_sku" },
    { key: "lot_number", label: "lot_number" },
    { key: "status", label: "status" },
    { key: "cases", label: "cases" },
    { key: "weight_lbs", label: "weight_lbs" },
    { key: "units_per_package", label: "units_per_package" },
    { key: "cost_unit_type", label: "cost_unit_type" },
    { key: "cost_per_unit", label: "cost_per_unit" },
    { key: "total_cost", label: "total_cost" },
    { key: "expiration_date", label: "expiration_date" },
    { key: "receive_date", label: "receive_date" },
    { key: "supplier", label: "supplier" },
    { key: "supplier_invoice_number", label: "supplier_invoice_number" },
    { key: "created_at", label: "created_at" },
  ] as const;

  const csvRows = rows.map(row => {
    const cost = Number(row.costPerUnitSnapshot ?? 0);
    const weight = Number(row.exactWeightLbs ?? 0);
    // Same total-cost math as the detail page: catch-weight uses
    // cost × weight; everything else (fixed_case, per_each, per_unit)
    // uses cost × cases. Snapshotted values mean later product edits
    // don't retroactively change historical exports.
    const totalCost =
      row.costUnitTypeSnapshot === "catch_weight"
        ? cost * weight
        : cost * row.cases;
    return {
      barcode_id: row.barcodeId,
      product_name: row.productName,
      product_sku: row.productSku ?? "",
      lot_number: row.lotNumber,
      status: row.status,
      cases: String(row.cases),
      weight_lbs: weight.toFixed(4),
      units_per_package: row.unitsPerPackageSnapshot ?? "",
      cost_unit_type: row.costUnitTypeSnapshot ?? "",
      cost_per_unit: cost.toFixed(6),
      total_cost: totalCost.toFixed(2),
      expiration_date: row.expirationDate ?? "",
      receive_date: row.receiveDate ?? "",
      supplier: row.supplierName ?? "",
      supplier_invoice_number: row.supplierInvoiceNumber ?? "",
      created_at: row.createdAt.toISOString(),
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `inventory-${tenant.slug}-${stamp}.csv`;
  return { filename, csv: serializeCsv(headers, csvRows) };
}

export async function getInventoryItemById(inventoryItemId: string) {
  const tenant = await getCurrentTenant();

  const candidate = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, inventoryItemId),
    columns: {
      id: true,
      lotId: true,
    },
  });

  if (!candidate) {
    return null;
  }

  const tenantLot = await db.query.lots.findFirst({
    where: and(eq(lots.id, candidate.lotId), eq(lots.tenantId, tenant.id)),
    columns: { id: true },
  });

  if (!tenantLot) {
    return null;
  }

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, inventoryItemId),
    with: {
      product: {
        columns: {
          id: true,
          sku: true,
          name: true,
        },
        // Eager-load the product's base UOM so the detail page can
        // render "X.XX lb" vs "N ea" without an extra roundtrip.
        with: {
          baseUnit: {
            columns: { id: true, abbreviation: true, family: true },
          },
        },
      },
      lot: {
        columns: {
          id: true,
          lotNumber: true,
          receiveDate: true,
          expirationDate: true,
        },
        with: {
          supplier: {
            columns: {
              id: true,
              name: true,
            },
          },
          lotReceipts: {
            columns: {
              id: true,
            },
            with: {
              supplierInvoiceLine: {
                columns: {
                  id: true,
                  quantityCases: true,
                  weightLbs: true,
                  unitType: true,
                  purchaseUnitAbbreviationSnapshot: true,
                },
                with: {
                  product: {
                    columns: {
                      id: true,
                      sku: true,
                      name: true,
                    },
                    with: {
                      baseUnit: {
                        columns: { id: true, abbreviation: true, family: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      allocations: {
        columns: {
          id: true,
          createdAt: true,
        },
        with: {
          salesOrderLine: {
            columns: {
              id: true,
              expectedCases: true,
              fulfilledCases: true,
              shortShippedAt: true,
            },
            with: {
              salesOrder: {
                columns: {
                  id: true,
                  orderNumber: true,
                  orderDate: true,
                  status: true,
                },
                with: {
                  customer: {
                    columns: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              product: {
                columns: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
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
          salesOrder: {
            columns: {
              id: true,
              orderNumber: true,
              orderDate: true,
              status: true,
            },
            with: {
              customer: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          salesOrderLine: {
            columns: {
              id: true,
              expectedCases: true,
              fulfilledCases: true,
              shortShippedAt: true,
            },
            with: {
              product: {
                columns: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          fulfilledBy: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          reversedBy: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          lot: {
            columns: {
              id: true,
              lotNumber: true,
              expirationDate: true,
            },
          },
        },
      },
      adjustments: {
        columns: {
          id: true,
          adjustmentType: true,
          reason: true,
          notes: true,
          statusBefore: true,
          statusAfter: true,
          casesBefore: true,
          casesAfter: true,
          weightLbsBefore: true,
          weightLbsAfter: true,
          createdAt: true,
        },
        with: {
          createdBy: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [desc(inventoryAdjustments.createdAt)],
      },
    },
  });

  if (!item) return null;

  // Fetch supplier invoice data separately to avoid PostgreSQL LATERAL restriction
  // on deeply nested correlated subqueries (5+ levels deep in Drizzle).
  const lineIds = item.lot.lotReceipts
    .map(r => r.supplierInvoiceLine?.id)
    .filter((id): id is string => id != null);

  const invoiceByLineId = new Map<string, { id: string; referenceNumber: string; invoiceNumber: string | null; invoiceDate: string | null; receiveDate: string | null; status: string } | null>();

  if (lineIds.length > 0) {
    const lines = await db.query.supplierInvoiceLines.findMany({
      where: inArray(supplierInvoiceLines.id, lineIds),
      columns: { id: true },
      with: {
        supplierInvoice: {
          columns: {
            id: true,
            referenceNumber: true,
            invoiceNumber: true,
            invoiceDate: true,
            receiveDate: true,
            status: true,
          },
        },
      },
    });
    for (const line of lines) {
      invoiceByLineId.set(line.id, line.supplierInvoice ?? null);
    }
  }

  return {
    ...item,
    lot: {
      ...item.lot,
      lotReceipts: item.lot.lotReceipts.map(r => ({
        ...r,
        supplierInvoiceLine: r.supplierInvoiceLine
          ? {
              ...r.supplierInvoiceLine,
              supplierInvoice: invoiceByLineId.get(r.supplierInvoiceLine.id) ?? null,
            }
          : null,
      })),
    },
  };
}

async function loadInventoryItemForAdjustment(inventoryItemId: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requireInventoryAdjustmentPermission(currentUser.role);

  const inventoryItem = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, inventoryItemId),
    columns: {
      id: true,
      productId: true,
      lotId: true,
      barcodeId: true,
      exactWeightLbs: true,
      cases: true,
      costPerUnitSnapshot: true,
      costUnitTypeSnapshot: true,
      status: true,
    },
    with: {
      lot: {
        columns: {
          id: true,
          tenantId: true,
          lotNumber: true,
          expirationDate: true,
        },
      },
      allocations: {
        columns: { id: true },
      },
      fulfillments: {
        columns: { id: true, reversedAt: true },
      },
    },
  });

  if (!inventoryItem || inventoryItem.lot.tenantId !== tenant.id) {
    throw new Error("Inventory item not found.");
  }

  return { tenant, currentUser, inventoryItem };
}

function calculateWriteOffLoss(args: {
  costPerUnitSnapshot: string | null;
  // Accepts the full lineUnitType enum — per_each / per_unit lines
  // contribute a flat per-unit loss (treated the same as fixed_case).
  costUnitTypeSnapshot:
    | "catch_weight"
    | "fixed_case"
    | "per_each"
    | "per_unit"
    | null;
  statusBefore: InventoryLifecycleState;
  statusAfter: InventoryLifecycleState;
  weightBefore: number;
  weightAfter: number;
}): number {
  const cost = Number(args.costPerUnitSnapshot ?? 0);
  if (cost === 0) return 0;

  const isWriteOff = args.statusAfter === "damaged" || args.statusAfter === "expired";
  const isRestore = args.statusAfter === "in_stock";
  if (isRestore) return 0;

  const isCatchWeight = args.costUnitTypeSnapshot === "catch_weight";

  if (isWriteOff) {
    return isCatchWeight ? cost * args.weightBefore : cost;
  }

  // Weight correction without status change (catch-weight only)
  const weightDelta = args.weightBefore - args.weightAfter;
  return isCatchWeight && weightDelta > 0 ? cost * weightDelta : 0;
}

export async function adjustInventoryItem(input: {
  inventoryItemId: string;
  targetStatus?: InventoryLifecycleState | null;
  correctedWeightLbs?: string | null;
  reason: string;
  notes?: string | null;
}) {
  const { tenant, currentUser, inventoryItem } =
    await loadInventoryItemForAdjustment(input.inventoryItemId);

  ensureSafeInventoryAdjustment({
    status: inventoryItem.status,
    hasAllocations: inventoryItem.allocations.length > 0,
    hasActiveFulfillments: inventoryItem.fulfillments.some(
      fulfillment => !fulfillment.reversedAt,
    ),
  });

  const reason = normalizeAdjustmentReason(input.reason);
  const nextStatus = input.targetStatus ?? inventoryItem.status;
  const nextWeight =
    input.correctedWeightLbs == null
      ? Number(inventoryItem.exactWeightLbs)
      : Number(input.correctedWeightLbs);

  if (!Number.isFinite(nextWeight) || nextWeight < 0) {
    throw new Error("Corrected weight must be zero or a positive number.");
  }

  if (!isOpenWarehouseStatus(nextStatus) && nextStatus !== "damaged" && nextStatus !== "expired") {
    throw new Error("This inventory status cannot be set from the adjustment workflow.");
  }

  const changedFields = getAdjustmentChangedFields({
    statusBefore: inventoryItem.status,
    statusAfter: nextStatus,
    casesBefore: inventoryItem.cases,
    casesAfter: inventoryItem.cases,
    weightBefore: inventoryItem.exactWeightLbs,
    weightAfter: roundInventoryWeight(nextWeight),
  });

  if (changedFields.length === 0) {
    throw new Error("No inventory changes were provided.");
  }

  if (inventoryItem.status !== nextStatus && nextStatus === "in_stock") {
    if (inventoryItem.status !== "damaged" && inventoryItem.status !== "expired") {
      throw new Error("Only damaged or expired inventory can be returned to in stock.");
    }
  }

  const adjustmentType =
    inventoryItem.status !== nextStatus && changedFields.length === 1
      ? "status_change"
      : "correction";

  const writeOffLoss = calculateWriteOffLoss({
    costPerUnitSnapshot: inventoryItem.costPerUnitSnapshot,
    costUnitTypeSnapshot: inventoryItem.costUnitTypeSnapshot,
    statusBefore: inventoryItem.status,
    statusAfter: nextStatus,
    weightBefore: Number(inventoryItem.exactWeightLbs),
    weightAfter: nextWeight,
  });

  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async tx => {
    await tx
      .update(inventoryItems)
      .set({
        status: nextStatus,
        exactWeightLbs: roundInventoryWeight(nextWeight),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, inventoryItem.id));

    const [adjustment] = await tx
      .insert(inventoryAdjustments)
      .values({
        tenantId: tenant.id,
        inventoryItemId: inventoryItem.id,
        lotId: inventoryItem.lotId,
        adjustmentType,
        reason,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        statusBefore: inventoryItem.status,
        statusAfter: nextStatus,
        casesBefore: inventoryItem.cases,
        casesAfter: inventoryItem.cases,
        weightLbsBefore: inventoryItem.exactWeightLbs,
        weightLbsAfter: roundInventoryWeight(nextWeight),
        createdByUserId: currentUser.id,
      })
      .returning({ id: inventoryAdjustments.id });

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "update",
      entityTable: "inventory_items",
      entityId: inventoryItem.id,
      entityLabel: inventoryItem.barcodeId,
      changedFieldsJson: JSON.stringify(changedFields),
      beforeJson: JSON.stringify({
        status: inventoryItem.status,
        cases: inventoryItem.cases,
        exactWeightLbs: inventoryItem.exactWeightLbs,
      }),
      afterJson: JSON.stringify({
        status: nextStatus,
        cases: inventoryItem.cases,
        exactWeightLbs: roundInventoryWeight(nextWeight),
      }),
      contextJson: JSON.stringify({
        action: "inventory_adjustment",
        adjustmentId: adjustment.id,
        reason,
        notes: input.notes?.trim() || null,
      }),
    });

    if (writeOffLoss > 0) {
      await tx.insert(expenses).values({
        tenantId: tenant.id,
        expenseDate: today,
        category: "Inventory write-off",
        amount: writeOffLoss.toFixed(2),
        note: [
          `${inventoryItem.barcodeId} — item marked ${nextStatus}.`,
          input.notes?.trim(),
        ].filter(Boolean).join(" "),
        createdByUserId: currentUser.id,
      });
    }
  });

  return await getInventoryItemById(inventoryItem.id);
}

export async function bulkAdjustLotInventory(input: {
  lotId: string;
  targetStatus: Extract<InventoryLifecycleState, "damaged" | "expired" | "in_stock">;
  reason: string;
  notes?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requireInventoryAdjustmentPermission(currentUser.role);

  const lot = await db.query.lots.findFirst({
    where: and(eq(lots.id, input.lotId), eq(lots.tenantId, tenant.id)),
    columns: {
      id: true,
      lotNumber: true,
      expirationDate: true,
    },
    with: {
      inventoryItems: {
        columns: {
          id: true,
          barcodeId: true,
          status: true,
          cases: true,
          exactWeightLbs: true,
        },
        with: {
          allocations: {
            columns: { id: true },
          },
          fulfillments: {
            columns: { id: true, reversedAt: true },
          },
        },
      },
    },
  });

  if (!lot) {
    throw new Error("Lot not found.");
  }

  const reason = normalizeAdjustmentReason(input.reason);
  const eligibleItems = lot.inventoryItems.filter(item => {
    if (isLockedInventoryStatus(item.status)) return false;
    if (item.allocations.length > 0) return false;
    if (item.fulfillments.some(fulfillment => !fulfillment.reversedAt)) return false;
    if (input.targetStatus === "in_stock") {
      return item.status === "damaged" || item.status === "expired";
    }
    return item.status !== input.targetStatus;
  });

  if (eligibleItems.length === 0) {
    throw new Error("No inventory items in this lot are eligible for the selected lot action.");
  }

  await db.transaction(async tx => {
    for (const item of eligibleItems) {
      await tx
        .update(inventoryItems)
        .set({
          status: input.targetStatus,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, item.id));

      const [adjustment] = await tx
        .insert(inventoryAdjustments)
        .values({
          tenantId: tenant.id,
          inventoryItemId: item.id,
          lotId: lot.id,
          adjustmentType: "bulk_lot_action",
          reason,
          notes: input.notes?.trim() ? input.notes.trim() : null,
          statusBefore: item.status,
          statusAfter: input.targetStatus,
          casesBefore: item.cases,
          casesAfter: item.cases,
          weightLbsBefore: item.exactWeightLbs,
          weightLbsAfter: item.exactWeightLbs,
          createdByUserId: currentUser.id,
        })
        .returning({ id: inventoryAdjustments.id });

      await tx.insert(auditLogs).values({
        tenantId: tenant.id,
        actorType: "portal_user",
        actorPortalUserId: currentUser.id,
        action: "update",
        entityTable: "inventory_items",
        entityId: item.id,
        entityLabel: item.barcodeId,
        changedFieldsJson: JSON.stringify(["status"]),
        beforeJson: JSON.stringify({ status: item.status }),
        afterJson: JSON.stringify({ status: input.targetStatus }),
        contextJson: JSON.stringify({
          action: "lot_bulk_adjustment",
          adjustmentId: adjustment.id,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          reason,
          notes: input.notes?.trim() || null,
        }),
      });
    }
  });

  return {
    lotId: lot.id,
    affectedInventoryItemCount: eligibleItems.length,
  };
}

export type InventoryListItem = Awaited<ReturnType<typeof getInventoryItems>>[number];
export type InventoryDetail = NonNullable<
  Awaited<ReturnType<typeof getInventoryItemById>>
>;

export async function getFifoAllocationForProduct(
  productId: string,
  requestedCases: number,
) {
  if (!productId || requestedCases <= 0) {
    return { rows: [], candidates: [], shortBy: 0, totalWeight: 0, lotsUsed: 0 };
  }

  const tenant = await getCurrentTenant();

  const items = await db
    .select({
      id: inventoryItems.id,
      exactWeightLbs: inventoryItems.exactWeightLbs,
      lotId: inventoryItems.lotId,
      lotNumber: lots.lotNumber,
      receiveDate: lots.receiveDate,
      supplierName: suppliers.name,
    })
    .from(inventoryItems)
    .innerJoin(lots, eq(lots.id, inventoryItems.lotId))
    .innerJoin(suppliers, eq(suppliers.id, lots.supplierId))
    .where(
      and(
        eq(lots.tenantId, tenant.id),
        eq(inventoryItems.productId, productId),
        eq(inventoryItems.status, "in_stock"),
        sql`${lots.expirationDate} >= current_date`,
      ),
    )
    .orderBy(lots.receiveDate, lots.createdAt, inventoryItems.createdAt);

  const lotColorMap = new Map<string, number>();
  let colorIdx = 0;

  const candidates = items.map((item, i) => {
    if (!lotColorMap.has(item.lotId)) {
      lotColorMap.set(item.lotId, colorIdx++);
    }
    return {
      caseIdx: i + 1,
      inventoryItemId: item.id,
      lotId: item.lotId,
      lotNumber: item.lotNumber,
      receivedDate: item.receiveDate,
      weight: Number(item.exactWeightLbs),
      lotColorIdx: lotColorMap.get(item.lotId)!,
      supplierName: item.supplierName,
    };
  });

  const rows = candidates.slice(0, requestedCases);
  const shortBy = Math.max(0, requestedCases - rows.length);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const lotsUsed = new Set(rows.map(r => r.lotId)).size;

  return { rows, candidates, shortBy, totalWeight, lotsUsed };
}

export type FifoAllocationResult = Awaited<ReturnType<typeof getFifoAllocationForProduct>>;
export type FifoAllocationRow = FifoAllocationResult["rows"][number];

export async function getProductCasesOnHand(): Promise<{ productId: string; cases: number }[]> {
  const tenant = await getCurrentTenant();
  return await db
    .select({
      productId: inventoryItems.productId,
      cases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    .where(
      and(
        eq(products.tenantId, tenant.id),
        inArray(inventoryItems.status, ["in_stock", "allocated", "picked", "packed"]),
      ),
    )
    .groupBy(inventoryItems.productId);
}

export type InventoryProductSummaryRow = {
  productId: string;
  sku: string;
  name: string;
  totalCases: number;
  totalWeightLbs: string;
  /**
   * Total base units (eaches) on hand for this product — computed as
   * SUM(cases × units_per_package_snapshot). For a non-weight product
   * with 5 cases of a 24-pack, this is 120. Falls back to summing cases
   * (= pack of 1) when no snapshot exists. Mirrors the row-level
   * "55 cs × 24 ea/cs = 1320 ea" display in the inventory list.
   */
  totalUnits: number;
  itemCount: number;
  /**
   * Abbreviation of the product's base UOM ("lb", "ea", "gal", …). Used
   * by the rollup display to render the right suffix per row — weight
   * products show "X.XX lb", non-weight products show "N ea/case/etc".
   * Null only for legacy products that never had a base unit set.
   */
  baseUnitAbbreviation: string | null;
  /**
   * UoM family ("weight" | "count" | "volume" | "length" | "other" | null).
   * Drives which column ("Weight" vs "Units") the display reads from for
   * this row; a single non-weight catalog still aggregates correctly.
   */
  baseUnitFamily:
    | "weight"
    | "count"
    | "volume"
    | "length"
    | "other"
    | null;
};

export async function getInventoryProductSummary(): Promise<InventoryProductSummaryRow[]> {
  const tenant = await getCurrentTenant();
  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      totalCases: sql<number>`coalesce(sum(${inventoryItems.cases}), 0)::int`,
      totalWeightLbs: sql<string>`coalesce(sum(${inventoryItems.exactWeightLbs}::numeric), 0)::text`,
      // Base-unit total: cases × pack size, summed across all rows.
      // For non-weight products this is the "real" on-hand count
      // (5 cases of 24 = 120 ea). For weight / per_each products
      // pack size defaults to 1 and the value equals totalCases.
      totalUnits: sql<number>`coalesce(sum(${inventoryItems.cases}::numeric * coalesce(${inventoryItems.unitsPerPackageSnapshot}::numeric, 1)), 0)::int`,
      itemCount: sql<number>`count(distinct ${inventoryItems.id})::int`,
      baseUnitAbbreviation: unitsOfMeasure.abbreviation,
      baseUnitFamily: unitsOfMeasure.family,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(products.id, inventoryItems.productId))
    // Left join: legacy products without a base UOM still appear in the
    // rollup (their row just has null/null for the new fields).
    .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUnitId))
    .where(
      and(
        eq(products.tenantId, tenant.id),
        inArray(inventoryItems.status, ["in_stock", "allocated", "picked", "packed"]),
      ),
    )
    .groupBy(
      products.id,
      products.sku,
      products.name,
      unitsOfMeasure.abbreviation,
      unitsOfMeasure.family,
    )
    .orderBy(products.name);
  return rows;
}
