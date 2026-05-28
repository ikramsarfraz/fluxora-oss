import Link from "next/link";

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
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";

import { PLATFORM_AI_USAGE_ROLES } from "../permissions";
import {
  listDistinctAiModels,
  listTenantUsageAggregates,
} from "../services/ai-usage";

/**
 * Platform-admin AI usage page. Shows per-tenant aggregate cost +
 * volume + failure stats over a chosen window. Defaults to month-to-date
 * because that's the right granularity for "is anyone burning money?" —
 * daily would be too noisy, all-time hides trends. Admins can widen or
 * narrow via the date inputs.
 */

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

/**
 * Convert a `<input type="date">` value (YYYY-MM-DD) into a `Date` whose
 * UTC midnight matches the picked day. Using UTC keeps the boundary
 * stable regardless of the admin's timezone, which is also how
 * `startOfMonthUtc` chooses its lower bound.
 */
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

type SearchParams = {
  since?: string;
  until?: string;
  model?: string;
};

export default async function PlatformAdminAiUsagePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePlatformUserInRoles(PLATFORM_AI_USAGE_ROLES);
  const params = await props.searchParams;
  const sinceRaw = readString(params.since);
  const untilRaw = readString(params.until);
  const modelRaw = readString(params.model);

  const since = parseDateInputAsUtc(sinceRaw) ?? startOfMonthUtc();
  // `until` is treated as inclusive end-of-day, so push the date input
  // to 23:59:59.999 UTC. Without this, picking the same day for since
  // and until would yield an empty range.
  const untilDate = parseDateInputAsUtc(untilRaw);
  const until = untilDate
    ? new Date(untilDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;

  const knownModels = await listDistinctAiModels();
  const model = modelRaw && knownModels.includes(modelRaw) ? modelRaw : null;

  const window = { since, until, model };
  const aggregates = await listTenantUsageAggregates(window);

  const totals = aggregates.reduce(
    (acc, row) => ({
      eventCount: acc.eventCount + row.eventCount,
      promptTokens: acc.promptTokens + row.promptTokens,
      completionTokens: acc.completionTokens + row.completionTokens,
      costMicros: acc.costMicros + row.costMicros,
      escalationCount: acc.escalationCount + row.escalationCount,
      failureCount: acc.failureCount + row.failureCount,
    }),
    {
      eventCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 0,
      escalationCount: 0,
      failureCount: 0,
    },
  );

  const windowLabel = until
    ? `${since.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : sinceRaw
      ? `Since ${since.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : since.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

  const hasFilters = Boolean(sinceRaw) || Boolean(untilRaw) || Boolean(model);
  const drilldownQs = (tenantId: string) => {
    const sp = new URLSearchParams();
    if (sinceRaw) sp.set("since", sinceRaw);
    if (untilRaw) sp.set("until", untilRaw);
    if (model) sp.set("model", model);
    const qs = sp.toString();
    return qs
      ? `/admin/ai-usage/${tenantId}?${qs}`
      : `/admin/ai-usage/${tenantId}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-forest">Pelzer Solutions internal</p>
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          AI usage
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-tenant OpenAI cost + token usage for invoice parsing.
          {model ? (
            <span> Filtered to <code className="font-mono">{model}</code>.</span>
          ) : null}
        </p>
      </div>

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
            action="/admin/ai-usage"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-since"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Since
              </label>
              <Input
                id="ai-usage-since"
                type="date"
                name="since"
                defaultValue={sinceRaw || toDateInputValue(startOfMonthUtc())}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-until"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Until
              </label>
              <Input
                id="ai-usage-until"
                type="date"
                name="until"
                defaultValue={untilRaw}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="ai-usage-model"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Model
              </label>
              <select
                id="ai-usage-model"
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
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              {hasFilters ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/ai-usage">Reset</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total cost · {windowLabel}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatAiUsageCost(totals.costMicros)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total calls · {windowLabel}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(totals.eventCount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Escalations to gpt-4o</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(totals.escalationCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Mini-first calls that retried on gpt-4o after a transient failure.
            Repeated escalations from one tenant are a signal to investigate.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Failed calls</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatNumber(totals.failureCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            AI calls that returned a failure status (connection error,
            refusal, post-validation reject, …). Reaching the parse_error
            queue UI means BOTH text-AI and vision failed for one upload.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost by tenant · {windowLabel}</CardTitle>
          <CardDescription>
            Sorted by total cost descending. Tenants with no AI usage in this
            window don&apos;t appear; check /admin/tenants for the full list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Prompt tokens</TableHead>
                <TableHead className="text-right">Completion tokens</TableHead>
                <TableHead className="text-right">Escalations</TableHead>
                <TableHead className="text-right">Failures</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No AI usage recorded in this window.
                  </TableCell>
                </TableRow>
              ) : (
                aggregates.map(row => (
                  <TableRow key={row.tenantId}>
                    <TableCell className="font-medium">
                      <Link
                        href={drilldownQs(row.tenantId)}
                        className="hover:underline"
                      >
                        {row.tenantName ?? row.tenantSlug ?? row.tenantId}
                      </Link>
                      {row.tenantSlug ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.tenantSlug}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.eventCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.promptTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.completionTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.escalationCount > 0 ? (
                        <Badge variant="secondary" className="tabular-nums">
                          {formatNumber(row.escalationCount)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.failureCount > 0 ? (
                        <Badge variant="destructive" className="tabular-nums">
                          {formatNumber(row.failureCount)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatAiUsageCost(row.costMicros)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing reference</CardTitle>
          <CardDescription>
            Current OpenAI prices used for cost computation. Costs for models
            outside this table show as $0 — update{" "}
            <code className="rounded bg-muted px-1">lib/ai-cost.ts</code>{" "}
            when OpenAI rebalances or when adding a new model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">$ / 1M input</TableHead>
                <TableHead className="text-right">$ / 1M output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-sm">gpt-4o-mini</TableCell>
                <TableCell className="text-right tabular-nums">$0.15</TableCell>
                <TableCell className="text-right tabular-nums">$0.60</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-sm">gpt-4o</TableCell>
                <TableCell className="text-right tabular-nums">$2.50</TableCell>
                <TableCell className="text-right tabular-nums">$10.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
