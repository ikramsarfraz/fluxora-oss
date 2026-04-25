"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  acceptInvitationRequest,
  fetchInvitationPreview,
  InvitationActionError,
} from "@/lib/api/invitations";
import type { InvitationPreviewFailureReason } from "@/services/invitations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  inviteAcceptFormSchema,
  type InviteAcceptFormValues,
} from "./invite-user-form.schema";

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

type InviteUserFormProps = {
  sessionEmail?: string | null;
};

const PREVIEW_FAILURE_COPY: Record<
  InvitationPreviewFailureReason,
  { title: string; body: string }
> = {
  not_found: {
    title: "Link not found",
    body: "The invitation link is invalid. Ask an administrator to send a new one.",
  },
  expired: {
    title: "Invite expired",
    body: "This link has passed its expiry. Ask an administrator to resend the invitation from Users.",
  },
  revoked: {
    title: "Invite revoked",
    body: "This invitation is no longer active. Ask for a new invite if you still need access.",
  },
  already_accepted: {
    title: "Already used",
    body: "This invitation was already accepted. Sign in to the workspace to continue.",
  },
  invalid: {
    title: "Invite unavailable",
    body: "This invitation cannot be used. Ask an administrator to send a new one.",
  },
};

export function InviteUserForm({ sessionEmail = null }: InviteUserFormProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const tokenFromPath =
    typeof params?.token === "string" ? params.token : null;
  const tokenFromQuery = searchParams.get("token");
  const token = tokenFromPath ?? tokenFromQuery;

  const queryError = searchParams.get("error");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const invitationQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitationPreview(token!),
    enabled: Boolean(token),
  });

  const form = useForm<InviteAcceptFormValues>({
    resolver: zodResolver(inviteAcceptFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: InviteAcceptFormValues) {
    if (!token) {
      setSubmitError(
        "Missing invite token. Open the full link from your invitation email.",
      );
      return;
    }
    setSubmitError(null);
    try {
      await acceptInvitationRequest({
        token,
        password: data.newPassword,
      });
      router.push("/invite/success");
      router.refresh();
    } catch (e) {
      if (e instanceof InvitationActionError) {
        if (e.code === "ALREADY_ACCEPTED" || e.code === "EXPIRED_OR_INVALID") {
          setSubmitError(
            e.message || "This invitation can no longer be accepted.",
          );
          return;
        }
        if (e.code === "REVOKED") {
          setSubmitError("This invitation was revoked.");
          return;
        }
      }
      setSubmitError(
        e instanceof Error ? e.message : "Could not accept invitation",
      );
    }
  }

  const { isSubmitting } = form.formState;

  if (queryError === "INVALID_TOKEN") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
          <CardDescription>
            Ask an administrator to send you a new invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FieldDescription className="text-center">
            <Link href="/sign-in">Back to sign in</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Missing invite link</CardTitle>
          <CardDescription>
            Open the link from your email. It should look like{" "}
            <span className="font-mono text-xs">/invite/…</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild variant="outline">
            <Link href="/invite">About invitations</Link>
          </Button>
          <FieldDescription className="text-center">
            <Link href="/sign-in">Back to sign in</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  if (invitationQuery.isPending) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitation</CardTitle>
          <CardDescription>Loading your invitation…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invitationQuery.isError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Could not load invite</CardTitle>
          <CardDescription>
            Check your network and try again, or open the link from your
            email.
          </CardDescription>
        </CardHeader>
        <FieldDescription className="px-6 pb-6 text-center">
          <Link href="/sign-in">Back to sign in</Link>
        </FieldDescription>
      </Card>
    );
  }

  const preview = invitationQuery.data;
  if (!preview) {
    return null;
  }

  if (!preview.ok) {
    const copy = PREVIEW_FAILURE_COPY[preview.code];
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const inviteEmail = preview.email.trim().toLowerCase();
  const sessionMismatch = Boolean(
    sessionEmail && sessionEmail !== inviteEmail,
  );

  if (sessionMismatch) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            You are signed in as <span className="font-medium">{sessionEmail}</span>{" "}
            but this invite is for{" "}
            <span className="font-medium">{preview.email}</span>. Sign out and
            use the right account, or open this link in a private window.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full" variant="secondary">
            <Link href="/sign-in">Sign out and continue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          Set a password for your account. If you already have a Prime
          account for this email, we verify your existing password, then add
          you to this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">{preview.fullName}</p>
          <p className="text-muted-foreground">{preview.email}</p>
          <div className="mt-2">
            <Badge variant="outline">{roleLabel(preview.role)}</Badge>
          </div>
        </div>
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not accept</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="newPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-new-password">Password</FieldLabel>
                  <Input
                    {...field}
                    id="invite-new-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    New accounts: choose at least 8 characters. Existing
                    users: your current sign-in password.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="invite-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Field className="gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? "Joining workspace…"
                  : "Join workspace / create account"}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              <Link href="/sign-in">Back to sign in</Link>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
