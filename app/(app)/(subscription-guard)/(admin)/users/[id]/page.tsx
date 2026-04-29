"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { PortalUserProfile } from "@/components/portal-user-profile";
import {
  useSendUserPasswordReset,
  useSetUserActive,
  useUser,
} from "@/hooks/use-users";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { isUuid } from "@/lib/utils/uuid";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

import { UserRoleDialog } from "../components/user-role-dialog";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [toggleOpen, setToggleOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const { data: session } = authClient.useSession();

  const { data: user, isLoading, error: loadError } = useUser(userId);
  const { data: currentUser } = useCurrentPortalUser();

  const toggleActive = useSetUserActive();
  const resetPassword = useSendUserPasswordReset();

  useSetBreadcrumbLabel(`/users/${userId}`, user?.fullName);

  if (!isUuid(userId)) {
    return (
      <div className="text-sm text-destructive" role="alert">
        Invalid user ID.
      </div>
    );
  }

  if (isLoading) {
    return <DetailPageSkeleton sections={2} />;
  }

  if (loadError) {
    return (
      <div className="text-sm text-destructive" role="alert">
        Failed to load user: {(loadError as Error).message}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isSelf =
    session?.user?.id != null && user.authUserId === session.user.id;

  return (
    <>
      <PortalUserProfile
        user={user}
        variant="admin"
        adminActions={{
          isSelf,
          onToggleActive: () => {
            if (user.isActive && isSelf) {
              return;
            }
            setToggleOpen(true);
          },
          onResetPassword: () => setResetOpen(true),
          onChangeRole: isSelf ? undefined : () => setRoleOpen(true),
          togglePending: toggleActive.isPending,
          resetPending: resetPassword.isPending,
        }}
      />
      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {user.isActive ? "Deactivate user?" : "Activate user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.isActive
                ? "They will not be able to sign in until an administrator activates this account again."
                : "They will be able to sign in again with their usual credentials."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActive.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() =>
                toggleActive.mutate(
                  { id: userId, isActive: !user.isActive },
                  {
                    onSuccess: updated => {
                      setToggleOpen(false);
                      toast.success(
                        updated.isActive
                          ? "User activated"
                          : "User deactivated",
                      );
                    },
                    onError: (e: Error) => toast.error(e.message),
                  },
                )
              }
              disabled={toggleActive.isPending}
            >
              {toggleActive.isPending
                ? "Saving…"
                : user.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send sign-in link email?</AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ll email a one-time sign-in link to{" "}
              <span className="font-medium text-foreground">{user.email}</span>.
              They complete sign-in through that email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPassword.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() =>
                resetPassword.mutate(userId, {
                  onSuccess: () => {
                    setResetOpen(false);
                    toast.success("Sign-in link email sent.");
                  },
                  onError: (e: Error) => toast.error(e.message),
                })
              }
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? "Sending…" : "Send email"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserRoleDialog
        user={user}
        open={roleOpen}
        onOpenChange={setRoleOpen}
        currentRole={(currentUser?.role as PortalUserRole) ?? null}
      />
    </>
  );
}
