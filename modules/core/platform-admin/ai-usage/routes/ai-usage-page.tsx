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
import { Badge } from "@/components/ui/badge";
import { formatAiUsageCost } from "@/lib/ai-cost";

import { listTenantUsageAggregates } from "../services/ai-usage";

/**
 * Platform-admin AI usage page. Shows per-tenant aggregate cost +
 * volume + failure stats over a rolling window. Default window: the
 * current month-to-date, which is the right granularity for "is anyone
 * burning money?" — daily would be too noisy, all-time hides trends.
 *
 * Click into a tenant from `/admin/tenants/[id]` (separate page, future
 * work) for the per-event drilldown. The list view here is the entry
 * point: scan + sort by cost.
 */

function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function PlatformAdminAiUsagePage() {
  const since = startOfMonthUtc();
  const aggregates = await listTenantUsageAggregates({ since });

  // Pre-compute totals row for the table footer.
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

  const windowLabel = since.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-forest">Pelzer Solutions internal</p>
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          AI usage
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-tenant OpenAI cost + token usage for invoice parsing. One row
          per tenant that made at least one AI call since {windowLabel}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total cost · MTD</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatAiUsageCost(totals.costMicros)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total calls · MTD</CardDescription>
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
            Sorted by total cost descending. Tenants with no AI usage this
            month don&apos;t appear; check /admin/tenants for the full list.
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
                    No AI usage recorded this month.
                  </TableCell>
                </TableRow>
              ) : (
                aggregates.map(row => (
                  <TableRow key={row.tenantId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/tenants/${row.tenantId}`}
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
