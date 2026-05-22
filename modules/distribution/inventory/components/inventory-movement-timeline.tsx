"use client";

import Link from "next/link";
import {
  ClipboardList,
  PackageCheck,
  PackageOpen,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { formatWeightLbs, getInventoryStatusLabel } from "../utils/insights";

/**
 * Narrow shape of the bits we need off the inventory detail object. Kept
 * local so callers don't have to pass the whole `InventoryDetail` (and so
 * a future refactor doesn't ripple through this file).
 */
export type MovementTimelineInput = {
  createdAt: Date | string;
  lot: {
    receiveDate: Date | string | null;
    lotReceipts: Array<{
      supplierInvoiceLine: {
        supplierInvoice: { id: string; invoiceNumber: string | null } | null;
      } | null;
    }>;
  };
  allocations: Array<{
    id: string;
    createdAt: Date | string;
    salesOrderLine: {
      salesOrder: {
        id: string;
        orderNumber: string | null;
        customer: { name: string } | null;
      };
    };
  }>;
  fulfillments: Array<{
    id: string;
    quantityFulfilled: number;
    weightLbs: string | null;
    fulfilledAt: Date | string;
    notes: string | null;
    reversedAt: Date | string | null;
    reversalReason: string | null;
    salesOrder: {
      id: string;
      orderNumber: string | null;
      customer: { name: string } | null;
    };
    fulfilledBy: { fullName: string | null; email: string | null } | null;
    reversedBy: { fullName: string | null; email: string | null } | null;
  }>;
  adjustments: Array<{
    id: string;
    reason: string;
    notes: string | null;
    statusBefore: string | null;
    statusAfter: string | null;
    weightLbsBefore: string | null;
    weightLbsAfter: string | null;
    createdAt: Date | string;
    createdBy: { fullName: string | null; email: string | null } | null;
  }>;
};

type EventKind =
  | "created"
  | "allocated"
  | "fulfilled"
  | "reversed"
  | "adjusted";

type TimelineEvent = {
  id: string;
  kind: EventKind;
  /** Sortable key — Date in ms so all events live in one ordered list. */
  at: number;
  title: React.ReactNode;
  detail?: React.ReactNode;
  actor?: string | null;
};

function actorLabel(user: {
  fullName: string | null;
  email: string | null;
} | null | undefined) {
  return user?.fullName ?? user?.email ?? null;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildEvents(input: MovementTimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Receipt — the moment this physical row came into the warehouse. Prefer
  // the lot's receive date when set (it's a date, not a timestamp), otherwise
  // fall back to the inventory row's createdAt.
  const receiptMs = toMs(input.lot.receiveDate) ?? toMs(input.createdAt);
  if (receiptMs != null) {
    const invoice = input.lot.lotReceipts[0]?.supplierInvoiceLine?.supplierInvoice ?? null;
    events.push({
      id: "created",
      kind: "created",
      at: receiptMs,
      title: invoice ? (
        <>
          Received against bill{" "}
          <Link
            href={`/supplier-invoices/${invoice.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
          </Link>
        </>
      ) : (
        "Received into inventory"
      ),
    });
  }

  for (const a of input.allocations) {
    const ms = toMs(a.createdAt);
    if (ms == null) continue;
    const so = a.salesOrderLine.salesOrder;
    events.push({
      id: `alloc-${a.id}`,
      kind: "allocated",
      at: ms,
      title: (
        <>
          Allocated to{" "}
          <Link
            href={`/orders/${so.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {so.orderNumber ?? so.id.slice(0, 8)}
          </Link>
          {so.customer ? ` · ${so.customer.name}` : null}
        </>
      ),
    });
  }

  for (const f of input.fulfillments) {
    const fulfilledMs = toMs(f.fulfilledAt);
    if (fulfilledMs != null) {
      events.push({
        id: `fulfill-${f.id}`,
        kind: "fulfilled",
        at: fulfilledMs,
        title: (
          <>
            Fulfilled on{" "}
            <Link
              href={`/orders/${f.salesOrder.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {f.salesOrder.orderNumber ?? f.salesOrder.id.slice(0, 8)}
            </Link>
            {f.salesOrder.customer ? ` · ${f.salesOrder.customer.name}` : null}
          </>
        ),
        detail: (
          <span>
            {f.quantityFulfilled.toLocaleString()} units
            {f.weightLbs != null ? ` · ${formatWeightLbs(f.weightLbs)} lb` : ""}
            {f.notes ? ` · ${f.notes}` : ""}
          </span>
        ),
        actor: actorLabel(f.fulfilledBy),
      });
    }
    const reversedMs = toMs(f.reversedAt);
    if (reversedMs != null) {
      events.push({
        id: `reverse-${f.id}`,
        kind: "reversed",
        at: reversedMs,
        title: (
          <>
            Reversed fulfillment on{" "}
            <Link
              href={`/orders/${f.salesOrder.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {f.salesOrder.orderNumber ?? f.salesOrder.id.slice(0, 8)}
            </Link>
          </>
        ),
        detail: f.reversalReason ? <span>{f.reversalReason}</span> : null,
        actor: actorLabel(f.reversedBy),
      });
    }
  }

  for (const adj of input.adjustments) {
    const ms = toMs(adj.createdAt);
    if (ms == null) continue;
    const statusChange =
      adj.statusBefore && adj.statusAfter && adj.statusBefore !== adj.statusAfter
        ? `${getInventoryStatusLabel(adj.statusBefore as never)} → ${getInventoryStatusLabel(adj.statusAfter as never)}`
        : null;
    const weightChange =
      adj.weightLbsBefore != null &&
      adj.weightLbsAfter != null &&
      adj.weightLbsBefore !== adj.weightLbsAfter
        ? `${formatWeightLbs(adj.weightLbsBefore)} → ${formatWeightLbs(adj.weightLbsAfter)} lb`
        : null;
    events.push({
      id: `adj-${adj.id}`,
      kind: "adjusted",
      at: ms,
      title: <>Adjusted · {adj.reason.replace(/_/g, " ")}</>,
      detail: (
        <span>
          {statusChange}
          {statusChange && weightChange ? " · " : ""}
          {weightChange}
          {adj.notes ? `${statusChange || weightChange ? " · " : ""}${adj.notes}` : ""}
        </span>
      ),
      actor: actorLabel(adj.createdBy),
    });
  }

  // Newest first. The receipt event lives at the bottom which mirrors how
  // every audit log in the app reads.
  return events.sort((a, b) => b.at - a.at);
}

function EventDot({ kind }: { kind: EventKind }) {
  const Icon =
    kind === "created"
      ? PackageOpen
      : kind === "allocated"
        ? ClipboardList
        : kind === "fulfilled"
          ? Truck
          : kind === "reversed"
            ? Undo2
            : kind === "adjusted"
              ? Wrench
              : PackageCheck;
  const tone =
    kind === "fulfilled"
      ? "bg-emerald-100 text-emerald-700"
      : kind === "reversed" || kind === "adjusted"
        ? "bg-amber-100 text-amber-700"
        : kind === "allocated"
          ? "bg-sky-100 text-sky-700"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-background",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function formatStamp(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InventoryMovementTimeline({
  item,
}: {
  item: MovementTimelineInput;
}) {
  const events = buildEvents(item);

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        No movement recorded yet for this inventory item.
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4">
      {/* Vertical guide line — sits behind the dots and runs the full height
          of the list. The dots have a background-colored border so they
          cleanly punch through the line. */}
      <span
        aria-hidden
        className="absolute left-[13px] top-1 bottom-1 w-px bg-border"
      />
      {events.map(event => (
        <li key={event.id} className="relative flex items-start gap-3">
          <EventDot kind={event.kind} />
          <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
            <div className="text-sm text-foreground">{event.title}</div>
            {event.detail ? (
              <div className="text-xs text-muted-foreground">
                {event.detail}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              <time dateTime={new Date(event.at).toISOString()}>
                {formatStamp(event.at)}
              </time>
              {event.actor ? ` · ${event.actor}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
