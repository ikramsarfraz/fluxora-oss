import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryAdjustments, lots } from "@/db/schema";
import { getCurrentTenant } from "./tenants";

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

/** Row shape returned by `getLots()` (for client `import type` only). */
export type LotListItem = Awaited<ReturnType<typeof getLots>>[number];
export type LotDetail = NonNullable<Awaited<ReturnType<typeof getLotById>>>;
