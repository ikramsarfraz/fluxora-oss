"use client";

import Link from "next/link";

import { Check, X } from "lucide-react";

import type { PortalUserDetail } from "@/services/portal-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type PortalUserProfileProps = {
  user: PortalUserDetail;
  backLink?: { href: string; label: string };
  variant?: "self" | "admin";
  /** Admin user detail: activate/deactivate and password reset. */
  adminActions?: {
    isSelf: boolean;
    onToggleActive: () => void;
    onResetPassword: () => void;
    togglePending: boolean;
    resetPending: boolean;
  };
};

export function PortalUserProfile({
  user,
  backLink,
  variant = "admin",
  adminActions,
}: PortalUserProfileProps) {
  const auth = user.authUser;

  return (
    <div className="flex flex-col gap-6">
      {backLink ? (
        <nav>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={backLink.href}>{backLink.label}</Link>
          </Button>
        </nav>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.fullName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {variant === "self"
            ? "Your profile and sign-in details"
            : `Portal user #${user.id}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>
            Staff profile, access, and sign-in status.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Role</p>
            <Badge variant="outline" className="mt-0.5">
              {roleLabel(user.role)}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Active</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {user.isActive ? (
                <>
                  <Check className="h-4 w-4 text-green-700" aria-hidden />
                  <span>Yes</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-red-700" aria-hidden />
                  <span>No</span>
                </>
              )}
            </div>
          </div>
          {auth ? (
            <div>
              <p className="text-muted-foreground text-sm">Email verified</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {auth.emailVerified ? (
                  <>
                    <Check className="h-4 w-4 text-green-700" aria-hidden />
                    <span>Yes</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-amber-700" aria-hidden />
                    <span>No</span>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground text-sm">Created</p>
            <p>{formatDateTime(user.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Updated</p>
            <p>{formatDateTime(user.updatedAt)}</p>
          </div>
        </CardContent>
        {variant === "admin" && adminActions ? (
          <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
            <Button type="button" variant="outline" asChild>
              <Link href={`/users`}>Cancel</Link>
            </Button>
            <Button
              type="button"
              variant={user.isActive ? "outline" : "destructive"}
              disabled={
                adminActions.togglePending ||
                (user.isActive && adminActions.isSelf)
              }
              title={
                user.isActive && adminActions.isSelf
                  ? "You cannot deactivate your own account"
                  : undefined
              }
              onClick={adminActions.onToggleActive}
              className="ml-auto"
            >
              {adminActions.togglePending
                ? "Saving…"
                : user.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={adminActions.resetPending}
              onClick={adminActions.onResetPassword}
            >
              {adminActions.resetPending
                ? "Sending…"
                : "Send password reset email"}
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
