import Link from "next/link";
import { notFound } from "next/navigation";

import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { TenantSubscriptionHealthBadge } from "@/modules/core/billing/components/subscription/tenant-subscription-health-badge";
import { AdminDetailHeader } from "@/modules/core/platform-admin/components/admin-detail-header";
import {
  Callout,
  DefList,
  DefRow,
  DetailGrid,
  DetailRail,
  Pill,
  RailCard,
  RailEyebrow,
  RailRow,
  RailRows,
  UsageLine,
} from "@/modules/core/platform-admin/components/admin-ui";
import { BreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatStripeWebhookAuditSummary,
  parseStripeWebhookAuditContext,
} from "@/lib/stripe/audit-activity";
import { formatDisplayDate } from "@/lib/utils/date";
import { isUuid } from "@/lib/utils/uuid";
import { getTenantSubscriptionHealth } from "@/lib/tenant-subscription-health";
import {
  formatSubscriptionCurrentPeriodLine,
  formatSubscriptionPlanLabel,
  formatSubscriptionStatusLabel,
  formatSubscriptionTrialLine,
  formatTenantPaymentMethodExpiryLine,
  formatTenantPaymentMethodSummary,
} from "@/lib/subscription-display";
import { formatUsageLimit } from "@/lib/subscription-usage-metrics";
import {
  PLATFORM_TENANTS_EDIT_ROLES,
  PLATFORM_TENANTS_ROLES,
} from "@/modules/core/platform-admin/tenants/permissions";
import {
  countPlatformAdminTenantActivity,
  getPlatformAdminTenantDetail,
  listPlatformAdminTenantActivity,
} from "@/modules/core/platform-admin/services/platform-admin";
import {
  hasPlatformUserRole,
  requirePlatformUserInRoles,
} from "@/modules/core/platform-admin/services/platform-users";
import { getTenantDefaultPaymentMethod } from "@/modules/core/billing/stripe-tenant-billing";
import { getTenantBillingDiscount } from "@/modules/core/billing/stripe-discounts";
import { TenantStatusForm } from "@/modules/core/platform-admin/tenants/components/tenant-status-form";
import { TenantSubscriptionForm } from "@/modules/core/platform-admin/tenants/components/tenant-subscription-form";
import { TenantBillingControls } from "@/modules/core/platform-admin/tenants/components/tenant-billing-controls";
import { TenantSsoControls } from "@/modules/core/platform-admin/tenants/components/tenant-sso-controls";
import { PlatformTenantStripeCheckoutButtons } from "@/modules/core/platform-admin/tenants/components/platform-tenant-stripe-checkout-buttons";
import { canUseFeature } from "@/lib/subscription-plan-capabilities";
import { getTenantFeatureEnabled } from "@/modules/core/feature-flags/queries";
import { FEATURES } from "@/modules/core/feature-flags/constants";
import { getActiveTenantSsoSettings } from "@/modules/shared/services/sso-jit";

function formatActivitySummary(item: {
  action: string;
  contextJson: string | null;
  entityLabel: string | null;
}) {
  const label = item.entityLabel ?? "tenant";

  if (!item.contextJson) {
    return `${item.action} ${label}`;
  }

  try {
    const stripeCtx = parseStripeWebhookAuditContext(item.contextJson);
    if (stripeCtx) {
      return formatStripeWebhookAuditSummary(stripeCtx);
    }

    const context = JSON.parse(item.contextJson) as {
      action?: string;
      reason?: string | null;
    };

    if (context.action === "activate_tenant") {
      return `Activated ${label}`;
    }

    if (context.action === "deactivate_tenant") {
      return context.reason?.trim()
        ? `Deactivated ${label}: ${context.reason.trim()}`
        : `Deactivated ${label}`;
    }

    if (context.action === "update_tenant_subscription") {
      return "Subscription fields updated";
    }

    if (context.action === "comp_tenant") {
      return context.reason?.trim()
        ? `Comped ${label}: ${context.reason.trim()}`
        : `Comped ${label} (app free)`;
    }

    if (context.action === "uncomp_tenant") {
      return `Ended comp for ${label}`;
    }

    if (context.action === "update_tenant_billing_discount") {
      return "Billing discount updated";
    }
  } catch {
    return `${item.action} ${label}`;
  }

  return `${item.action} ${label}`;
}

const ACTIVITY_PAGE_SIZE = 15;

