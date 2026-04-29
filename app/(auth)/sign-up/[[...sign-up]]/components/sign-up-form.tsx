"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, Building2, CheckCircle2, MailPlus } from "lucide-react";
import { Google } from "@/components/icons/google";

import {
  prepareGoogleAuthStartAction,
  signUpAccountOnlyAction,
} from "@/actions/auth";
import { AuthSplitShell } from "@/app/(auth)/components/auth-shell";
import {
  signUpFormSchema,
  type SignUpFormValues,
} from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

type SignUpFormProps = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  inactiveTenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  isRootHost: boolean;
  rootDomain: string;
  tenantLoginUrl: string;
  rootLoginUrl: string;
  inviteToken: string | null;
  googleEnabled: boolean;
};

type SignUpSuccess = {
  loginUrl: string;
  rootLoginUrl: string;
};

function buildSupportHref(rootDomain: string) {
  const emailDomain =
    rootDomain === "localhost" || rootDomain === "127.0.0.1"
      ? "example.com"
      : rootDomain;

  return `mailto:support@${emailDomain}`;
}

function getPasswordChecks(password: string) {
  return [
    {
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      label: "Includes a number",
      met: /\d/.test(password),
    },
  ];
}

export function SignUpForm({
  tenant,
  inactiveTenant,
  isRootHost,
  rootDomain,
  tenantLoginUrl,
  rootLoginUrl,
  inviteToken,
  googleEnabled,
}: SignUpFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SignUpSuccess | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const password = form.watch("password");
  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const supportHref = useMemo(() => buildSupportHref(rootDomain), [rootDomain]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.location.assign(success.loginUrl);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [success]);

  async function handleGoogleSignUp() {
    setSubmitError(null);
    setIsGoogleLoading(true);
    try {
      const payload = await prepareGoogleAuthStartAction({
        mode: "signup",
        returnTo: "/onboarding",
      });
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: payload.callbackURL,
        newUserCallbackURL: payload.newUserCallbackURL,
        errorCallbackURL: payload.errorCallbackURL,
      });
      if (error) {
        setSubmitError(error.message ?? "Google sign-up failed.");
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Google sign-up failed.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function onSubmit(data: SignUpFormValues) {
    setSubmitError(null);

    try {
      const result = await signUpAccountOnlyAction({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      setSuccess({
        loginUrl: result.loginUrl,
        rootLoginUrl: result.rootLoginUrl,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't create your account.",
      );
    }
  }

  const { isSubmitting } = form.formState;

  if (!isRootHost && (tenant || inactiveTenant)) {
    const requestTenant = tenant ?? inactiveTenant;
    const requestsBlocked = Boolean(inactiveTenant && !tenant);

    return (
      <AuthSplitShell
        topLabel="Already have an account?"
        topHref={tenantLoginUrl}
        topAction="Sign in"
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Building2 className="size-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
              {requestsBlocked ? "Workspace inactive" : "Invite only"}
            </h1>
            <p className="text-sm text-[oklch(0.50_0.02_230)]">
              {requestsBlocked
                ? `${requestTenant?.name ?? "This workspace"} is currently inactive.`
                : "Contact your admin for access."}
            </p>
          </div>
          {inviteToken ? (
            <Alert variant="destructive" className="text-left">
              <AlertCircle className="size-4" />
              <AlertTitle>Invite link invalid</AlertTitle>
              <AlertDescription>
                This invite link is invalid, expired, already used, or does not
                belong to this tenant.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="rounded-2xl border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground">
            Use the invite link from your admin to join this workspace. New
            self-serve workspace creation happens from the root signup flow.
          </div>
          <Button asChild className="h-11 w-full" variant="outline">
            <Link href={tenantLoginUrl}>Back to tenant sign in</Link>
          </Button>
        </div>
      </AuthSplitShell>
    );
  }

  if (success) {
    return (
      <AuthSplitShell
        topLabel="Already have an account?"
        topHref={rootLoginUrl}
        topAction="Sign in"
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
              Account created
            </h1>
            <p className="text-sm text-[oklch(0.50_0.02_230)]">
              Sign in next and we&apos;ll take you to workspace onboarding.
            </p>
          </div>
          <Button asChild className="h-10 w-full">
            <Link href={success.loginUrl}>Continue to sign in</Link>
          </Button>
          <p className="text-sm text-[oklch(0.55_0.02_230)]">
            <Link
              href={success.rootLoginUrl}
              className="font-medium text-[oklch(0.30_0.03_230)] underline underline-offset-2 transition hover:opacity-70"
            >
              Back to login
            </Link>
          </p>
        </div>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      topLabel="Already have an account?"
      topHref={rootLoginUrl}
      topAction="Sign in"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
            Create your account
          </h1>
          <p className="text-sm text-[oklch(0.50_0.02_230)]">
            Create your login first. Workspace setup happens right after you
            sign in.
          </p>
        </div>

        {submitError ? (
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="size-4" />
            <AlertTitle>Sign up failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        {googleEnabled ? (
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-center gap-2 text-muted-foreground"
              disabled={isGoogleLoading}
              onClick={handleGoogleSignUp}
            >
              <Google className="size-4" />
              {isGoogleLoading ? "Redirecting to Google…" : "Sign up with Google"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              After Google sign-in, you&apos;ll create your workspace in onboarding.
            </p>
          </div>
        ) : null}

        {googleEnabled ? (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="sign-up-name">Full name</FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-name"
                    type="text"
                    placeholder="Jane Doe"
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
                  <FieldLabel htmlFor="sign-up-email">Email address</FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
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
                    placeholder="Create a password"
                    aria-invalid={fieldState.invalid}
                  />
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
                    Confirm password
                  </FieldLabel>
                  <Input
                    {...field}
                    id="sign-up-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">
                Password guidance
              </p>
              <div className="mt-3 space-y-2">
                {passwordChecks.map(check => (
                  <div
                    key={check.label}
                    className={`flex items-center gap-2 text-sm ${
                      check.met ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className="size-4" />
                    {check.label}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>

            <div className="space-y-2 pt-1 text-center text-sm text-muted-foreground">
              <p>
                By creating an account, you agree to our terms of service and
                privacy policy.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href={rootLoginUrl}
                  className="transition hover:text-foreground"
                >
                  Sign in
                </Link>
                <span className="text-border">•</span>
                <a
                  href={supportHref}
                  className="inline-flex items-center gap-1.5 transition hover:text-foreground"
                >
                  <MailPlus className="size-4" />
                  Support
                </a>
              </div>
            </div>
          </FieldGroup>
        </form>
      </div>
    </AuthSplitShell>
  );
}
