import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import {
  countAuditEventsForTenant,
  humanizeAuditAction,
  listAuditEventsForTenant,
} from "@/lib/audit-log";
import { cn } from "@/lib/utils";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";

const PAGE_SIZE = 25;

// Mirror the `AuditAction` union as a const list so the action filter
// can render a fixed dropdown. Kept in sync by hand because TypeScript
// doesn't surface union members at runtime — when a new action lands
// in `lib/audit-log.ts`, append it here too. The check:tests-style
// gap-finder would catch a missing test file; this list is just a UI
// convenience and an unknown action arriving in the table still
// renders correctly via `humanizeAuditAction`.
const AUDIT_ACTION_OPTIONS = [
  "bill.create",
  "bill.update",
  "bill.complete",
  "bill.reverse",
  "bill.delete",
  "bill.forward",
  "bill.mark_paid_manually",
  "invoice.send",
  "bulk_import.upload",
  "bulk_import.rescan",
  "bulk_import.row_deleted",
  "bulk_import.row_restored",
  "bulk_import.claim_taken_over",
  "supplier.switch_primary",
  "supplier.delete",
  "product.delete",
  "product.archive",
  "product.restore",
  "product.bulk_import",
  "customer.delete",
  "customer.archive",
  "customer.restore",
  "customer.bulk_import",
  "plaid.connection_added",
  "plaid.connection_removed",
  "plaid.mystery_outflows_dismissed_bulk",
  "plaid.manual_sync",
  "expense.reset",
  "expense.submit",
  "expense.approve",
  "expense.reject",
  "expense.mark_paid",
  "tenant.member_added",
  "tenant.member_removed",
  "tenant.member_role_changed",
  "payment_match.confirmed",
  "payment_match.unmatched",
  "payment.void",
  "payment.update",
  "payment.bulk_reconcile",
  "payment.bulk_unreconcile",
  "supplier_payment.bulk_reconcile",
  "supplier_payment.bulk_unreconcile",
] as const;

function formatTimestamp(ts: Date | string): { date: string; time: string } {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const date = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { date, time };
}

function renderMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const value =
        typeof v === "string"
          ? v
          : v == null
            ? "—"
            : JSON.stringify(v);
      return `${k}: ${value}`;
    })
    .join(" · ");
}