export default async function PlatformAdminTenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityPage?: string }>;
}) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const currentUser = await requirePlatformUserInRoles(PLATFORM_TENANTS_ROLES);
  const canEdit = hasPlatformUserRole(currentUser, PLATFORM_TENANTS_EDIT_ROLES);

  const detail = await getPlatformAdminTenantDetail(id);

  if (!detail) {
    notFound();
  }

  const { tenant, users, stats, usage } = detail;
  const sp = await searchParams;

  const activityTotal = await countPlatformAdminTenantActivity(tenant.id);
  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE),
  );
  const rawActivityPage = Number.parseInt(sp.activityPage ?? "1", 10);
  const activityPage =
    !Number.isFinite(rawActivityPage) || rawActivityPage < 1
      ? 1
      : Math.min(rawActivityPage, activityTotalPages);
  const activityOffset = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const activity = await listPlatformAdminTenantActivity({
    tenantId: tenant.id,
    limit: ACTIVITY_PAGE_SIZE,
    offset: activityOffset,
  });
  const activityFrom = activityTotal === 0 ? 0 : activityOffset + 1;
  const activityTo = Math.min(activityOffset + activity.length, activityTotal);
  const activityBuildHref = (page: number | null) => {
    if (page == null || page === 1) return `/admin/tenants/${tenant.id}`;
    return `/admin/tenants/${tenant.id}?activityPage=${page}`;
  };

  const defaultPaymentMethod = await getTenantDefaultPaymentMethod(tenant.id);
  const currentDiscount = canEdit
    ? await getTenantBillingDiscount(tenant.id)
    : null;
  const ssoEligible = canUseFeature(
    {
      subscriptionPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
    },
    "sso",
  );
  const [ssoEnabled, ssoConnection] = canEdit
    ? await Promise.all([
        getTenantFeatureEnabled(tenant.id, FEATURES.CORE_SSO),
        getActiveTenantSsoSettings(tenant.id),
      ])
    : [true, null];
  const subscriptionHealth = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });

  return (
    <div className="space-y-6">
      <BreadcrumbLabel href={`/admin/tenants/${tenant.id}`} label={tenant.name} />
      <AdminDetailHeader
        backHref="/admin/tenants"
        backLabel="Back to tenants"
        title={tenant.name}
        subtitle={
          <>
            <span>{tenant.slug}</span>
            <span>•</span>
            <span className="capitalize">{tenant.tenantType}</span>
            <span>•</span>
            <span>Created {formatDisplayDate(tenant.createdAt)}</span>
          </>
        }
        actions={
          <>
            <Pill tone={tenant.isActive ? "success" : "outline"}>
              {tenant.isActive ? "Active" : "Inactive"}
            </Pill>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/ai-usage/${tenant.id}`}>AI usage</Link>
            </Button>
            {canEdit ? (
              <TenantStatusForm tenantId={tenant.id} isActive={tenant.isActive} />
            ) : null}
          </>
        }
      />

      <DetailGrid>
        {/* Main column — editable + audit sections */}
        <div className="flex flex-col gap-5">
          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Subscription fields</CardTitle>
                <CardDescription>
                  Manual corrections for Stripe ids, lifecycle, or billing dates—override behavior is unchanged.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Callout tone="warning">
                  <strong>Stripe webhooks may overwrite manual edits.</strong>{" "}
                  Saving applies to this tenant row right away. Later webhook
                  deliveries can still replace plan, status, dates, and Stripe
                  ids to match Stripe canonical billing data.
                </Callout>
                <TenantSubscriptionForm tenant={tenant} />
              </CardContent>
            </Card>
          ) : null}

          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Stripe Checkout</CardTitle>
                <CardDescription>
                  Opens Stripe Checkout for the selected plan. <code className="text-xs">metadata.tenantId</code> is set on
                  the session and subscription. Webhook endpoint:{" "}
                  <code className="text-xs">/api/stripe/webhook</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlatformTenantStripeCheckoutButtons tenantId={tenant.id} />
              </CardContent>
            </Card>
          ) : null}

          {canEdit ? (
            <TenantBillingControls
              tenantId={tenant.id}
              isComped={tenant.subscriptionStatus === "comped"}
              currentDiscount={currentDiscount}
            />
          ) : null}

          {canEdit ? (
            <TenantSsoControls
              tenantId={tenant.id}
              eligible={ssoEligible}
              enabled={ssoEnabled}
              configured={ssoConnection != null}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Tenant users</CardTitle>
              <CardDescription>Read-only tenant membership view. Impersonation is intentionally not included in v1.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell className="font-mono text-xs text-subtle">{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>
                        <Pill tone={user.isActive ? "success" : "outline"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Pill>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-subtle">{formatDisplayDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle>Activity</CardTitle>
                  <CardDescription>
                    Includes Stripe automation (`stripe_webhook` rows) with event type and Stripe event id. Duplicate webhook deliveries typically show Duplicate / idempotent when no tenant fields changed.
                  </CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">
                  {activityTotal === 0
                    ? "No activity yet."
                    : `Showing ${activityFrom.toLocaleString()}–${activityTo.toLocaleString()} of ${activityTotal.toLocaleString()}`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.length > 0 ? (
                    activity.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {formatActivitySummary(item)}
                        </TableCell>
                        <TableCell>
                          {item.actorPlatformUser?.authUser.name ?? "System"}
                        </TableCell>
                        <TableCell className="capitalize text-subtle">
                          {item.actorPlatformUser?.role?.replaceAll("_", " ") ?? "system"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-subtle">{formatDisplayDate(item.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No tenant platform-admin activity has been recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {activityTotalPages > 1 ? (
                <nav
                  aria-label="Tenant activity pagination"
                  className="flex items-center justify-between text-sm text-muted-foreground"
                >
                  <span>
                    Page {activityPage.toLocaleString()} of {activityTotalPages.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {activityPage > 1 ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={activityBuildHref(activityPage - 1)}>← Previous</Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        ← Previous
                      </Button>
                    )}
                    {activityPage < activityTotalPages ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={activityBuildHref(activityPage + 1)}>Next →</Link>
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

        {/* Summary rail — at-a-glance facts */}
        <DetailRail aria-label="Tenant summary">
          <RailCard
            title="Subscription"
            action={<TenantSubscriptionHealthBadge health={subscriptionHealth} />}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SubscriptionPlanBadge plan={tenant.subscriptionPlan} />
              <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
            </div>
            <DefList>
              <DefRow
                label="Current plan"
                value={formatSubscriptionPlanLabel(tenant.subscriptionPlan)}
              />
              <DefRow
                label="Status"
                value={formatSubscriptionStatusLabel(tenant.subscriptionStatus)}
              />
              <DefRow
                label="Trial"
                value={formatSubscriptionTrialLine(
                  tenant.subscriptionStatus,
                  tenant.trialEndsAt,
                )}
              />
              <DefRow
                label="Period ends"
                value={formatSubscriptionCurrentPeriodLine(
                  tenant.currentPeriodEndsAt,
                )}
              />
            </DefList>
            <RailEyebrow className="mt-5 mb-2">Stripe linkage</RailEyebrow>
            <DefList>
              <DefRow
                label="Customer"
                mono
                value={tenant.stripeCustomerId?.trim() || "—"}
              />
              <DefRow
                label="Subscription"
                mono
                value={tenant.stripeSubscriptionId?.trim() || "—"}
              />
            </DefList>
            <RailEyebrow className="mt-5 mb-1.5">Payment method</RailEyebrow>
            {defaultPaymentMethod ? (
              <div className="text-[13px]">
                <p className="font-medium text-ink">
                  {formatTenantPaymentMethodSummary(defaultPaymentMethod)}
                </p>
                <p className="text-subtle tabular-nums">
                  {formatTenantPaymentMethodExpiryLine(defaultPaymentMethod)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-subtle">
                No card on file in Stripe wallet for this customer.
              </p>
            )}
          </RailCard>

          {usage ? (
            <RailCard
              title="Plan usage"
              action={
                <span className="text-xs text-subtle">
                  {formatSubscriptionPlanLabel(usage.currentPlan)} plan
                </span>
              }
            >
              <UsageLine
                label="Portal users"
                value={usage.portalUsers.current}
                suffix={`/ ${formatUsageLimit(usage.portalUsers.limit)}`}
              />
              <UsageLine
                label="Products"
                value={usage.products.current}
                suffix={`/ ${formatUsageLimit(usage.products.limit)}`}
              />
              <UsageLine
                label="Customers"
                value={usage.customers.current}
                suffix={`/ ${formatUsageLimit(usage.customers.limit)}`}
              />
              <UsageLine
                label="Monthly orders"
                value={usage.monthlyOrders.current}
                suffix={`/ ${formatUsageLimit(usage.monthlyOrders.limit)}`}
              />
            </RailCard>
          ) : null}

          <RailCard title="Users">
            <RailRows>
              <RailRow label="Total" value={stats.totalUsers} />
              <RailRow label="Active" value={stats.activeUsers} />
              <RailRow label="Inactive" value={stats.inactiveUsers} />
            </RailRows>
          </RailCard>

          <RailCard
            title="Status"
            action={
              <Pill tone={tenant.isActive ? "success" : "outline"}>
                {tenant.isActive ? "Active" : "Inactive"}
              </Pill>
            }
          >
            <p className="text-[13px] text-subtle">
              App access is permitted only while active. Inactive tenants can&apos;t
              sign in, and existing tenant-app requests fail server-side tenant
              resolution.
            </p>
          </RailCard>
        </DetailRail>
      </DetailGrid>
    </div>
  );
}
