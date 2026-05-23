"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  useReversalPreview,
  useReverseSupplierInvoice,
} from "../hooks/use-supplier-invoices";

export function SupplierInvoiceReversalDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  canReverse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  canReverse: boolean;
}) {
  const reverse = useReverseSupplierInvoice();
  const { data: preview, isLoading, isError, error } = useReversalPreview(
    invoiceId,
    { enabled: open },
  );
  const [reason, setReason] = useState("");
  // One key per dialog mount — survives retries (network blip, react-query
  // re-fire) so the server's partial unique index on
  // (tenant_id, reverse_idempotency_key) dedupes a double-click.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Reset the reason when the dialog is closed so reopening starts fresh.
  // The preview query auto-refetches on open via its `enabled` flag + zero
  // staleTime; no need for an effect here.
  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  const blockedByItems = preview?.blockedItems ?? [];
  const blocked = blockedByItems.length > 0;
  const costChanges = preview?.costChanges ?? [];
  const changedRows = costChanges.filter(
    c => c.afterReversal.kind !== "unchanged",
  );
  const totalDependents = costChanges.reduce(
    (sum, c) => sum + c.dependentCustomerCount,
    0,
  );

  function handleConfirm() {
    reverse.mutate(
      { id: invoiceId, reason: reason.trim() || null, idempotencyKey },
      {
        onSuccess: () => {
          toast.success(`Receipt "${invoiceNumber}" reversed.`);
          handleOpenChange(false);
        },
        onError: err =>
          toast.error(
            err instanceof Error ? err.message : "Could not reverse receipt.",
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-2xl gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border-default">
          <DialogTitle className="text-[15px] font-medium tracking-tight">
            Reverse receipt {invoiceNumber}?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-subtle">
            This will permanently delete the lots and inventory created by this
            bill and return it to draft. Allowed only while every item is still
            in stock.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-[13px] text-subtle py-8 text-center">
              Loading preview…
            </div>
          ) : isError ? (
            <div className="text-[13px] text-destructive py-8 text-center">
              {(error as Error)?.message ?? "Failed to load preview."}
            </div>
          ) : preview ? (
            <>
              {/* Inventory effects */}
              <div className="flex items-center gap-4 flex-wrap mb-4">
                <Stat
                  label="Lots to delete"
                  value={preview.lotsToDelete.toString()}
                />
                <Stat
                  label="Inventory items to delete"
                  value={preview.inventoryItemsToDelete.toString()}
                />
                {totalDependents > 0 ? (
                  <Stat
                    label="Customer prices on this supplier"
                    value={totalDependents.toString()}
                    hint="preserved"
                  />
                ) : null}
              </div>

              {/* Blocked-items warning */}
              {blocked ? (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[12.5px] text-destructive flex gap-2.5 items-start">
                  <AlertTriangle
                    className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                    aria-hidden
                  />
                  <div>
                    <div className="font-medium text-destructive mb-0.5">
                      {blockedByItems.length} item
                      {blockedByItems.length === 1 ? "" : "s"} can&apos;t be
                      removed.
                    </div>
                    <div className="text-destructive/85 leading-relaxed">
                      Already moved out of stock:{" "}
                      {blockedByItems
                        .slice(0, 4)
                        .map(i => `${i.barcodeId} (${i.status})`)
                        .join(", ")}
                      {blockedByItems.length > 4
                        ? ` and ${blockedByItems.length - 4} more`
                        : ""}
                      .
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Cost changes table */}
              {costChanges.length > 0 ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle mb-2">
                    Per-supplier costs
                    {changedRows.length > 0 ? (
                      <span className="ml-2 text-subtle/70 font-medium normal-case tracking-normal">
                        {changedRows.length} change
                        {changedRows.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border-default overflow-hidden">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-divider/40">
                          <th className="text-left font-medium text-subtle px-3 py-2">
                            Product
                          </th>
                          <th className="text-right font-medium text-subtle px-3 py-2 w-[110px]">
                            Now
                          </th>
                          <th className="text-left font-medium text-subtle px-3 py-2">
                            After reversal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {costChanges.map(row => (
                          <CostChangeRow key={row.productId} row={row} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {/* Dependents note */}
              {totalDependents > 0 ? (
                <div className="text-[11.5px] text-subtle mt-3 leading-relaxed">
                  {totalDependents} customer{totalDependents === 1 ? "" : "s"}{" "}
                  have a custom price for this supplier on these products.
                  Their prices are preserved — review them after reversal.
                </div>
              ) : null}

              {/* Reason */}
              <div className="mt-4">
                <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle block mb-1.5">
                  Reason (optional)
                </label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. supplier sent a corrected invoice…"
                  className="text-[13px] min-h-[60px] resize-y"
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border-default bg-divider/30">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={reverse.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={
              !canReverse || reverse.isPending || isLoading || blocked || isError
            }
          >
            {reverse.isPending ? "Reversing…" : "Reverse receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-subtle">
        {label}
      </div>
      <div className="text-[15px] font-semibold tabular-nums text-ink">
        {value}
        {hint ? (
          <span className="ml-1.5 text-[10.5px] font-normal text-subtle">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CostChangeRow({
  row,
}: {
  row: NonNullable<
    ReturnType<typeof useReversalPreview>["data"]
  >["costChanges"][number];
}) {
  const isUnchanged = row.afterReversal.kind === "unchanged";
  const isRemoved = row.afterReversal.kind === "removed";

  return (
    <tr className={cn("border-t border-border-default", isUnchanged && "opacity-60")}>
      <td className="px-3 py-2">
        <div className="text-ink text-[12.5px] font-medium">
          {row.productName}
        </div>
        {row.productSku ? (
          <div className="text-[10.5px] text-subtle/80 font-mono mt-0.5">
            {row.productSku}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
        ${Number(row.currentCostPerLb).toFixed(4)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChevronRight
            className="h-3 w-3 text-subtle/70 flex-shrink-0"
            aria-hidden
          />
          {row.afterReversal.kind === "restored" ? (
            <>
              <span className="font-mono tabular-nums font-medium text-ink">
                ${Number(row.afterReversal.costPerLb).toFixed(4)}
              </span>
              <span className="text-[11px] text-subtle">
                from {row.afterReversal.sourceInvoiceNumber}
              </span>
            </>
          ) : isRemoved ? (
            <Badge
              variant="outline"
              className="text-[10.5px] border-destructive/30 text-destructive bg-destructive/5"
            >
              removed
            </Badge>
          ) : (
            <span className="text-[11px] text-subtle">unchanged</span>
          )}
        </div>
      </td>
    </tr>
  );
}
