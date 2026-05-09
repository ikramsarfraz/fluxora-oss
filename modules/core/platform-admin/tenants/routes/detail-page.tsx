import Link from "next/link";
import { notFound } from "next/navigation";

import { TenantPlanUsageCard } from "@/modules/core/billing/components/subscription/tenant-plan-usage-card";
import { TenantSubscriptionOverview } from "@/modules/core/billing/components/subscription/tenant-subscription-overview";
import { TenantSubscriptionHealthBadge } from "@/modules/core/billing/components/subscription/tenant-subscription-health-badge";
import { Badge } from "@/components/ui/badge";
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
import { getPlatformAdminTenantDetail } from "@/modules/core/platform-admin/services/platform-admin";
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

export default async function PlatformAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const detail = await getPlatformAdminTenantDetail(id);

  if (!detail) {
    notFound();
  }

  const { tenant, users, stats, usage, activity } = detail;
  const defaultPaymentMethod = await getTenantDefaultPaymentMethod(tenant.id);
  const subscriptionHealth = getTenantSubscriptionHealth({
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEndsAt: tenant.currentPeriodEndsAt,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/admin/tenants" className="text-sm font-medium text-blue-700 hover:underline">
            Back to tenants
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{tenant.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{tenant.slug}</span>
            <span>•</span>
            <span className="capitalize">{tenant.tenantType}</span>
            <span>•</span>
            <span>Created {formatDisplayDate(tenant.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={tenant.isActive ? "secondary" : "outline"}>
            {tenant.isActive ? "Active" : "Inactive"}
          </Badge>
          <TenantStatusForm tenantId={tenant.id} isActive={tenant.isActive} />
        </div>
      </div>

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
            <span className="font-medium text-slate-900">
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
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Includes Stripe automation (`stripe_webhook` rows) with event type and Stripe event id. Duplicate webhook deliveries typically show Duplicate / idempotent when no tenant fields changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
