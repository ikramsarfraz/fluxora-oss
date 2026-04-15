"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
import { authClient } from "@/lib/auth-client";

import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "@/app/(auth)/reset-password/components/reset-password-form.schema";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const queryError = searchParams.get("error");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!token) {
      setSubmitError(
        "Missing reset token. Request a new link from forgot password.",
      );
      return;
    }
    setSubmitError(null);
    const { error: err } = await authClient.resetPassword({
      newPassword: data.newPassword,
      token,
    });
    if (err) {
      setSubmitError(err.message ?? "Reset password failed");
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  const { isSubmitting } = form.formState;

  if (queryError === "INVALID_TOKEN") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
          <CardDescription>
            Request a new password reset link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/forgot-password">Request new link</Link>
          </Button>
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
          <CardTitle>Missing reset link</CardTitle>
          <CardDescription>
            Open the link from your email, or request a new reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/forgot-password">Forgot password</Link>
          </Button>
          <FieldDescription className="text-center">
            <Link href="/sign-in">Back to sign in</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Enter and confirm your new password below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="newPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-new-password">
                    New password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="reset-new-password"
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
                  <FieldLabel htmlFor="reset-confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="reset-confirm-password"
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
                {isSubmitting ? "Updating…" : "Update password"}
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
