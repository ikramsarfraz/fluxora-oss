"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { setTenantSsoEnabledAction } from "@/modules/core/platform-admin/actions";

type Props = {
  tenantId: string;
  /** Whether the tenant's plan includes SSO (enterprise / comped). */
  eligible: boolean;
  /** Current `core.sso` feature-flag state. */
  enabled: boolean;
  /** Whether the tenant has an active SSO connection configured. */
  configured: boolean;
};

export function TenantSsoControls({
  tenantId,
  eligible,
  enabled,
  configured,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(enabled);

  function onToggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      try {
        await setTenantSsoEnabledAction(tenantId, next);
        toast.success(next ? "SSO enabled for tenant" : "SSO disabled for tenant");
        router.refresh();
      } catch (e) {
        setChecked(!next);
        toast.error(e instanceof Error ? e.message : "Could not update SSO.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Enterprise SSO</CardTitle>
            <CardDescription>
              Per-tenant kill switch for SAML/OIDC single sign-on. Requires the
              Enterprise plan; admins configure their IdP in workspace settings.
            </CardDescription>
          </div>
          {configured ? (
            <Badge variant="secondary">Connection configured</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!eligible ? (
          <p className="text-sm text-amber-600">
            This tenant is not on the Enterprise plan, so SSO is unavailable
            regardless of this switch.
          </p>
        ) : null}
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={v => onToggle(v === true)}
            disabled={isPending}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Allow SSO for this tenant</span>
            <span className="block text-xs text-muted-foreground">
              When off, the workspace cannot configure or use single sign-on
              even on the Enterprise plan.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