function parseDateParam(raw: string | undefined): Date | null {
  if (!raw || raw.trim().length === 0) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePageParam(raw: string | undefined, totalPages: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function readStringParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function buildHref(
  params: Record<string, string | number | null | undefined>,
): string {
  // Strip empty / null params so URL stays readable when filters
  // collapse to defaults. Page is omitted when 1 for the same reason.
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length === 0) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}

export default async function TenantAuditLogPage(props: {
  searchParams: Promise<{
    action?: string;
    resource?: string;
    actor?: string;
    since?: string;
    until?: string;
    page?: string;
  }>;
}) {
  const current = await requireAdminPortalUser();
  const params = await props.searchParams;

  // The page rewrites Next.js searchParams into the filter shape the
  // reader wants. Empty / unparseable values collapse to "no filter".
  const action = readStringParam(params.action);
  const resourceType = readStringParam(params.resource);
  const actorEmail = readStringParam(params.actor);
  const sinceRaw = readStringParam(params.since);
  const untilRaw = readStringParam(params.until);

  const filters = {
    tenantId: current.tenantId,
    action: action || null,
    resourceType: resourceType || null,
    actorEmail: actorEmail || null,
    since: parseDateParam(sinceRaw),
    until: parseDateParam(untilRaw),
  };

  const total = await countAuditEventsForTenant(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePageParam(params.page, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const events = await listAuditEventsForTenant({
    filters,
    limit: PAGE_SIZE,
    offset,
  });

  const hasFilters =
    Boolean(action) ||
    Boolean(resourceType) ||
    Boolean(actorEmail) ||
    Boolean(sinceRaw) ||
    Boolean(untilRaw);

  const fromCount = total === 0 ? 0 : offset + 1;
  const toCount = Math.min(offset + events.length, total);

  // The pagination links rebuild the full param set so filters are
  // preserved while moving pages. `null` removes the param entirely.
  const baseParams = {
    action: action || null,
    resource: resourceType || null,
    actor: actorEmail || null,
    since: sinceRaw || null,
    until: untilRaw || null,
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Append-only record of destructive and sensitive actions across this workspace."
      />

      {/* Filter strip — GET form so the page state lives in the URL.
          That makes the view shareable + bookmarkable, and means a
          back-button navigation restores the same filters without any
          client-side state. */}
      <form
        method="get"
        action="/admin/audit"
        className="grid grid-cols-1 gap-3 rounded-[10px] border border-border-default bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="flex flex-col gap-1 text-[11px] font-medium text-subtle">
          Action
          <select
            name="action"
            defaultValue={action}
            className="rounded-md border border-border-default bg-page px-2 py-1.5 text-[13px] text-ink-warm"
          >
            <option value="">Any</option>
            {AUDIT_ACTION_OPTIONS.map(a => (
              <option key={a} value={a}>
                {humanizeAuditAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-subtle">
          Resource type
          <input
            type="text"
            name="resource"
            defaultValue={resourceType}
            placeholder="e.g. supplier_invoice"
            className="rounded-md border border-border-default bg-page px-2 py-1.5 text-[13px] text-ink-warm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-subtle">
          Actor email
          <input
            type="text"
            name="actor"
            defaultValue={actorEmail}
            placeholder="user@example.com"
            className="rounded-md border border-border-default bg-page px-2 py-1.5 text-[13px] text-ink-warm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-subtle">
          Since
          <input
            type="date"
            name="since"
            defaultValue={sinceRaw}
            className="rounded-md border border-border-default bg-page px-2 py-1.5 text-[13px] text-ink-warm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-subtle">
          Until
          <input
            type="date"
            name="until"
            defaultValue={untilRaw}
            className="rounded-md border border-border-default bg-page px-2 py-1.5 text-[13px] text-ink-warm"
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md border border-forest-mid bg-forest-mid px-3 py-1.5 text-[12px] font-medium text-card-warm hover:bg-forest"
          >
            Apply filters
          </button>
          {hasFilters ? (
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1 rounded-md border border-border-default bg-card px-3 py-1.5 text-[12px] font-medium text-ink-warm hover:bg-surface"
            >
              Clear
            </Link>
          ) : null}
          <span className="ml-auto text-[12px] text-subtle">
            {total === 0
              ? "No events match these filters."
              : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()}`}
          </span>
        </div>
      </form>

      {events.length === 0 ? (
        <div className="rounded-[10px] border border-border-default bg-page px-6 py-12 text-center text-[13px] text-subtle">
          {hasFilters
            ? "No audit events match the current filters. Try widening the date range or clearing a filter."
            : "No audit events recorded yet. Activity will appear here as people use the workspace."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border-default bg-card">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-divider/60">
                {(["When", "Actor", "Action", "Resource", "Details"] as const).map(
                  label => (
                    <th
                      key={label}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-subtle"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {events.map(event => {
                const ts = formatTimestamp(event.occurredAt);
                const isDestructive = event.action.includes("delete");
                return (
                  <tr
                    key={event.id}
                    className="border-t border-divider align-top"
                  >
                    <td className="px-4 py-2.5 font-mono text-ink-warm">
                      <div>{ts.date}</div>
                      <div className="text-subtle">{ts.time}</div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-warm">
                      {event.actorEmail ?? event.actorUserId}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 font-medium",
                        isDestructive && "text-destructive",
                      )}
                    >
                      {humanizeAuditAction(event.action)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-subtle">
                      {event.resourceType}
                      {event.resourceId
                        ? ` · ${event.resourceId.slice(0, 8)}`
                        : ""}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-warm">
                      {renderMetadata(event.metadata)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between text-[12px] text-subtle"
          aria-label="Audit log pagination"
        >
          <span>
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ ...baseParams, page: page - 1 === 1 ? null : page - 1 })}
                className="rounded-md border border-border-default bg-card px-3 py-1 text-ink-warm hover:bg-surface"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-md border border-border-default bg-page px-3 py-1 opacity-50">
                ← Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={buildHref({ ...baseParams, page: page + 1 })}
                className="rounded-md border border-border-default bg-card px-3 py-1 text-ink-warm hover:bg-surface"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-md border border-border-default bg-page px-3 py-1 opacity-50">
                Next →
              </span>
            )}
          </div>
        </nav>
      ) : null}

      <p className="text-[11px] text-subtle">
        Audit entries are append-only. Older events stay readable
        indefinitely.
      </p>
    </section>
  );
}
