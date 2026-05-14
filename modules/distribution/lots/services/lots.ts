import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses, inventoryAdjustments, inventoryItems, lots } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

export async function getLotById(lotId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.lots.findFirst({
    where: and(eq(lots.id, lotId), eq(lots.tenantId, tenant.id)),
    with: {
      supplier: true,
      lotReceipts: {
        with: {
          supplierInvoiceLine: {
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
      inventoryItems: {
        columns: {
          id: true,
          productId: true,
          barcodeId: true,
          exactWeightLbs: true,
          cases: true,
          costPerUnitSnapshot: true,
          costUnitTypeSnapshot: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          product: {
            columns: {
              id: true,
              sku: true,
              name: true,
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
              reversedAt: true,
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
      },
    },
  });

  return result ?? null;
}

export async function getLots() {
  const tenant = await getCurrentTenant();
  const result = await db.query.lots.findMany({
    where: eq(lots.tenantId, tenant.id),
    with: {
      supplier: true,
      lotReceipts: {
        with: {
          supplierInvoiceLine: {
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
              },
            },
          },
        },
      },
      inventoryItems: {
        columns: {
          id: true,
          productId: true,
          cases: true,
          exactWeightLbs: true,
          status: true,
        },
        with: {
          product: {
            columns: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [desc(lots.expirationDate)],
  });

  return result ?? [];
}

export async function createLot(input: {
  lotNumber: string;
  supplierId: string;
  receiveDate: string;
  expirationDate: string;
}) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .insert(lots)
    .values({
      tenantId: tenant.id,
      lotNumber: input.lotNumber.trim(),
      supplierId: input.supplierId,
      receiveDate: input.receiveDate,
      expirationDate: input.expirationDate,
    })
    .returning();

  return row;
}

export async function deleteLot(lotId: string) {
  const tenant = await getCurrentTenant();
  await db
    .delete(lots)
    .where(and(eq(lots.id, lotId), eq(lots.tenantId, tenant.id)));
}

export async function updateLotExpiration(input: {
  lotId: string;
  expirationDate: string;
}) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .update(lots)
    .set({ expirationDate: input.expirationDate })
    .where(and(eq(lots.id, input.lotId), eq(lots.tenantId, tenant.id)))
    .returning({ id: lots.id });
  if (!row) throw new Error("Lot not found.");
  return row;
}

export async function writeOffLotAsLoss(input: {
  lotId: string;
  targetStatus: "expired" | "damaged";
  reason: string;
  notes?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (!["owner", "admin", "warehouse"].includes(currentUser.role)) {
    throw new Error("Forbidden: Your role does not allow writing off inventory.");
  }

  const lot = await db.query.lots.findFirst({
    where: and(eq(lots.id, input.lotId), eq(lots.tenantId, tenant.id)),
    columns: { id: true, lotNumber: true },
    with: {
      inventoryItems: {
        columns: {
          id: true,
          barcodeId: true,
          status: true,
          cases: true,
          exactWeightLbs: true,
          costPerUnitSnapshot: true,
          costUnitTypeSnapshot: true,
        },
        with: {
          allocations: { columns: { id: true } },
          fulfillments: { columns: { id: true, reversedAt: true } },
        },
      },
    },
  });

  if (!lot) throw new Error("Lot not found.");

  const eligibleItems = lot.inventoryItems.filter(item => {
    if (item.status === "shipped" || item.status === "sold") return false;
    if (item.status === input.targetStatus) return false;
    if (item.allocations.length > 0) return false;
    if (item.fulfillments.some(f => !f.reversedAt)) return false;
    return true;
  });

  if (eligibleItems.length === 0) {
    throw new Error("No eligible inventory items to write off in this lot.");
  }

  const totalLoss = eligibleItems.reduce((sum, item) => {
    const cost = Number(item.costPerUnitSnapshot ?? 0);
    const value = item.costUnitTypeSnapshot === "fixed_case"
      ? cost * item.cases
      : cost * Number(item.exactWeightLbs ?? 0);
    return sum + value;
  }, 0);

  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async tx => {
    for (const item of eligibleItems) {
      await tx
        .update(inventoryItems)
        .set({ status: input.targetStatus, updatedAt: new Date() })
        .where(eq(inventoryItems.id, item.id));

      await tx.insert(inventoryAdjustments).values({
        tenantId: tenant.id,
        inventoryItemId: item.id,
        lotId: lot.id,
        adjustmentType: "bulk_lot_action",
        reason: input.reason,
        notes: input.notes?.trim() || null,
        statusBefore: item.status,
        statusAfter: input.targetStatus,
        casesBefore: item.cases,
        casesAfter: item.cases,
        weightLbsBefore: item.exactWeightLbs,
        weightLbsAfter: item.exactWeightLbs,
        createdByUserId: currentUser.id,
      });
    }

    await tx.insert(expenses).values({
      tenantId: tenant.id,
      expenseDate: today,
      category: "Inventory write-off",
      amount: totalLoss.toFixed(2),
      note: [
        `Lot ${lot.lotNumber} — ${eligibleItems.length} item(s) written off as ${input.targetStatus}.`,
        input.notes?.trim(),
      ].filter(Boolean).join(" "),
      createdByUserId: currentUser.id,
    });
  });

  return { affectedItemCount: eligibleItems.length, totalLoss };
}

/** Row shape returned by `getLots()` (for client `import type` only). */
export type LotListItem = Awaited<ReturnType<typeof getLots>>[number];
export type LotDetail = NonNullable<Awaited<ReturnType<typeof getLotById>>>;
