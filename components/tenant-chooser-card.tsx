"use client";

import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortalUserRole } from "@/services/portal-users";

type TenantChooserTenantDestination = {
  type: "tenant";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  continueUrl: string;
  /** Shown under the title; defaults to the tenant slug. */
  subtitle?: string;
};

type TenantChooserPlatformDestination = {
  type: "platform_admin";
  id: string;
  name: string;
  role: string;
  continueUrl: string;
  /** Shown under the title; defaults to "admin". */
  subtitle?: string;
};

export type TenantChooserDestination =
  | TenantChooserTenantDestination
  | TenantChooserPlatformDestination;

const DEFAULT_TITLE = "Choose your workspace";
const DEFAULT_DESCRIPTION =
  "We found more than one place you can continue. Pick a destination to go there.";

export function TenantChooserCard({
  destinations,
  variant = "page",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className,
}: {
  destinations: TenantChooserDestination[];
  variant?: "page" | "embedded";
  title?: string;
  description?: string;
  className?: string;
}) {
  const card = (
    <Card
      className={cn(
        "w-full max-w-[480px] border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.12)]",
        variant === "embedded" && "max-w-full shadow-md",
        className,
      )}
    >
      <CardHeader className="space-y-3 pb-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Users className="size-6" />
        </div>
        <div className="space-y-2">
          <CardTitle
            className={cn(
              "tracking-tight text-slate-950",
              variant === "page" ? "text-2xl" : "text-xl",
            )}
          >
            {title}
          </CardTitle>
          <CardDescription
            className={cn(
              "text-slate-500",
              variant === "page" ? "text-base leading-7" : "text-sm leading-6",
            )}
          >
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {destinations.map(destination => (
          <Button
            key={
              destination.type === "tenant"
                ? destination.tenantId
                : destination.id
            }
            type="button"
            variant="outline"
            className="h-auto w-full justify-between rounded-xl px-4 py-3"
            onClick={() => window.location.assign(destination.continueUrl)}
          >
            <div className="flex items-center gap-3 text-left">
              {destination.type === "tenant" ? (
                <Users className="size-4 text-slate-500" />
              ) : (
                <ShieldCheck className="size-4 text-slate-500" />
              )}
              <div>
                <p className="font-medium text-slate-900">
                  {destination.type === "tenant"
                    ? destination.tenantName
                    : destination.name}
                </p>
                <p className="text-xs text-slate-500">
                  {destination.type === "tenant"
                    ? (destination.subtitle ?? destination.tenantSlug)
                    : (destination.subtitle ?? "admin")}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {destination.role.replaceAll("_", " ")}
            </Badge>
          </Button>
        ))}
      </CardContent>
    </Card>
  );

  if (variant === "embedded") {
    return card;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      {card}
    </div>
  );
}
