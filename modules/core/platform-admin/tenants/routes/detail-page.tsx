import Link from "next/link";
import { notFound } from "next/navigation";

import { TenantPlanUsageCard } from "@/modules/core/billing/components/subscription/tenant-plan-usage-card";
import { TenantSubscriptionOverview } from "@/modules/core/billing/components/subscription/tenant-subscription-overview";
import { TenantSubscriptionHealthBadge } from "@/modules/core/billing/components/subscription/tenant-subscription-health-badge";
import { AdminDetailHeader } from "@/modules/core/platform-admin/components/admin-detail-header";
import { Badge } from "@/components/ui/badge";
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
import { TenantStatusForm } from "@/modules/core/platform-admin/tenants/components/tenant-status-form";
import { TenantSubscriptionForm } from "@/modules/core/platform-admin/tenants/components/tenant-subscription-form";
import { PlatformTenantStripeCheckoutButtons } from "@/modules/core/platform-admin/tenants/components/platform-tenant-stripe-checkout-buttons";

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
  const subscriptionHealth = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });

  return (
    <div className="space-y-6">
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
            <Badge variant={tenant.isActive ? "secondary" : "outline"}>
              {tenant.isActive ? "Active" : "Inactive"}
            </Badge>
            {canEdit ? (
              <TenantStatusForm tenantId={tenant.id} isActive={tenant.isActive} />
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Subscription overview</CardTitle>
            <TenantSubscriptionHealthBadge health={subscriptionHealth} />
          </div>
          <CardDescription>
            Values below match the tenant record; Checkout and webhooks keep it aligned with Stripe—see Activity for each applied event id and idempotent replays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSubscriptionOverview
            subscriptionPlan={tenant.subscriptionPlan}
            subscriptionStatus={tenant.subscriptionStatus}
            trialEndsAt={tenant.trialEndsAt}
            currentPeriodEndsAt={tenant.currentPeriodEndsAt}
            stripeCustomerId={tenant.stripeCustomerId}
            stripeSubscriptionId={tenant.stripeSubscriptionId}
            defaultPaymentMethod={defaultPaymentMethod}
            observabilityNote="Same persisted fields as tenant Billing. Webhook-driven sync may change this snapshot without a manual save; Stripe event ids and idempotent outcomes appear in Activity below."
          />
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscription fields</CardTitle>
            <CardDescription>
              Manual corrections for Stripe ids, lifecycle, or billing dates—override behavior is unchanged. Future Stripe webhook deliveries may still overwrite these rows to reconcile with Stripe canonical state.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

      {usage ? <TenantPlanUsageCard usage={usage} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active users</CardDescription>
            <CardTitle className="text-3xl">{stats.activeUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Inactive users</CardDescription>
            <CardTitle className="text-3xl">{stats.inactiveUsers}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Tenant app access is permitted only while this tenant is active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Current status:{" "}
            <span className="font-medium text-ink">
              {tenant.isActive ? "Active" : "Inactive"}
            </span>
          </p>
          <p>
            Inactive tenants cannot sign in on their tenant host, and existing tenant-app requests
            fail server-side tenant resolution.
          </p>
        </CardContent>
      </Card>

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
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "outline"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDisplayDate(user.createdAt)}</TableCell>
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
                    <TableCell className="capitalize">
                      {item.actorPlatformUser?.role?.replaceAll("_", " ") ?? "system"}
                    </TableCell>
                    <TableCell>{formatDisplayDate(item.createdAt)}</TableCell>
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
  );
}
