"use client";

import { type ReactNode, useMemo } from "react";
import { AlertCircle, Package, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getInventoryStatusLabel } from "@/lib/inventory-status";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  useAddInventoryAllocationToSalesOrderLine,
  useRemoveSalesOrderLineAllocation,
  useSalesOrderLineAllocationEditor,
} from "@/hooks/use-orders";

const INVENTORY_STATUS_BADGE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  in_stock: "outline",
  allocated: "secondary",
  picked: "secondary",
  packed: "secondary",
  shipped: "default",
  sold: "default",
  damaged: "destructive",
  expired: "destructive",
};

interface OrderAllocationEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  lineId: string;
}

export function OrderAllocationEditorDialog({
  open,
  onOpenChange,
  orderId,
  lineId,
}: OrderAllocationEditorDialogProps) {
  const allocationEditor = useSalesOrderLineAllocationEditor(orderId, lineId, open);
  const addAllocation = useAddInventoryAllocationToSalesOrderLine();
  const removeAllocation = useRemoveSalesOrderLineAllocation();

  const data = allocationEditor.data;
  const isMutating = addAllocation.isPending || removeAllocation.isPending;
  const canAddInventory = useMemo(
    () => (data?.availableInventory ?? []).some(item => item.canAllocate),
    [data?.availableInventory],
  );
  const availableByLot = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        lotNumber: string | null;
        receiveDate: string | Date | null;
        expirationDate: string | Date | null;
        itemCount: number;
        totalWeight: number;
        totalCases: number;
        items: NonNullable<typeof data>["availableInventory"];
      }
    >();

    for (const item of data?.availableInventory ?? []) {
      const key = item.lotId ?? `no-lot:${item.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.itemCount += 1;
        existing.totalWeight += Number(item.exactWeightLbs ?? 0);
        existing.totalCases += item.cases ?? 1;
        existing.items.push(item);
      } else {
        groups.set(key, {
          key,
          lotNumber: item.lotNumber ?? null,
          receiveDate: item.receiveDate ?? null,
          expirationDate: item.expirationDate ?? null,
          itemCount: 1,
          totalWeight: Number(item.exactWeightLbs ?? 0),
          totalCases: item.cases ?? 1,
          items: [item],
        });
      }
    }

    return [...groups.values()].sort((a, b) =>
      (a.lotNumber ?? "No lot").localeCompare(b.lotNumber ?? "No lot"),
    );
  }, [data?.availableInventory]);

  async function onAdd(inventoryItemId: string) {
    try {
      await addAllocation.mutateAsync({
        salesOrderId: orderId,
        salesOrderLineId: lineId,
        inventoryItemId,
      });
      toast.success("Allocation added.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add allocation.",
      );
    }
  }

  async function onRemove(allocationId: string) {
    try {
      await removeAllocation.mutateAsync({
        salesOrderId: orderId,
        salesOrderLineId: lineId,
        allocationId,
      });
      toast.success("Allocation removed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove allocation.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage allocations</DialogTitle>
          <DialogDescription>
            Rebalance reserved inventory for this line without leaving the sales
            order. Changes re-run allocation reconciliation automatically.
          </DialogDescription>
        </DialogHeader>

        {allocationEditor.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : allocationEditor.isError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load allocation editor</AlertTitle>
            <AlertDescription>
              {(allocationEditor.error as Error)?.message ?? "Unknown error"}
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-4">
              <SummaryStat label="Line" value={data.line.productLabel} />
              <SummaryStat
                label="Remaining open"
                value={`${data.line.remainingOpenQuantity}`}
              />
              <SummaryStat
                label="Allocated"
                value={`${data.line.allocatedQuantity}`}
              />
              <SummaryStat
                label="Allocatable gap"
                value={`${data.line.allocationGap}`}
              />
            </div>

            {data.line.isClosed ? (
              <Alert>
                <ShieldAlert />
                <AlertTitle>Allocation adds are locked</AlertTitle>
                <AlertDescription>
                  {data.line.shortShippedAt
                    ? "This line is already closed short. You can still release stale allocations that are not tied to active fulfillment."
                    : "This line is already fully fulfilled. New allocations are not needed."}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Allocated inventory</h3>
                  <span className="text-xs text-muted-foreground">
                    {(data.allocatedInventory ?? []).length} reserved item
                    {(data.allocatedInventory ?? []).length === 1 ? "" : "s"}
                  </span>
                </div>

                {data.allocatedInventory.length > 0 ? (
                  <div className="space-y-2">
                    {data.allocatedInventory.map(allocation => (
                      <InventoryCard
                        key={allocation.allocationId}
                        title={allocation.inventoryItem?.barcodeId ?? "Inventory item"}
                        subtitle={
                          allocation.inventoryItem?.lotNumber
                            ? `Lot ${allocation.inventoryItem.lotNumber}`
                            : "No lot"
                        }
                        meta={[
                          `${Number(
                            allocation.inventoryItem?.exactWeightLbs ??
                              allocation.allocatedWeightLbs ??
                              0,
                          ).toFixed(2)} lbs`,
                          `${allocation.inventoryItem?.cases ?? 1} case${
                            (allocation.inventoryItem?.cases ?? 1) === 1 ? "" : "s"
                          }`,
                          allocation.inventoryItem?.expirationDate
                            ? `Exp ${formatDisplayDate(allocation.inventoryItem.expirationDate)}`
                            : "No expiration",
                        ]}
                        status={allocation.inventoryItem?.status ?? null}
                        lotStatus={allocation.inventoryItem?.lotStatus ?? "ok"}
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void onRemove(allocation.allocationId)}
                            disabled={!allocation.canRemove || isMutating}
                          >
                            Remove
                          </Button>
                        }
                        note={allocation.blockedReason}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                    No inventory is allocated to this line yet.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Available in-stock inventory</h3>
                  <span className="text-xs text-muted-foreground">
                    {data.availableInventory.length} candidate item
                    {data.availableInventory.length === 1 ? "" : "s"}
                  </span>
                </div>

                {data.availableInventory.length > 0 ? (
                  <div className="space-y-4">
                    {availableByLot.map(group => (
                      <div key={group.key} className="rounded-lg border bg-muted/10 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {group.lotNumber ? `Lot ${group.lotNumber}` : "No lot"}
                              </span>
                              <LotStatusBadge
                                expirationDate={group.expirationDate}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {group.receiveDate
                                ? `Received ${formatDisplayDate(group.receiveDate)}`
                                : "Receive date unavailable"}
                              {group.expirationDate
                                ? ` · Expires ${formatDisplayDate(group.expirationDate)}`
                                : ""}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {group.itemCount} item{group.itemCount === 1 ? "" : "s"} ·{" "}
                            {group.totalCases} case{group.totalCases === 1 ? "" : "s"} ·{" "}
                            {group.totalWeight.toFixed(2)} lbs
                          </span>
                        </div>

                        <div className="space-y-2">
                          {group.items.map(item => (
                            <InventoryCard
                              key={item.id}
                              title={item.barcodeId}
                              subtitle={item.lotNumber ? `Lot ${item.lotNumber}` : "No lot"}
                              meta={[
                                `${Number(item.exactWeightLbs ?? 0).toFixed(2)} lbs`,
                                `${item.cases ?? 1} case${(item.cases ?? 1) === 1 ? "" : "s"}`,
                                item.expirationDate
                                  ? `Exp ${formatDisplayDate(item.expirationDate)}`
                                  : "No expiration",
                              ]}
                              status={item.status}
                              lotStatus={item.lotStatus ?? "ok"}
                              action={
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void onAdd(item.id)}
                                  disabled={!item.canAllocate || isMutating}
                                >
                                  Add
                                </Button>
                              }
                              note={item.blockedReason}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                    No in-stock inventory is currently available for this product.
                  </div>
                )}
              </section>
            </div>

            {!canAddInventory && data.availableInventory.length > 0 ? (
              <Alert>
                <RefreshCcw />
                <AlertTitle>Allocation gap is currently full</AlertTitle>
                <AlertDescription>
                  Remove or release an existing allocation before adding a replacement
                  item to this line.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function InventoryCard({
  title,
  subtitle,
  meta,
  status,
  lotStatus,
  action,
  note,
}: {
  title: string;
  subtitle: string;
  meta: string[];
  status: string | null;
  lotStatus?: "ok" | "warning" | "expired";
  action: ReactNode;
  note?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{title}</span>
            {status ? (
              <Badge
                variant={INVENTORY_STATUS_BADGE[status] ?? "outline"}
                className="text-[10px]"
              >
                {getInventoryStatusLabel(status)}
              </Badge>
            ) : null}
            <LotStatusBadge status={lotStatus} />
          </div>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {meta.map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
          {note ? (
            <div className="text-xs text-amber-700 dark:text-amber-300">{note}</div>
          ) : null}
        </div>
        <div>{action}</div>
      </div>
    </div>
  );
}

function LotStatusBadge({
  expirationDate,
  status,
}: {
  expirationDate?: string | Date | null;
  status?: "ok" | "warning" | "expired";
}) {
  const resolvedStatus = status ?? getExpirationStatus(expirationDate);
  if (resolvedStatus === "ok") return null;

  return (
    <Badge
      variant="outline"
      className={
        resolvedStatus === "expired"
          ? "border-destructive/40 text-destructive"
          : "border-amber-400/40 text-amber-700 dark:text-amber-300"
      }
    >
      {resolvedStatus === "expired" ? "Expired" : "Expires soon"}
    </Badge>
  );
}

function getExpirationStatus(
  expirationDate: string | Date | null | undefined,
): "ok" | "warning" | "expired" {
  if (!expirationDate) return "ok";
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(date.getTime())) return "ok";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (exp.getTime() < startOfToday.getTime()) return "expired";

  const warning = new Date(startOfToday);
  warning.setDate(warning.getDate() + 7);
  if (exp.getTime() <= warning.getTime()) return "warning";
  return "ok";
}
