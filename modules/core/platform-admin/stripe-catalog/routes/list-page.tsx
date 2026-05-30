import type { InferSelectModel } from "drizzle-orm";

import { SyncStripeCatalogButton } from "@/modules/core/platform-admin/components/sync-stripe-catalog-button";
import {
  BadgeCode,
  Pill,
} from "@/modules/core/platform-admin/components/admin-ui";
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

/** Forest-tint group band spanning the ledger, one per Stripe product. */
function LedgerGroupRow(props: { row: PlatformAdminGroupedStripeCatalog }) {
  const { product } = props.row;
  const description = product.description?.trim();
  return (
    <tr>
      <td
        colSpan={5}
        className="bg-forest-tint border-forest-tint-deep border-y-[0.5px] p-0"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="min-w-0 truncate">
            <span className="font-serif text-[17px] font-medium tracking-[-0.01em] text-forest">
              {product.name}
            </span>
            <span className="ml-2.5 font-mono text-xs text-forest/70">
              {product.stripeProductId}
            </span>
            <span className="ml-3.5 hidden text-[13px] text-forest/70 sm:inline">
              {description || "No description cached."}
            </span>
          </div>
          {product.active ? (
            <Pill tone="success" dot={false}>
              Product active
            </Pill>
          ) : (
            <Pill tone="danger" dot={false}>
              Product inactive
            </Pill>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Single price line beneath its product group. */
function LedgerPriceRow(props: {
  price: StripePriceRow;
  productActive: boolean;
}) {
  const { price, productActive } = props;
  const eligible = stripePriceEligibleForSaasBilling(price, productActive);
  const rawPlan = price.billingPlanKey?.trim();
  const unknownPlanKey = !!(rawPlan && !SAAS_PLAN_KEY_SET.has(rawPlan));

  const cellBase =
    "border-border-default border-b-[0.5px] px-4 py-[15px] align-middle text-sm text-ink";

  return (
    <tr>
      <td className={cellBase}>
        <div className="font-medium text-ink">
          {formatCadenceAdmin(price.recurringInterval, price.recurringIntervalCount)}
        </div>
        <div className="mt-0.5 font-mono text-xs text-subtle">
          {price.stripePriceId}
        </div>
      </td>
      <td className={cn(cellBase, "font-mono text-xs")}>
        {rawPlan ? (
          <span className={unknownPlanKey ? "font-medium text-danger-fg" : "text-ink-warm"}>
            {price.billingPlanKey}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className={cn(cellBase, "font-mono text-xs")}>
        {price.lookupKey ? (
          <span className="text-ink-warm">{price.lookupKey}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className={cn(cellBase, "text-right")}>
        <span className="font-serif text-[17px] font-medium tracking-[-0.01em] text-ink tabular-nums">
          {formatMoneyAdmin(price.currency, price.unitAmount)}
        </span>
      </td>
      <td className={cellBase}>
        <div className="flex items-center gap-2">
          {price.active ? (
            <Pill tone="success" dot={false}>
              Yes
            </Pill>
          ) : (
            <Pill tone="danger" dot={false}>
              No
            </Pill>
          )}
          <BadgeCode muted={!eligible}>
            {eligible ? "Selectable" : "Not selectable"}
          </BadgeCode>
        </div>
      </td>
    </tr>
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

      <div className="space-y-4">
        <h2 className="font-serif text-[17px] font-medium tracking-[-0.01em] text-ink">
          Cached Stripe objects
        </h2>
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
          <Card className="overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {[
                      { label: "Price · interval", num: false },
                      { label: "Plan key", num: false },
                      { label: "Lookup key", num: false },
                      { label: "Amount", num: true },
                      { label: "Active (Stripe)", num: false },
                    ].map(col => (
                      <th
                        key={col.label}
                        scope="col"
                        className={cn(
                          "border-border-default bg-surface border-y-[0.5px] px-4 py-[11px] text-[10px] font-medium tracking-[0.12em] whitespace-nowrap text-subtle uppercase",
                          col.num ? "text-right" : "text-left",
                          "first:rounded-l-md last:rounded-r-md",
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(row => (
                    <LedgerFragment key={row.product.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** A product group band plus its price rows (or an empty-state row). */
function LedgerFragment(props: { row: PlatformAdminGroupedStripeCatalog }) {
  const { product, prices } = props.row;
  return (
    <>
      <LedgerGroupRow row={props.row} />
      {prices.length === 0 ? (
        <tr>
          <td
            colSpan={5}
            className="border-border-default border-b-[0.5px] px-4 py-[15px] text-sm text-subtle"
          >
            No Stripe prices cached for this product.
          </td>
        </tr>
      ) : (
        prices.map(price => (
          <LedgerPriceRow
            key={price.stripePriceId}
            price={price}
            productActive={product.active}
          />
        ))
      )}
    </>
  );
}
