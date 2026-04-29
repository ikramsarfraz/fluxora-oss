"use client";

import { useState } from "react";
import { toast } from "sonner";

import { sendSelfTenantSignInMagicLinkAction } from "@/actions/auth";
import { PortalUserProfile } from "@/components/portal-user-profile";
import type { PortalUserDetail } from "@/services/portal-users";

export function AccountPortalProfile({
  user,
  tenantSlug,
}: {
  user: PortalUserDetail;
  tenantSlug: string;
}) {
  const [resetPending, setResetPending] = useState(false);

  async function onResetPassword() {
    setResetPending(true);
    try {
      const slug = tenantSlug;
      await sendSelfTenantSignInMagicLinkAction({
        tenantSlug: slug,
        email: user.email ?? user.authUser?.email ?? "",
        displayNameHint: user.fullName,
      });
      toast.success("Check your email for a sign-in link.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send email.");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalUserProfile
        user={user}
        variant="self"
        selfActions={{ onResetPassword, resetPending }}
      />
    </div>
  );
}
