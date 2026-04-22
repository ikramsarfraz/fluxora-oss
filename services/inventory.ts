import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryAdjustments,
  inventoryItems,
  lots,
} from "@/db/schema";
import type { PortalUserRole } from "./portal-users";

import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";
import {
  type InventoryLifecycleState,
  getInventoryStatusLabel,
} from "@/lib/warehouse/insights";
import {
  INVENTORY_ADJUSTMENT_REASON_OPTIONS,
  type InventoryAdjustmentReason,
} from "@/lib/warehouse/adjustments";

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

  return await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, inventoryItemId),
    with: {
      product: {
        columns: {
          id: true,
          sku: true,
          name: true,
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
                },
                with: {
                  product: {
                    columns: {
                      id: true,
                      sku: true,
                      name: true,
                    },
                  },
                  supplierInvoice: {
                    columns: {
                      id: true,
                      invoiceNumber: true,
                      invoiceDate: true,
                      receiveDate: true,
                      status: true,
                    },
                    with: {
                      supplier: {
                        columns: {
                          id: true,
                          name: true,
                        },
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

export async function adjustInventoryItem(input: {
  inventoryItemId: string;
  targetStatus?: InventoryLifecycleState | null;
  correctedCases?: number | null;
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
  const nextCases =
    input.correctedCases == null ? inventoryItem.cases : input.correctedCases;
  const nextWeight =
    input.correctedWeightLbs == null
      ? Number(inventoryItem.exactWeightLbs)
      : Number(input.correctedWeightLbs);

  if (!Number.isInteger(nextCases) || nextCases < 0) {
    throw new Error("Corrected cases must be zero or a positive whole number.");
  }

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
    casesAfter: nextCases,
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

  await db.transaction(async tx => {
    await tx
      .update(inventoryItems)
      .set({
        status: nextStatus,
        cases: nextCases,
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
        casesAfter: nextCases,
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
        cases: nextCases,
        exactWeightLbs: roundInventoryWeight(nextWeight),
      }),
      contextJson: JSON.stringify({
        action: "inventory_adjustment",
        adjustmentId: adjustment.id,
        reason,
        notes: input.notes?.trim() || null,
      }),
    });
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
