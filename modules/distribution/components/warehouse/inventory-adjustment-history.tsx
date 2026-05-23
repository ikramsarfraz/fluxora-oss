"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatWeightLbs,
  getInventoryStatusLabel,
  type InventoryLifecycleState,
} from "@/lib/warehouse/insights";

type AdjustmentLike = {
  id: string;
  barcodeId?: string | null;
  adjustmentType: string;
  reason: string;
  notes: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  casesBefore: number | null;
  casesAfter: number | null;
  weightLbsBefore: string | null;
  weightLbsAfter: string | null;
  createdAt: Date | string;
  createdBy?: {
    fullName: string | null;
    email: string | null;
  } | null;
};

const REASON_LABELS: Record<string, string> = {
  damaged: "Damaged",
  expired: "Expired",
  quality_hold: "Quality hold",
  count_correction: "Count correction",
  weight_correction: "Weight correction",
  return_to_stock: "Return to stock",
  other: "Other",
};

function actorLabel(adjustment: AdjustmentLike) {
  return (
    adjustment.createdBy?.fullName ??
    adjustment.createdBy?.email ??
    "System"
  );
}

function formatAdjustmentDateTime(value: Date | string) {
  return new Date(value).toLocaleString();
}

function renderStatusChange(adjustment: AdjustmentLike) {
  if (!adjustment.statusBefore && !adjustment.statusAfter) return "-";
  if (adjustment.statusBefore === adjustment.statusAfter) {
    return adjustment.statusAfter
      ? getInventoryStatusLabel(
          adjustment.statusAfter as InventoryLifecycleState,
        )
      : "-";
  }
  return `${adjustment.statusBefore ? getInventoryStatusLabel(adjustment.statusBefore as InventoryLifecycleState) : "-"} -> ${adjustment.statusAfter ? getInventoryStatusLabel(adjustment.statusAfter as InventoryLifecycleState) : "-"}`;
}

function renderQuantityChange(adjustment: AdjustmentLike) {
  const before = adjustment.casesBefore;
  const after = adjustment.casesAfter;
  if (before == null && after == null) return "-";
  if (before === after) return before == null ? "-" : String(before);
  return `${before ?? "-"} -> ${after ?? "-"}`;
}

function renderWeightChange(adjustment: AdjustmentLike) {
  const before = adjustment.weightLbsBefore;
  const after = adjustment.weightLbsAfter;
  if (before == null && after == null) return "-";
  if (before === after) return `${formatWeightLbs(after)} lb`;
  return `${formatWeightLbs(before)} -> ${formatWeightLbs(after)} lb`;
}

export function InventoryAdjustmentHistory({
  adjustments,
  emptyMessage,
}: {
  adjustments: AdjustmentLike[];
  emptyMessage?: string;
}) {
  const showBarcodeColumn = adjustments.some(adjustment => adjustment.barcodeId);

  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "No adjustment history recorded yet."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="bg-divider">
          <TableRow>
            <TableHead>When</TableHead>
            {showBarcodeColumn ? <TableHead>Barcode</TableHead> : null}
            <TableHead>Type</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adjustments.map(adjustment => (
            <TableRow key={adjustment.id}>
              <TableCell>
                {formatAdjustmentDateTime(adjustment.createdAt)}
              </TableCell>
              {showBarcodeColumn ? (
                <TableCell className="font-mono text-xs">
                  {adjustment.barcodeId ?? "-"}
                </TableCell>
              ) : null}
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {adjustment.adjustmentType.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {REASON_LABELS[adjustment.reason] ?? adjustment.reason}
              </TableCell>
              <TableCell>{renderStatusChange(adjustment)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {renderQuantityChange(adjustment)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {renderWeightChange(adjustment)}
              </TableCell>
              <TableCell>{actorLabel(adjustment)}</TableCell>
              <TableCell>
                <div className="max-w-xs text-sm text-muted-foreground">
                  {adjustment.notes ?? "-"}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
