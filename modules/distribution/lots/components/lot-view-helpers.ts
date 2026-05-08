import type { LotDetail, LotListItem } from "@/services/lots";

type LotLike = LotListItem | LotDetail;
type InvoiceLike = NonNullable<
  LotLike["lotReceipts"][number]["supplierInvoiceLine"]
>["supplierInvoice"];

function isInvoiceLike(value: InvoiceLike | null | undefined): value is InvoiceLike {
  return Boolean(value);
}

export function getLotPrimaryProduct(lot: LotLike) {
  return (
    lot.lotReceipts[0]?.supplierInvoiceLine?.product ??
    lot.inventoryItems[0]?.product ??
    null
  );
}

export function getLotSourceInvoices(lot: LotLike) {
  return Array.from(
    new Map(
      lot.lotReceipts
        .map(receipt => receipt.supplierInvoiceLine?.supplierInvoice)
        .filter(isInvoiceLike)
        .map(invoice => [invoice.id, invoice]),
    ).values(),
  );
}

export function getLotTotals(lot: LotLike) {
  return {
    inventoryItemCount: lot.inventoryItems.length,
    totalCases: lot.inventoryItems.reduce((sum, item) => sum + (item.cases ?? 0), 0),
    totalWeight: lot.inventoryItems.reduce(
      (sum, item) => sum + (Number(item.exactWeightLbs) || 0),
      0,
    ),
    statuses: lot.inventoryItems.map(item => item.status),
  };
}
