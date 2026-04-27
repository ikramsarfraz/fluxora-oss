"use client";

import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PortalUserRole } from "@/services/portal-users";
import { AuthCenteredShell } from "@/app/(auth)/components/auth-shell";

type TenantChooserTenantDestination = {
  type: "tenant";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  continueUrl: string;
  subtitle?: string;
};

type TenantChooserPlatformDestination = {
  type: "platform_admin";
  id: string;
  name: string;
  role: string;
  continueUrl: string;
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
    <div
      className={cn(
        "w-full rounded-[10px] border border-border bg-white shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]",
        variant === "page" ? "max-w-100" : "max-w-full shadow-sm",
        className,
      )}
    >
      <div className="space-y-2 border-b border-border px-6 pb-5 pt-6 text-center">
        <div
          className="mx-auto mb-3 flex size-9 items-center justify-center rounded-[9px] text-[0.8rem] font-extrabold text-white"
          style={{ background: "var(--primary)" }}
        >
          Fx
        </div>
        <h2
          className={cn(
            "font-bold tracking-tight text-foreground",
            variant === "page" ? "text-2xl" : "text-xl",
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "text-muted-foreground",
            variant === "page" ? "text-sm leading-6" : "text-sm leading-6",
          )}
        >
          {description}
        </p>
      </div>

      <div className="space-y-2 p-4">
        {destinations.map(destination => (
          <button
            key={
              destination.type === "tenant"
                ? destination.tenantId
                : destination.id
            }
            type="button"
            className="flex w-full items-center justify-between rounded-[8px] border border-border bg-white px-4 py-3 text-left transition-colors hover:bg-muted"
            onClick={() => window.location.assign(destination.continueUrl)}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {destination.type === "tenant" ? (
                  <Users className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {destination.type === "tenant"
                    ? destination.tenantName
                    : destination.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {destination.type === "tenant"
                    ? (destination.subtitle ?? destination.tenantSlug)
                    : (destination.subtitle ?? "admin")}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {destination.role.replaceAll("_", " ")}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );

  if (variant === "embedded") {
    return card;
  }

  return <AuthCenteredShell>{card}</AuthCenteredShell>;
}
