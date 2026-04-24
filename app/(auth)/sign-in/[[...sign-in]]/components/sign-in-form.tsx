"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Google } from "@/components/icons/google";

import { discoverTenantsForEmailAction, prepareGoogleAuthStartAction } from "@/actions/auth";
import {
  AuthMarketingPanel,
  AuthSplitShell,
} from "@/app/(auth)/components/auth-shell";
import {
  signInFormSchema,
  type SignInFormValues,
} from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import type { TenantDiscoveryItem } from "@/services/auth";

type SignInFormProps = {
  tenant: {
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
  if (!args.tenantSlug) {
    return "Connect with your tenant workspace";
  }

  const portSuffix = args.port ? `:${args.port}` : "";
  return `${args.protocol}://${args.tenantSlug}.${args.rootDomain}${portSuffix}`;
}

export function SignInForm({
  tenant,
  tenantSlug,
  isRootHost,
  isPlatformAdminHost,
  rootDomain,
  protocol,
  port,
  rootSignUpUrl,
  googleEnabled,
}: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const emailParam = searchParams.get("email") || "";
  const created = searchParams.get("created") === "1";

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discoveryEmail, setDiscoveryEmail] = useState(emailParam);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [tenantMatches, setTenantMatches] = useState<TenantDiscoveryItem[]>([]);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: emailParam,
      password: "",
    },
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
    const { error: err } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: callbackUrl,
    });
    if (err) {
      setSubmitError(err.message ?? "Sign in failed");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  const { isSubmitting } = form.formState;

  async function onDiscoverTenant() {
    setSubmitError(null);
    setTenantMatches([]);

    if (!discoveryEmail.trim()) {
      setSubmitError("Please enter your email.");
      return;
    }

    setIsDiscovering(true);
    try {
      const discovered = await discoverTenantsForEmailAction({
        email: discoveryEmail,
        callbackUrl,
      });

      if (discovered.length === 0) {
        setSubmitError(
          "We couldn't find a tenant for that email. Create a new account or check the address and try again.",
        );
        return;
      }

      if (discovered.length === 1) {
        window.location.assign(discovered[0].loginUrl);
        return;
      }

      setTenantMatches(discovered);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Tenant lookup failed. Please try again.",
      );
    } finally {
      setIsDiscovering(false);
    }
  }

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
      if (error) {
        setSubmitError(error.message ?? "Google sign-in failed.");
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Google sign-in failed.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  }

  const marketingPanel = (
    <AuthMarketingPanel
      eyebrow={
        isPlatformAdminHost
          ? "Internal Pelzer Solutions access"
          : isRootHost
            ? "All-in-one ERP for growing teams"
            : "Secure tenant access"
      }
      title={
        <>
          {isPlatformAdminHost ? "Operate the platform." : "Run your business."}
          <br />
          <span className="text-blue-600">
            {isPlatformAdminHost
              ? "Internal admin sign-in."
              : isRootHost
              ? "Find the right workspace."
              : "Sign in with confidence."}
          </span>
        </>
      }
      description={
        isPlatformAdminHost
          ? "Use your internal platform account to review tenants, platform users, and subscriptions from the reserved admin host."
          : isRootHost
          ? "PrimeERP helps teams manage finance, sales, receiving, inventory, and operations from one tenant-isolated platform."
          : "Access your tenant workspace with the same secure flow used across orders, receiving, invoicing, and payments."
      }
      features={[
        {
          title: "Tenant-isolated by design",
          description:
            "Each business gets its own subdomain, session context, and workspace permissions.",
        },
        {
          title: "Operationally complete",
          description:
            "Sales orders, supplier invoices, lots, inventory, and payments stay in one workflow.",
        },
        {
          title: "Built for teams",
          description:
            "Owners, operators, and finance users can collaborate without stepping on each other.",
        },
      ]}
      footerLabel="Designed for modern distribution, wholesale, and operations teams."
    />
  );

  if (!isRootHost && tenantSlug && !tenant) {
    return (
      <AuthSplitShell
        side={marketingPanel}
        topLabel="Need an account?"
        topHref={rootSignUpUrl}
        topAction="Sign up"
      >
        <Card className="w-full max-w-[520px] border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Building2 className="size-6" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight text-slate-950">
                Tenant not found
              </CardTitle>
              <CardDescription className="text-base leading-7 text-slate-500">
                We couldn&apos;t find an active tenant for{" "}
                <span className="font-mono text-slate-900">{tenantSlug}</span>.
                Double-check the subdomain or create a new tenant from the main
                sign-up page.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="h-11 w-full">
              <Link href={rootSignUpUrl}>Create a tenant</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full">
              <a href={supportHref}>Contact support</a>
            </Button>
          </CardContent>
        </Card>
      </AuthSplitShell>
    );
  }

  return (
    <TooltipProvider>
      <AuthSplitShell
        side={marketingPanel}
        topLabel="Don't have an account?"
        topHref={rootSignUpUrl}
        topAction="Sign up"
      >
        <Card className="w-full max-w-[520px] border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <CardHeader className="space-y-4 pb-5 text-center">
            {!isRootHost && tenant ? (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <LockKeyhole className="size-4" />
                {tenant.name}
              </div>
            ) : (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                {isPlatformAdminHost ? (
                  <>
                    <ShieldCheck className="size-4" />
                    Platform admin
                  </>
                ) : (
                  <>
                    <Users className="size-4" />
                    Central login
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight text-slate-950">
                {isPlatformAdminHost
                  ? "Sign in to platform admin"
                  : isRootHost
                    ? "Welcome back"
                    : "Sign in to your workspace"}
              </CardTitle>
              <CardDescription className="text-base leading-7 text-slate-500">
                {isPlatformAdminHost
                  ? "Only active platform users can access this internal surface."
                  : isRootHost
                  ? "Enter your email and we'll route you to the right tenant sign-in page."
                  : "Use your email and password to access your tenant workspace."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isRootHost && tenant ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left">
                <p className="text-sm font-medium text-slate-900">
                  {tenant.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{tenantPreview}</p>
              </div>
            ) : null}

            {created ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-left">
                <ShieldCheck className="size-4 text-emerald-600" />
                <AlertTitle>Tenant created</AlertTitle>
                <AlertDescription>
                  Your account and tenant are ready. If your email still needs
                  verification, finish that first and then sign in here.
                </AlertDescription>
              </Alert>
            ) : null}

            {submitError ? (
              <Alert variant="destructive" className="text-left">
                <AlertCircle className="size-4" />
                <AlertTitle>
                  {isRootHost ? "Tenant lookup failed" : "Sign in failed"}
                </AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              {googleEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 text-slate-600"
                  disabled={isGoogleLoading}
                  onClick={handleGoogleSignIn}
                >
                  <Google className="size-4" />
                  {isGoogleLoading ? "Redirecting to Google…" : "Continue with Google"}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full justify-center gap-2 text-slate-600"
                        disabled
                      >
                        <Google className="size-4" />
                        Continue with Google
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Google sign-in is not configured for this deployment.
                  </TooltipContent>
                </Tooltip>
              )}
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  or
                </span>
                <Separator className="flex-1" />
              </div>
            </div>

            {isRootHost && !isPlatformAdminHost ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="tenant-discovery-email">
                    Work email
                  </FieldLabel>
                  <Input
                    id="tenant-discovery-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={discoveryEmail}
                    onChange={event => {
                      setDiscoveryEmail(event.target.value);
                      setSubmitError(null);
                    }}
                  />
                  <FieldDescription>
                    If you belong to more than one tenant, you&apos;ll choose
                    one next.
                  </FieldDescription>
                </Field>
                <Button
                  type="button"
                  className="h-11 w-full gap-2"
                  disabled={isDiscovering}
                  onClick={onDiscoverTenant}
                >
                  {isDiscovering ? "Finding your workspace…" : "Continue"}
                  <ArrowRight className="size-4" />
                </Button>
                {tenantMatches.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        Choose your tenant
                      </p>
                      <p className="text-sm text-slate-500">
                        We found multiple tenants for this email.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {tenantMatches.map(match => (
                        <Button
                          key={match.tenantId}
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-between rounded-xl px-4 py-3"
                          onClick={() => window.location.assign(match.loginUrl)}
                        >
                          <div className="text-left">
                            <p className="font-medium text-slate-900">
                              {match.tenantName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {match.tenantSlug}.{rootDomain}
                            </p>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {match.role}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </FieldGroup>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <FieldGroup>
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="sign-in-email">
                          Email address
                        </FieldLabel>
                        <Input
                          {...field}
                          id="sign-in-email"
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
                        <div className="flex items-center">
                          <FieldLabel htmlFor="sign-in-password">
                            Password
                          </FieldLabel>
                          <Link
                            href="/forgot-password"
                            className="ml-auto text-sm font-medium text-blue-600 transition hover:text-blue-700"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <Input
                          {...field}
                          id="sign-in-password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <label
                      htmlFor="remember-me"
                      className="flex items-center gap-3 text-sm text-slate-600"
                    >
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={checked =>
                          setRememberMe(Boolean(checked))
                        }
                      />
                      Keep me signed in on this device
                    </label>
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </FieldGroup>
              </form>
            )}

            <div className="space-y-3 pt-2 text-center">
              <p className="text-sm text-slate-500">
                Need a tenant?{" "}
                <Link
                  href={rootSignUpUrl}
                  className="font-medium text-blue-600 transition hover:text-blue-700"
                >
                  Create one
                </Link>
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                <Link
                  href="/forgot-password"
                  className="transition hover:text-slate-700"
                >
                  Forgot password
                </Link>
                <span className="text-slate-300">•</span>
                <a
                  href={supportHref}
                  className="inline-flex items-center gap-1.5 transition hover:text-slate-700"
                >
                  <LifeBuoy className="size-4" />
                  Support
                </a>
                <span className="text-slate-300">•</span>
                <Link
                  href={rootSignUpUrl}
                  className="transition hover:text-slate-700"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </AuthSplitShell>
    </TooltipProvider>
  );
}
