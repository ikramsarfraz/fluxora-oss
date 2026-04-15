"use client";

import { useParams } from "next/navigation";

import { PortalUserProfile } from "@/components/portal-user-profile";
import { useUser } from "@/hooks/use-user";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const userId = id ? parseInt(id, 10) : NaN;

  const {
    data: user,
    isLoading,
    error: loadError,
  } = useUser(userId);

  if (!Number.isInteger(userId) || userId < 1) {
    return (
      <div className="text-sm text-destructive" role="alert">
        Invalid user ID.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground">Loading user…</div>
    );
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

  return (
    <PortalUserProfile
      user={user}
      backLink={{ href: "/users", label: "← Users" }}
      variant="admin"
    />
  );
}
