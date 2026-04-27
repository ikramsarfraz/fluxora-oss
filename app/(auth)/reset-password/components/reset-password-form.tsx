"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AuthCenteredShell } from "@/app/(auth)/components/auth-shell";
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

const cardClass =
  "w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]";

function CardBrandMark() {
  return (
    <div
      className="mx-auto mb-2 flex size-9 items-center justify-center rounded-[9px] text-[0.8rem] font-extrabold text-white"
      style={{ background: "var(--primary)" }}
    >
      Fx
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const queryError = searchParams.get("error");

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
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
    router.push("/login");
    router.refresh();
  }

  const { isSubmitting } = form.formState;

  if (queryError === "INVALID_TOKEN") {
    return (
      <AuthCenteredShell topLabel="Back to" topHref="/login" topAction="Sign in">
        <Card className={cardClass}>
          <CardHeader className="space-y-2 pb-5 text-center">
            <CardBrandMark />
            <CardTitle className="text-2xl tracking-tight text-foreground">
              Link invalid or expired
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Request a new password reset link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request new link</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
              >
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </AuthCenteredShell>
    );
  }

  if (!token) {
    return (
      <AuthCenteredShell topLabel="Back to" topHref="/login" topAction="Sign in">
        <Card className={cardClass}>
          <CardHeader className="space-y-2 pb-5 text-center">
            <CardBrandMark />
            <CardTitle className="text-2xl tracking-tight text-foreground">
              Missing reset link
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Open the link from your email, or request a new reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Forgot password</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
              >
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </AuthCenteredShell>
    );
  }

  return (
    <AuthCenteredShell topLabel="Back to" topHref="/login" topAction="Sign in">
      <Card className={cardClass}>
        <CardHeader className="space-y-2 pb-5 text-center">
          <CardBrandMark />
          <CardTitle className="text-2xl tracking-tight text-foreground">
            Set a new password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
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
              {submitError ? (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Updating…" : "Update password"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
                >
                  Back to sign in
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}
