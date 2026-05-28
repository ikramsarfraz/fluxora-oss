import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SupportListClient } from "@/modules/core/platform-admin/support/components/support-list-client";
import { PLATFORM_SUPPORT_ROLES } from "@/modules/core/platform-admin/support/permissions";
import {
  countPlatformSupportTickets,
  listAssignablePlatformUsers,
  listPlatformSupportTickets,
  SUPPORT_ISSUE_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  type SupportIssueType,
  type SupportPriority,
  type SupportTicketStatus,
} from "@/modules/core/platform-admin/support/services/support";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  status?: string;
  priority?: string;
  issueType?: string;
  page?: string;
};

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parsePage(raw: string | undefined, totalPages: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function getFilterValue<T extends string>(
  value: string,
  allowed: readonly T[],
): T | "all" {
  return allowed.includes(value as T) ? (value as T) : "all";
}

function FilterPills({
  label,
  param,
  current,
  options,
  currentFilters,
}: {
  label: string;
  param: keyof SearchParams;
  current: string;
  options: readonly { value: string; label: string }[];
  currentFilters: Pick<SearchParams, "status" | "priority" | "issueType" | "q">;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...options].map(option => {
          const next: Record<string, string | undefined> = {
            ...currentFilters,
            [param]: option.value,
          };
          const sp = new URLSearchParams();
          for (const [k, v] of Object.entries(next)) {
            if (!v || v === "all") continue;
            sp.set(k, String(v));
          }
          const qs = sp.toString();
          const href = qs ? `/admin/support?${qs}` : "/admin/support";
          return (
            <Link
              key={option.value}
              href={href}
              className={
                current === option.value
                  ? "rounded-full border border-slate-900 bg-ink-warm px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-border-default hover:text-foreground"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function buildHref(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length === 0 || s === "all") continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `/admin/support?${qs}` : "/admin/support";
}

export default async function PlatformAdminSupportListPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePlatformUserInRoles(PLATFORM_SUPPORT_ROLES);
  const params = await props.searchParams;
  const q = readString(params.q);
  const status = getFilterValue(
    readString(params.status),
    SUPPORT_TICKET_STATUSES.map(item => item.value),
  );
  const priority = getFilterValue(
    readString(params.priority),
    SUPPORT_PRIORITIES.map(item => item.value),
  );
  const issueType = getFilterValue(
    readString(params.issueType),
    SUPPORT_ISSUE_TYPES.map(item => item.value),
  );

  const filters = {
    status: status as SupportTicketStatus | "all",
    priority: priority as SupportPriority | "all",
    issueType: issueType as SupportIssueType | "all",
    search: q || null,
  };

  const total = await countPlatformSupportTickets(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(params.page, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const [tickets, assignableUsers] = await Promise.all([
    listPlatformSupportTickets(filters, {
      limit: PAGE_SIZE,
      offset,
    }),
    listAssignablePlatformUsers(),
  ]);

  const supportListRows = tickets.map(ticket => ({
    id: ticket.id,
    subject: ticket.subject,
    issueTypeLabel: supportIssueTypeLabel(ticket.issueType),
    priorityLabel: supportPriorityLabel(ticket.priority),
    tenantName: ticket.tenant.name,
    submitterName: ticket.name,
    submitterEmail: ticket.email,
    status: ticket.status,
    statusLabel: supportTicketStatusLabel(ticket.status),
    assigneeLabel:
      ticket.assignedPlatformUser?.authUser.name ??
      ticket.assignedPlatformUser?.authUser.email ??
      "Unassigned",
    attachmentCount: ticket.attachments.length,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }));

  const supportAssignees = assignableUsers.map(user => ({
    id: user.id,
    label: user.authUser.name ?? user.authUser.email,
  }));

  const currentFilters = { q, status, priority, issueType };
  const hasFilters =
    Boolean(q) || status !== "all" || priority !== "all" || issueType !== "all";
  const fromCount = total === 0 ? 0 : offset + 1;
  const toCount = Math.min(offset + tickets.length, total);

  const baseParams = {
    q: q || null,
    status: status === "all" ? null : status,
    priority: priority === "all" ? null : priority,
    issueType: issueType === "all" ? null : issueType,
  };

  const exportHref = (() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (!v) continue;
      sp.set(k, v);
    }
    const qs = sp.toString();
    return qs
      ? `/api/admin/export/support?${qs}`
      : "/api/admin/export/support";
  })();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Support tickets</CardTitle>
          <CardDescription>
            Lightweight issue reports submitted by tenant users during testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            method="get"
            action="/admin/support"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="support-q"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="support-q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Subject, message, name, or email"
              />
            </div>
            {/* Preserve the pill filters across submissions */}
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            {priority !== "all" ? (
              <input type="hidden" name="priority" value={priority} />
            ) : null}
            {issueType !== "all" ? (
              <input type="hidden" name="issueType" value={issueType} />
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Search
              </Button>
              {hasFilters ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/support">Clear</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                {/* Plain anchor so the browser handles the CSV download
                    instead of Next.js client-side routing. */}
                <a href={exportHref} download>
                  Export CSV
                </a>
              </Button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-3">
            <FilterPills
              label="Status"
              param="status"
              current={status}
              options={SUPPORT_TICKET_STATUSES}
              currentFilters={currentFilters}
            />
            <FilterPills
              label="Priority"
              param="priority"
              current={priority}
              options={SUPPORT_PRIORITIES}
              currentFilters={currentFilters}
            />
            <FilterPills
              label="Issue type"
              param="issueType"
              current={issueType}
              options={SUPPORT_ISSUE_TYPES}
              currentFilters={currentFilters}
            />
          </div>

          <div className="flex items-center justify-end">
            <span className="text-xs text-muted-foreground">
              {total === 0
                ? "No support tickets match these filters."
                : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>

          <SupportListClient
            rows={supportListRows}
            canManage
            statusOptions={SUPPORT_TICKET_STATUSES}
            assignees={supportAssignees}
            emptyMessage="No support tickets match these filters."
          />

          {totalPages > 1 ? (
            <nav
              aria-label="Support tickets pagination"
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>
                Page {page.toLocaleString()} of {totalPages.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildHref({
                        ...baseParams,
                        page: page - 1 === 1 ? null : page - 1,
                      })}
                    >
                      ← Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    ← Previous
                  </Button>
                )}
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildHref({ ...baseParams, page: page + 1 })}>
                      Next →
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next →
                  </Button>
                )}
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
