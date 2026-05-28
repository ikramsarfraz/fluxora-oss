import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAiUsageCost } from "@/lib/ai-cost";
import { isUuid } from "@/lib/utils/uuid";
import { AdminDetailHeader } from "@/modules/core/platform-admin/components/admin-detail-header";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import { getTenantById } from "@/modules/core/tenants";

import { PLATFORM_AI_USAGE_ROLES } from "../permissions";
import {
  countTenantUsageEvents,
  getTenantUsageAggregate,
  listDistinctAiModels,
  listTenantUsageEvents,
} from "../services/ai-usage";

const PAGE_SIZE = 50;

function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parseDateInputAsUtc(raw: string): Date | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parsePage(raw: string, totalPages: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function formatTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

type SearchParams = {
  since?: string;
  until?: string;
  model?: string;
  page?: string;
};

export default async function PlatformAdminAiUsageTenantPage(props: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await props.params;
  if (!isUuid(tenantId)) {
    notFound();
  }

  await requirePlatformUserInRoles(PLATFORM_AI_USAGE_ROLES);

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    notFound();
  }

  const params = await props.searchParams;
  const sinceRaw = readString(params.since);
  const untilRaw = readString(params.until);
  const modelRaw = readString(params.model);

  const since = parseDateInputAsUtc(sinceRaw) ?? startOfMonthUtc();
  const untilDate = parseDateInputAsUtc(untilRaw);
  const until = untilDate
    ? new Date(untilDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  const knownModels = await listDistinctAiModels();
  const model = modelRaw && knownModels.includes(modelRaw) ? modelRaw : null;

  const window = { since, until, model };

  const [aggregate, total] = await Promise.all([
    getTenantUsageAggregate({ tenantId, window }),
    countTenantUsageEvents({ tenantId, window }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(readString(params.page), totalPages);
  const offset = (page - 1) * PAGE_SIZE;
  const events = await listTenantUsageEvents({
    tenantId,
    window,
    limit: PAGE_SIZE,
    offset,
  });

  const windowLabel = until
    ? `${since.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : sinceRaw
      ? `Since ${since.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : since.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

  const fromCount = total === 0 ? 0 : offset + 1;
  const toCount = Math.min(offset + events.length, total);

  const buildHref = (overrides: { page?: number | null }) => {
    const sp = new URLSearchParams();
    if (sinceRaw) sp.set("since", sinceRaw);
    if (untilRaw) sp.set("until", untilRaw);
    if (model) sp.set("model", model);
    const pageOverride = overrides.page;
    if (pageOverride != null && pageOverride !== 1) {
      sp.set("page", String(pageOverride));
    }
    const qs = sp.toString();
    return qs
      ? `/admin/ai-usage/${tenantId}?${qs}`
      : `/admin/ai-usage/${tenantId}`;
  };

  const formAction = `/admin/ai-usage/${tenantId}`;

  const exportHref = (() => {
    const sp = new URLSearchParams();
    sp.set("tenantId", tenantId);
    if (sinceRaw) sp.set("since", sinceRaw);
    if (untilRaw) sp.set("until", untilRaw);
    if (model) sp.set("model", model);
    return `/api/admin/export/ai-usage-events?${sp.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <AdminDetailHeader
        backHref="/admin/ai-usage"
        backLabel="Back to AI usage"
        title={tenant.name}
        subtitle={
          <>
            <span>AI usage · {windowLabel}</span>
            {model ? (
              <>
                <span>•</span>
                <span>
                  filtered to <code className="font-mono">{model}</code>
                </span>
              </>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Window</CardTitle>
          <CardDescription>
            Inclusive on both ends. Leave blank for month-to-date through now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            action={formAction}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-tenant-since"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Since
              </label>
              <Input
                id="ai-usage-tenant-since"
                type="date"
                name="since"
                defaultValue={sinceRaw || toDateInputValue(startOfMonthUtc())}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-tenant-until"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Until
              </label>
              <Input
                id="ai-usage-tenant-until"
                type="date"
                name="until"
                defaultValue={untilRaw}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-tenant-model"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Model
              </label>
              <select
                id="ai-usage-tenant-model"
                name="model"
                defaultValue={model ?? ""}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
              >
                <option value="">All models</option>
                {knownModels.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/ai-usage/${tenantId}`}>Reset</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                {/* Plain anchor so the browser handles the CSV download. */}
                <a href={exportHref} download>
                  Export CSV
                </a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total cost</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatAiUsageCost(aggregate?.costMicros ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Calls</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(aggregate?.eventCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Escalations</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(aggregate?.escalationCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failures</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(aggregate?.failureCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Newest first. Each row is a single OpenAI call — escalations
                show the model that was tried first under &ldquo;Escalated
                from&rdquo;.
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">
              {total === 0
                ? "No events in this window."
                : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Escalated from</TableHead>
                <TableHead className="text-right">Prompt</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No AI events for this tenant in this window.
                  </TableCell>
                </TableRow>
              ) : (
                events.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatTimestamp(event.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {event.stage.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.model}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.escalatedFromModel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(event.promptTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(event.completionTokens)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatAiUsageCost(event.costMicros)}
                    </TableCell>
                    <TableCell>
                      {event.succeeded ? (
                        <Badge variant="secondary">OK</Badge>
                      ) : (
                        <Badge variant="destructive">
                          {event.errorCode ?? "Failed"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {event.sourceFilename ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <nav
              aria-label="AI usage events pagination"
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>
                Page {page.toLocaleString()} of {totalPages.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildHref({ page: page - 1 === 1 ? null : page - 1 })}>
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
                    <Link href={buildHref({ page: page + 1 })}>Next →</Link>
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
