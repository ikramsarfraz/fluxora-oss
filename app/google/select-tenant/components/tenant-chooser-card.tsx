"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PortalUserRole } from "@/services/portal-users";

type TenantOption = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  continueUrl: string;
};

export function TenantChooserCard({ tenants }: { tenants: TenantOption[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-[480px] border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <CardHeader className="space-y-3 pb-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Users className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl tracking-tight text-slate-950">
              Choose your workspace
            </CardTitle>
            <CardDescription className="text-base leading-7 text-slate-500">
              Your Google account is linked to multiple workspaces. Pick one to
              continue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenants.map(tenant => (
            <Button
              key={tenant.tenantId}
              type="button"
              variant="outline"
              className="h-auto w-full justify-between rounded-xl px-4 py-3"
              onClick={() => window.location.assign(tenant.continueUrl)}
            >
              <div className="text-left">
                <p className="font-medium text-slate-900">{tenant.tenantName}</p>
                <p className="text-xs text-slate-500">{tenant.tenantSlug}</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {tenant.role}
              </Badge>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
