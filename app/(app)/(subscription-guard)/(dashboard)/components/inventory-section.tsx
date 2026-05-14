"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  ExpiringLotRow,
  InventoryStatusRow,
  TopStockedProductRow,
} from "@/modules/distribution/services/dashboard";

type Props = {
  inventory: {
    byStatus: InventoryStatusRow[];
    expiringLots: ExpiringLotRow[];
    expiredLots: ExpiringLotRow[];
    topStockedProducts: TopStockedProductRow[];
  };
};

const STATUS_ORDER = [
  "in_stock",
  "allocated",
  "picked",
  "packed",
  "shipped",
  "sold",
  "damaged",
  "expired",
] as const;

const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  allocated: "Allocated",
  picked: "Picked",
  packed: "Packed",
  shipped: "Shipped",
  sold: "Sold",
  damaged: "Damaged",
  expired: "Expired",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function InventorySection({ inventory }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <div className="border-b border-stone-line pb-3">
          <h2 className="text-sm font-semibold text-stone-ink">Inventory &amp; lots</h2>
          <p className="mt-0.5 text-xs text-stone-muted">
            Stock breakdown and expiration alerts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @3xl/main:grid-cols-2">
        <InventoryByStatusCard rows={inventory.byStatus} />
        <TopStockedProductsCard rows={inventory.topStockedProducts} />
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @3xl/main:grid-cols-2">
        <LotsTableCard
          title="Expiring soon (7d)"
          description="Active lots expiring within the next 7 days."
          rows={inventory.expiringLots}
          emptyMessage="No lots expiring in the next 7 days."
          tone="warning"
        />
        <LotsTableCard
          title="Expired lots"
          description="Expired lots still holding active inventory."
          rows={inventory.expiredLots}
          emptyMessage="No expired lots with active inventory."
          tone="danger"
        />
      </div>
    </section>
  );
}

function InventoryByStatusCard({ rows }: { rows: InventoryStatusRow[] }) {
  const byStatus = new Map(rows.map(r => [r.status, r]));
  const ordered = STATUS_ORDER.map(
    status =>
      byStatus.get(status) ?? { status, itemCount: 0, totalCases: 0 },
  );
  const maxItems = ordered.reduce(
    (max, row) => Math.max(max, row.itemCount),
    0,
  );

  const allZero = ordered.every(r => r.itemCount === 0);

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Inventory by status</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          Item counts across all lots by lifecycle status.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {allZero ? (
          <Empty>No inventory on hand.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {ordered.map(row => {
              const pct =
                maxItems > 0
                  ? Math.max(
                      row.itemCount > 0 ? 5 : 0,
                      (row.itemCount / maxItems) * 100,
                    )
                  : 0;
              return (
                <li key={row.status} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-stone-ink">{statusLabel(row.status)}</span>
                    <span className="tabular-nums text-stone-muted text-xs">
                      {row.itemCount.toLocaleString()} items
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-line2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopStockedProductsCard({ rows }: { rows: TopStockedProductRow[] }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Top stocked products</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          Highest active inventory item counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No active inventory yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.productId}>
                  <TableCell>
                    <Link
                      href={`/products/${row.productId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-stone-muted">
                      {row.sku}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeItemCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LotsTableCard({
  title,
  description,
  rows,
  emptyMessage,
  tone,
}: {
  title: string;
  description: string;
  rows: ExpiringLotRow[];
  emptyMessage: string;
  tone: "warning" | "danger";
}) {
  const dateClass = tone === "danger" ? "text-destructive" : "text-status-warn";

  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">{title}</CardTitle>
        <CardDescription className="text-xs text-stone-muted">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>{emptyMessage}</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/inventory/lots/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.lotNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{row.supplierName}</TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-sm font-medium ${dateClass}`}
                  >
                    {formatDisplayDate(row.expirationDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeItemCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-6 text-center text-xs text-stone-muted">
      {children}
    </p>
  );
}
