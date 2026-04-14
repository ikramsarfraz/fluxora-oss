"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from "@/app/forgot-password/components/forgot-password-form.schema";

export function ForgotPasswordForm() {
  const router = useRouter();

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setSubmitError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: "/reset-password",
    });
    if (err) {
      setSubmitError(err.message ?? "Request password reset failed");
      return;
    }
    router.push("/sign-in");
  }

  const { isSubmitting } = form.formState;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Request password reset</CardTitle>
        <CardDescription>
          Enter your email below to request a password reset
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="forgot-password-email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
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
                {isSubmitting
                  ? "Requesting password reset…"
                  : "Request password reset"}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              Remember your password? <Link href="/sign-in">Sign in</Link>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
