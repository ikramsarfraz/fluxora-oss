"use client";

import { Building2 } from "lucide-react";

import { LogoUploadModal } from "@/components/logo-upload-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTenantLogoUrl } from "@/hooks/use-tenant-branding";

export function TenantBrandingCard() {
  const { data: logoUrl, isLoading } = useTenantLogoUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company branding</CardTitle>
        <CardDescription>
          Your logo appears in the sidebar and on customer-facing documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Logo preview */}
          <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Company logo"
                className="max-h-12 max-w-[112px] object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Building2 className="h-5 w-5" />
                <span className="text-[10px]">No logo</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {logoUrl
                ? "Your custom logo is active."
                : "No logo uploaded yet. The default logo is shown."}
            </p>
            <LogoUploadModal
              trigger={
                <Button variant="outline" size="sm">
                  {logoUrl ? "Change logo" : "Upload logo"}
                </Button>
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
