"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PortalUserProfile } from "@/components/portal-user-profile";
import { authClient } from "@/lib/auth-client";
import type { PortalUserDetail } from "@/services/portal-users";

export function AccountPortalProfile({ user }: { user: PortalUserDetail }) {
  const [resetPending, setResetPending] = useState(false);

  async function onResetPassword() {
    setResetPending(true);
    try {
      await authClient.requestPasswordReset({
        email: user.email,
        redirectTo: "/reset-password",
      });
      toast.success("Password reset email sent.");
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
