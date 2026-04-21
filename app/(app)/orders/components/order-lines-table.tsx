"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";

import type { SalesOrderDetail } from "@/services/orders";

type Line = SalesOrderDetail["lines"][number];

const UNIT_TYPE_LABELS: Record<string, string> = {
  catch_weight: "Catch weight",
  fixed_case: "Fixed case",
};

function parseCaseWeights(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(v => {
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n != null && n > 0);
  } catch {
    return [];
  }
}

function computeLineTotal(line: Line): number | null {
  const price = line.pricePerLbOverride
    ? parseFloat(line.pricePerLbOverride)
    : NaN;
  const weight = parseFloat(line.totalBilledWeightLbs ?? "0");
  if (!Number.isFinite(price) || !Number.isFinite(weight)) return null;
  return price * weight;
}

interface OrderLinesTableProps {
  lines: Line[];
}

export function OrderLinesTable({ lines }: OrderLinesTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const expandable = useMemo(
    () =>
      lines.filter(
        line =>
          parseCaseWeights(line.caseWeightsLbs).length > 0 ||
          (line.allocations?.length ?? 0) > 0,
      ),
    [lines],
  );

  const allExpanded =
    expandable.length > 0 && expanded.size === expandable.length;

  const subtotal = useMemo(() => {
    let total = 0;
    let hasPrice = false;
    for (const line of lines) {
      const lt = computeLineTotal(line);
      if (lt != null && lt > 0) {
        total += lt;
        hasPrice = true;
      }
    }
    return hasPrice ? total : null;
  }, [lines]);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items yet.</p>;
  }

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(expandable.map(l => l.id)));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {expandable.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="h-7 text-xs"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Product</TableHead>
            <TableHead>Unit type</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Weight (lbs)</TableHead>
            <TableHead className="text-right">Price / lb</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(line => {
            const caseWeights = parseCaseWeights(line.caseWeightsLbs);
            const allocations = line.allocations ?? [];
            const canExpand =
              caseWeights.length > 0 || allocations.length > 0;
            const isOpen = expanded.has(line.id);
            const price = line.pricePerLbOverride
              ? parseFloat(line.pricePerLbOverride)
              : NaN;
            const total = computeLineTotal(line);
            const fulfilled = line.fulfilledCases;
            const expected = line.expectedCases;
            const fulfilledClass =
              expected === 0
                ? "text-muted-foreground"
                : fulfilled >= expected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : fulfilled > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";

            return (
              <LineRowGroup
                key={line.id}
                line={line}
                price={price}
                total={total}
                caseWeights={caseWeights}
                allocations={allocations}
                canExpand={canExpand}
                isOpen={isOpen}
                fulfilledClass={fulfilledClass}
                onToggle={() => toggleRow(line.id)}
              />
            );
          })}
        </TableBody>
        {subtotal != null && (
          <tfoot>
            <tr className="border-t">
              <td />
              <td
                colSpan={5}
                className="px-2 py-2 text-right text-sm text-muted-foreground"
              >
                Subtotal
              </td>
              <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                {formatMoney(subtotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </Table>
    </div>
  );
}

interface LineRowGroupProps {
  line: Line;
  price: number;
  total: number | null;
  caseWeights: number[];
  allocations: NonNullable<Line["allocations"]>;
  canExpand: boolean;
  isOpen: boolean;
  fulfilledClass: string;
  onToggle: () => void;
}

function LineRowGroup({
  line,
  price,
  total,
  caseWeights,
  allocations,
  canExpand,
  isOpen,
  fulfilledClass,
  onToggle,
}: LineRowGroupProps) {
  return (
    <>
      <TableRow
        className={cn(canExpand && "cursor-pointer")}
        onClick={canExpand ? onToggle : undefined}
      >
        <TableCell className="w-8 align-middle">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={e => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={isOpen ? "Collapse line" : "Expand line"}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </TableCell>
        <TableCell>
          {line.product ? (
            <Link
              href={`/products/${line.product.id}`}
              className="hover:underline"
              onClick={e => e.stopPropagation()}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {line.product.sku}
              </span>{" "}
              <span>{line.product.name}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {UNIT_TYPE_LABELS[line.unitType] ?? line.unitType}
          </Badge>
        </TableCell>
        <TableCell className={cn("text-right tabular-nums", fulfilledClass)}>
          {line.fulfilledCases} / {line.expectedCases}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {Number(line.totalBilledWeightLbs ?? 0).toFixed(2)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {Number.isFinite(price) ? (
            `${formatMoney(price)}/lb`
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {total != null ? (
            formatMoney(total)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {canExpand && isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={6} className="py-4">
            <LineBreakdown
              caseWeights={caseWeights}
              allocations={allocations}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function LineBreakdown({
  caseWeights,
  allocations,
}: {
  caseWeights: number[];
  allocations: NonNullable<Line["allocations"]>;
}) {
  const totalCaseWeight = caseWeights.reduce((s, w) => s + w, 0);
  const totalAllocated = allocations.reduce(
    (s, a) => s + (parseFloat(a.allocatedWeightLbs) || 0),
    0,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {caseWeights.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Per-case weights ({caseWeights.length} cases)
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              Total {totalCaseWeight.toFixed(2)} lbs
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {caseWeights.map((w, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="font-mono text-xs tabular-nums"
              >
                {w.toFixed(2)} lbs
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inventory allocations
          </span>
          {allocations.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {allocations.length} box
              {allocations.length === 1 ? "" : "es"} ·{" "}
              {totalAllocated.toFixed(2)} lbs
            </span>
          )}
        </div>
        {allocations.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {allocations.map(a => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {a.inventoryItem?.barcodeId ?? "—"}
                  </span>
                </span>
                <span className="tabular-nums">
                  {Number(a.allocatedWeightLbs ?? 0).toFixed(2)} lbs
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No boxes allocated yet.
          </p>
        )}
      </div>
    </div>
  );
}
