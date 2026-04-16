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
import { GoogleAuthButton } from "@/components/google-auth-button";
import { authClient } from "@/lib/auth-client";
import { createPortalUser } from "@/lib/api/portal-users";

import {
  signUpFormSchema,
  type SignUpFormValues,
} from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: SignUpFormValues) {
    setSubmitError(null);
    const { data: signUpData, error: err } = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    if (err || !signUpData?.user?.id) {
      setSubmitError(err?.message || "Sign up failed");
      return;
    }

    try {
      await createPortalUser({
        authUserId: signUpData.user.id,
        fullName: data.name,
        email: data.email,
        role: "admin",
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create portal user",
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  const { isSubmitting } = form.formState;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {submitError ? (
            <Alert variant="destructive" className="max-w-md mb-4">
              <AlertCircle />
              <AlertTitle>Sign up failed</AlertTitle>
              <AlertDescription>
                We couldn&apos;t create your account. Please verify your name,
                email, and password, and ensure both passwords match.
              </AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sign-up-name">Full Name</FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-name"
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-email"
                    type="email"
                    placeholder="m@example.com"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    We&apos;ll use this to contact you. We will not share your
                    email with anyone else.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-password"
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
                  <FieldLabel htmlFor="sign-up-confirm-password">
                    Confirm Password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Please confirm your password.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <FieldGroup>
              <Field className="gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create Account"}
                </Button>
                <GoogleAuthButton
                  callbackURL={callbackUrl}
                  label="Sign up with Google"
                  onError={setSubmitError}
                />
                <FieldDescription className="px-6 text-center">
                  Already have an account? <Link href="/sign-in">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
