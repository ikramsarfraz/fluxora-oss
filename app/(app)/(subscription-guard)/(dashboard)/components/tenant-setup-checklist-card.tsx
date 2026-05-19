"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useDismissTenantSetupChecklist,
  useTenantSetupChecklist,
} from "@/modules/core/workspace-settings/hooks/use-tenant-setup-checklist";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-line2">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

type Props = { role: PortalUserRole };

export function TenantSetupChecklistCard({ role }: Props) {
  const { data, isPending, isError } = useTenantSetupChecklist();
  const dismiss = useDismissTenantSetupChecklist();

  if (isPending || isError) {
    return null;
  }
  if (!data.visible) {
    return null;
  }

  const canDismiss = role === "admin" || role === "owner";
  const progress = data.total > 0 ? data.completedCount / data.total : 0;

  return (
    <div className="px-4 lg:px-6">
      <Card className="shadow-none border-dashed">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-stone-line pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-medium text-stone-ink">Get started</CardTitle>
            <CardDescription className="text-xs text-stone-muted">
              Complete these steps to finish setting up your workspace (
              {data.completedCount}/{data.total}).
            </CardDescription>
          </div>
          {canDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-stone-muted hover:text-stone-ink2"
              title="Hide checklist"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate()}
            >
              <X className="size-4" />
              <span className="sr-only">Hide checklist</span>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProgressBar value={progress} />
          <ul className="space-y-2">
            {data.items.map(item => (
              <li
                key={item.id}
                className="flex items-start gap-2 text-sm leading-snug"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    item.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-stone-line text-stone-muted",
                  )}
                  aria-hidden
                >
                  {item.done ? <Check className="size-3" /> : null}
                </span>
                {item.done ? (
                  <span className="text-stone-muted line-through">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
