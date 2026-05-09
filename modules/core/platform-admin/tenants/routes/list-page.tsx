import Link from "next/link";

import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
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
import { formatDisplayDate } from "@/lib/utils/date";
import { listPlatformAdminTenants } from "@/modules/core/platform-admin/services/platform-admin";

export default async function PlatformAdminTenantsListPage() {
  const tenants = await listPlatformAdminTenants();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenants</CardTitle>
        <CardDescription>
          Internal view across all tenant workspaces. The `admin` slug is reserved and cannot be
          used by customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Tenant Type</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map(tenant => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/tenants/${tenant.id}`} className="hover:underline">
                    {tenant.name}
                  </Link>
                </TableCell>
                <TableCell>{tenant.slug}</TableCell>
                <TableCell className="capitalize">{tenant.tenantType}</TableCell>
                <TableCell>
                  <Badge variant={tenant.isActive ? "secondary" : "outline"}>
                    {tenant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <SubscriptionPlanBadge plan={tenant.subscriptionPlan} />
                </TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
                </TableCell>
                <TableCell>{tenant.userCount}</TableCell>
                <TableCell>{formatDisplayDate(tenant.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
