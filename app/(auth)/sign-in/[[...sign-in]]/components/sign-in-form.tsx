"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  AlertCircle,
  Building2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Google } from "@/components/icons/google";

import { prepareGoogleAuthStartAction } from "@/actions/auth";
import { AuthSplitShell } from "@/app/(auth)/components/auth-shell";
import {
  signInFormSchema,
  type SignInFormValues,
} from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";

type SignInFormProps = {
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
  tenantSlug: string | null;
  isRootHost: boolean;
  isPlatformAdminHost: boolean;
  rootDomain: string;
  protocol: "http" | "https";
  port: string | null;
  rootSignUpUrl: string;
  signUpUrl: string;
  googleEnabled: boolean;
};

function buildSupportHref(rootDomain: string) {
  const emailDomain =
    rootDomain === "localhost" || rootDomain === "127.0.0.1"
      ? "example.com"
      : rootDomain;
  return `mailto:support@${emailDomain}`;
}

function buildTenantPreview(args: {
  tenantSlug: string;
  protocol: "http" | "https";
  rootDomain: string;
  port: string | null;
}) {
  if (!args.tenantSlug) return "";
  const portSuffix = args.port ? `:${args.port}` : "";
  return `${args.protocol}://${args.tenantSlug}.${args.rootDomain}${portSuffix}`;
}

