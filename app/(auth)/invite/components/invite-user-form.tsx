"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  acceptInvitationRequest,
  fetchInvitationPreview,
} from "@/lib/api/invitations";
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

import {
  inviteAcceptFormSchema,
  type InviteAcceptFormValues,
} from "./invite-user-form.schema";

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function InviteUserForm() {
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

  if (invitationQuery.isError || !invitationQuery.data) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
          <CardDescription>
            This invitation may have been used, revoked, or expired. Ask an
            administrator for a new invite.
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

  const preview = invitationQuery.data;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          Set a password for your account. You can sign in after verifying your
          email if required.
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
                    Must be at least 8 characters long.
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
              {submitError ? (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create account"}
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
