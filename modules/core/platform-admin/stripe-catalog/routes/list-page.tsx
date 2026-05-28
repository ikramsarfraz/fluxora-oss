import type { InferSelectModel } from "drizzle-orm";

import { SyncStripeCatalogButton } from "@/modules/core/platform-admin/components/sync-stripe-catalog-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { stripePrices } from "@/db/schema";
import { formatDisplayDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { captureException } from "@/lib/sentry-scope";
import { STRIPE_SAAS_PAID_PLAN_KEYS } from "@/lib/stripe/plan-metadata";
import { PLATFORM_STRIPE_CATALOG_ROLES } from "@/modules/core/platform-admin/stripe-catalog/permissions";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import {
  getPlatformAdminStripeCatalogPagePayload,
  stripePriceEligibleForSaasBilling,
  type PlatformAdminGroupedStripeCatalog,
} from "../services/stripe-catalog";

type StripePriceRow = InferSelectModel<typeof stripePrices>;

const SAAS_PLAN_KEY_SET = new Set<string>(STRIPE_SAAS_PAID_PLAN_KEYS);

function formatMoneyAdmin(currency: string, cents: number | null): string {
  if (cents == null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch (err) {
    captureException(err, {
      stage: "stripe_catalog_format_money",
      currency,
    });
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatCadenceAdmin(interval: string | null, count: number | null): string {
  if (!interval) {
    return "—";
  }
  const raw = interval.toLowerCase();
  const unit =
    raw === "month"
      ? "month"
      : raw === "year"
        ? "year"
        : raw === "week"
          ? "week"
          : raw === "day"
            ? "day"
            : interval;
  const n = count ?? 1;
  if (n === 1) {
    if (unit === "month") {
      return "Monthly";
    }
    if (unit === "year") {
      return "Yearly";
    }
    if (unit === "week") {
      return "Weekly";
    }
    if (unit === "day") {
      return "Daily";
    }
    return `Every ${interval}`;
  }
  const plural =
    unit === "month"
      ? "months"
      : unit === "year"
        ? "years"
        : unit === "week"
          ? "weeks"
          : unit === "day"
            ? "days"
            : `${interval}s`;
  return `Every ${n} ${plural}`;
}

function PriceBadgeRow(props: {
  price: StripePriceRow;
  productActive: boolean;
}) {
  const { price, productActive } = props;
  const eligible = stripePriceEligibleForSaasBilling(price, productActive);
  const rawPlan = price.billingPlanKey?.trim();
  const unknownPlanKey = !!(rawPlan && !SAAS_PLAN_KEY_SET.has(rawPlan));

  if (eligible) {
    return (
      <div className="pt-2">
        <Badge variant="default" className="text-xs">
          Tenant billing selectable
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {!productActive ? (
        <Badge variant="destructive" className="text-xs">
          Product inactive (Stripe)
        </Badge>
      ) : null}
      {!price.active ? (
        <Badge variant="destructive" className="text-xs">
          Price inactive (Stripe)
        </Badge>
      ) : null}
      {!price.recurringInterval?.trim() ? (
        <Badge variant="outline" className="text-xs">
          No recurring interval
        </Badge>
      ) : null}
      {!rawPlan ? (
        <Badge variant="outline" className="text-xs">
          No billing plan key
        </Badge>
      ) : null}
      {unknownPlanKey ? (
        <Badge variant="destructive" className="text-xs">
          Plan metadata not SaaS (starter, growth, enterprise)
        </Badge>
      ) : null}
      <Badge variant="secondary" className="text-xs">
        Not selectable in tenant billing
      </Badge>
    </div>
  );
}

function ProductBlock(props: { row: PlatformAdminGroupedStripeCatalog }) {
  const { product, prices } = props.row;

  return (
    <Card className="overflow-hidden border-border-default">
      <CardHeader className="border-b border-border bg-muted/40 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">{product.name}</CardTitle>
            <CardDescription className="font-mono text-xs">
              Stripe product · {product.stripeProductId}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {product.active ? (
              <Badge variant="outline" className="text-xs">
                Product active (Stripe)
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Product inactive
              </Badge>
            )}
          </div>
        </div>
        {product.description?.trim() ? (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{product.description}</p>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">No description cached.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        {prices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Stripe prices cached for this product.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full caption-bottom text-sm">
              <thead className="border-b [&_tr]:border-b">
                <tr className="border-b border-border hover:bg-muted/50">
                  <th className="h-11 px-3 text-left align-middle font-medium text-foreground">
                    Price ID
                  </th>
                  <th className="h-11 px-3 text-left align-middle font-medium text-foreground">
                    Plan key
                  </th>
                  <th className="h-11 px-3 text-left align-middle font-medium text-foreground">
                    Lookup key
                  </th>
                  <th className="h-11 px-3 text-right align-middle font-medium text-foreground">
                    Amount
                  </th>
                  <th className="h-11 px-3 text-left align-middle font-medium text-foreground">
                    Interval
                  </th>
                  <th className="h-11 px-3 text-left align-middle font-medium text-foreground">
                    Active (Stripe)
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {prices.map(price => {
                  const pk = price.billingPlanKey?.trim();
                  const invalidPlanHead =
                    !!(pk && !SAAS_PLAN_KEY_SET.has(pk));
                  return (
                  <tr key={price.stripePriceId} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="align-top p-3 font-mono text-xs leading-relaxed">
                      {price.stripePriceId}
                      <PriceBadgeRow price={price} productActive={product.active} />
                    </td>
                    <td
                      className={cn(
                        "align-top p-3 font-mono text-xs",
                        invalidPlanHead &&
                          "font-medium text-destructive",
                      )}
                    >
                      {price.billingPlanKey ?? "—"}
                    </td>
                    <td className="align-top p-3 font-mono text-xs">
                      {price.lookupKey ?? "—"}
                    </td>
                    <td className="align-top p-3 text-right font-medium tabular-nums">
                      {formatMoneyAdmin(price.currency, price.unitAmount)}
                    </td>
                    <td className="align-top p-3 text-xs">
                      {formatCadenceAdmin(price.recurringInterval, price.recurringIntervalCount)}
                    </td>
                    <td className="align-top p-3">
                      {price.active ? (
                        <Badge variant="outline" className="text-xs">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          No
                        </Badge>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function PlatformAdminStripeCatalogListPage() {
  await requirePlatformUserInRoles(PLATFORM_STRIPE_CATALOG_ROLES);
  const { grouped, lastFullSyncAudit } = await getPlatformAdminStripeCatalogPagePayload();

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-2 md:p-4">
      <PageHeader
        title="Stripe catalog"
        description="Read-only cache of Stripe Products and Prices used for tenant billing. Webhooks and manual sync update these rows; product and price activity states come from Stripe."
      />
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>Sync</CardTitle>
            <CardDescription>
              Pull active Products and Prices from the connected Stripe account into this database.
            </CardDescription>
            {lastFullSyncAudit ? (
              <div className="pt-2 space-y-1">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Last{" "}
                  <span className="font-medium text-foreground">full-catalog API sync</span> audit:{" "}
                  <span className="font-medium text-foreground">
                    {formatDisplayDate(lastFullSyncAudit.createdAt)}
                  </span>
                  {" · "}actor:{" "}
                  <span className="font-medium text-foreground">
                    {lastFullSyncAudit.actorType === "platform_user"
                      ? "platform user"
                      : "system"}
                  </span>
                  {lastFullSyncAudit.productsUpserted != null &&
                  lastFullSyncAudit.pricesUpserted != null ? (
                    <>
                      {" "}
                      · upserted{" "}
                      <span className="font-medium text-foreground">
                        {lastFullSyncAudit.productsUpserted} product(s)
                      </span>
                      ,{" "}
                      <span className="font-medium text-foreground">
                        {lastFullSyncAudit.pricesUpserted} price(s)
                      </span>
                    </>
                  ) : (
                    <>
                      {" "}
                      · upsert totals not recorded on this audit row (
                      <span className="font-medium text-foreground">
                        expects <code className="text-[0.7rem]">action: stripe_catalog_sync</code>{" "}
                        + <code className="text-[0.7rem]">syncChannel: full_api</code>
                      </span>
                      ).
                    </>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  Webhook-driven updates (<code className="text-[0.7rem]">product.*</code>,{" "}
                  <code className="text-[0.7rem]">price.*</code>) write other audit rows keyed to{" "}
                  <code className="text-[0.7rem]">stripe_products</code> /{" "}
                  <code className="text-[0.7rem]">stripe_prices</code> — not the full sync event above.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground pt-2 text-sm">
                No full-catalog sync logged yet — run Sync Stripe catalog after configuring Stripe metadata.
              </p>
            )}
          </div>
          <div className="shrink-0">
            <SyncStripeCatalogButton />
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">Cached Stripe objects</h2>
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-12 px-6 text-center">
              <p className="font-medium text-foreground">Stripe catalog cache is empty</p>
              <p className="mx-auto max-w-lg text-muted-foreground text-sm leading-relaxed">
                Run <span className="font-medium text-foreground">Sync Stripe catalog</span> above (requires{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">STRIPE_SECRET_KEY</code>{" "}
                pointing at the right Stripe account). In Stripe Dashboard, attach{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">plan</code> metadata
                (starter&nbsp;/ growth&nbsp;/ enterprise) on Prices or Products, then sync again.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {grouped.map(row => (
              <ProductBlock key={row.product.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