export function SignInForm({
  tenant,
  inactiveTenant,
  tenantSlug,
  isRootHost,
  isPlatformAdminHost,
  rootDomain,
  protocol,
  port,
  rootSignUpUrl,
  signUpUrl,
  googleEnabled,
}: SignInFormProps) {
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (raw != null && raw !== "") {
      if (!isRootHost && !isPlatformAdminHost && raw === "/") {
        return "/dashboard";
      }
      return raw;
    }
    if (isRootHost) return "/";
    if (isPlatformAdminHost) return "/admin";
    return "/dashboard";
  }, [isPlatformAdminHost, isRootHost, searchParams]);
  const emailParam = searchParams.get("email") || "";
  const created = searchParams.get("created") === "1";

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: emailParam },
  });

  const supportHref = useMemo(() => buildSupportHref(rootDomain), [rootDomain]);
  const tenantPreview = useMemo(
    () =>
      buildTenantPreview({
        tenantSlug: tenant?.slug ?? tenantSlug ?? "",
        protocol,
        rootDomain,
        port,
      }),
    [port, protocol, rootDomain, tenant?.slug, tenantSlug],
  );

  async function onSubmit(data: SignInFormValues) {
    setSubmitError(null);
    const origin =
      typeof window === "undefined" ? "" : window.location.origin;

    const postSignInPath =
      isRootHost && !isPlatformAdminHost
        ? `/select-destination?${new URLSearchParams({ returnTo: callbackUrl }).toString()}`
        : callbackUrl.startsWith("/")
          ? callbackUrl
          : `/${callbackUrl}`;

    const callbackFull = `${origin}${postSignInPath}`;
    const newUserCb =
      isRootHost && !isPlatformAdminHost
        ? `${origin}/onboarding`
        : callbackFull;

    const { error } = await authClient.signIn.magicLink({
      email: data.email.trim(),
      callbackURL: callbackFull,
      newUserCallbackURL: newUserCb,
      errorCallbackURL: `${origin}/login?${new URLSearchParams({ error: "magic_link" })}`,
    });
    if (error) {
      setSubmitError(error.message ?? "Could not send sign-in link.");
      return;
    }
    setLinkSent(true);
  }

  const { isSubmitting } = form.formState;

  async function handleGoogleSignIn() {
    setSubmitError(null);
    setIsGoogleLoading(true);
    try {
      const payload = await prepareGoogleAuthStartAction({
        mode: "login",
        returnTo: callbackUrl,
        tenantSlug: tenantSlug ?? undefined,
      });
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: payload.callbackURL,
        newUserCallbackURL: payload.newUserCallbackURL,
        errorCallbackURL: payload.errorCallbackURL,
      });
      if (error) setSubmitError(error.message ?? "Google sign-in failed.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setIsGoogleLoading(false);
    }
  }


  // Email linkSent confirmation
  if (linkSent) {
    return (
      <TooltipProvider>
        <AuthSplitShell
          formPosition="left"
          topLabel="Don't have an account?"
          topHref={signUpUrl}
          topAction={isRootHost ? "Sign up" : "Invite only"}
        >
          <div className="space-y-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
                Check your email
              </h1>
              <p className="text-sm text-[oklch(0.50_0.02_230)]">
                We sent a secure sign-in link. Open it in this browser on the same
                device to continue.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={() => {
                setLinkSent(false);
                setSubmitError(null);
              }}
            >
              Try a different email
            </Button>
          </div>
        </AuthSplitShell>
      </TooltipProvider>
    );
  }

  // Tenant not found state
  if (!isRootHost && tenantSlug && !tenant) {
    return (
      <AuthSplitShell
        formPosition="left"
        topLabel="Need an account?"
        topHref={signUpUrl}
        topAction={inactiveTenant ? "Create tenant" : "Invite only"}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Building2 className="size-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
              {inactiveTenant ? "Tenant inactive" : "Tenant not found"}
            </h1>
            <p className="text-sm text-[oklch(0.50_0.02_230)]">
              {inactiveTenant
                ? `${inactiveTenant.name} is currently deactivated.`
                : `No active tenant for "${tenantSlug}".`}
            </p>
          </div>
          <div className="space-y-2">
            {!inactiveTenant && (
              <Button asChild className="h-10 w-full">
                <Link href={rootSignUpUrl}>Create a tenant</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-10 w-full">
              <a href={supportHref}>Contact support</a>
            </Button>
          </div>
        </div>
      </AuthSplitShell>
    );
  }

  return (
    <TooltipProvider>
      <AuthSplitShell
        formPosition="left"
        topLabel="Don't have an account?"
        topHref={signUpUrl}
        topAction={isRootHost ? "Sign up" : "Invite only"}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-1">
            {!isRootHost && tenant ? (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.01_230)] px-2.5 py-1 text-xs font-medium text-[oklch(0.40_0.03_230)]">
                <LockKeyhole className="size-3" />
                {tenant.name}
              </div>
            ) : isPlatformAdminHost ? (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.01_230)] px-2.5 py-1 text-xs font-medium text-[oklch(0.40_0.03_230)]">
                <ShieldCheck className="size-3" />
                Admin Console
              </div>
            ) : null}
            <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
              Sign in
            </h1>
            <p className="text-sm text-[oklch(0.50_0.02_230)]">
              {isPlatformAdminHost
                ? "Access the platform admin console."
                : isRootHost
                  ? "We&apos;ll email you a sign-in link. New users finish workspace setup afterward."
                  : "We&apos;ll email you a sign-in link."}
            </p>
          </div>

          {/* Tenant preview */}
          {!isRootHost && tenant && tenantPreview && (
            <div className="rounded-lg border border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.005_230)] px-3 py-2.5">
              <p className="text-sm font-medium text-[oklch(0.25_0.03_230)]">{tenant.name}</p>
              <p className="text-xs text-[oklch(0.55_0.02_230)]">{tenantPreview}</p>
            </div>
          )}

          {/* Success alert */}
          {created && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <ShieldCheck className="size-4 text-emerald-600" />
              <AlertTitle>Workspace ready</AlertTitle>
              <AlertDescription>Sign in to get started.</AlertDescription>
            </Alert>
          )}

          {/* Error alert */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Social login */}
          <div className="space-y-3">
            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full gap-2"
                disabled={isGoogleLoading}
                onClick={handleGoogleSignIn}
              >
                <Google className="size-4" />
                {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button type="button" variant="outline" className="h-10 w-full gap-2" disabled>
                      <Google className="size-4" />
                      Continue with Google
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Google sign-in is not configured.</TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-[oklch(0.55_0.02_230)]">or</span>
              <Separator className="flex-1" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="sign-in-email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    {isRootHost ? (
                      <FieldDescription>
                        You&apos;ll pick your workspace from the destinations list after
                        you sign in.
                      </FieldDescription>
                    ) : null}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </FieldGroup>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-[oklch(0.55_0.02_230)]">
            {isRootHost ? "Need a workspace? " : "Need access? "}
            <Link
              href={signUpUrl}
              className="font-medium text-[oklch(0.30_0.03_230)] underline underline-offset-2 transition hover:opacity-70"
            >
              {isRootHost ? "Create one" : "Ask your admin"}
            </Link>
          </p>
        </div>
      </AuthSplitShell>
    </TooltipProvider>
  );
}
