"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  AlertCircle,
  Building2,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Google } from "@/components/icons/google";

import { prepareGoogleAuthStartAction } from "@/actions/auth";
import {
  AuthMarketingPanel,
  AuthSplitShell,
} from "@/app/(auth)/components/auth-shell";
import {
  signInFormSchema,
  type SignInFormValues,
} from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  if (!args.tenantSlug) {
    return "Connect with your tenant workspace";
  }

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (raw != null && raw !== "") {
      if (!isRootHost && !isPlatformAdminHost && raw === "/") {
        return "/dashboard";
      }
      return raw;
    }
    if (isRootHost) {
      return "/";
    }
    if (isPlatformAdminHost) {
      return "/admin";
    }
    return "/dashboard";
  }, [isPlatformAdminHost, isRootHost, searchParams]);
  const emailParam = searchParams.get("email") || "";
  const created = searchParams.get("created") === "1";

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
    const postSignInUrl =
      isRootHost && !isPlatformAdminHost
        ? `/select-destination?${new URLSearchParams({
            returnTo: callbackUrl,
          }).toString()}`
        : callbackUrl;
    const { error: err } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: postSignInUrl,
    });
    if (err) {
      setSubmitError(err.message ?? "Sign in failed");
      return;
    }
    router.push(postSignInUrl);
    router.refresh();
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
        topHref={signUpUrl}
        topAction={inactiveTenant ? "Create tenant" : "Invite only"}
      >
        <Card className="w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Building2 className="size-6" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight text-foreground">
                {inactiveTenant ? "Tenant access is inactive" : "Tenant not found"}
              </CardTitle>
              <CardDescription className="text-base leading-7 text-muted-foreground">
                {inactiveTenant ? (
                  <>
                    <span className="font-medium text-foreground">
                      {inactiveTenant.name}
                    </span>{" "}
                    is currently deactivated, so tenant users cannot access this workspace.
                    Contact Pelzer Solutions or your internal platform admin if you believe this
                    tenant should be reactivated.
                  </>
                ) : (
                  <>
                    We couldn&apos;t find an active tenant for{" "}
                    <span className="font-mono text-foreground">{tenantSlug}</span>.
                    Double-check the subdomain or create a new tenant from the main sign-up page.
                  </>
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!inactiveTenant ? (
              <Button asChild className="h-11 w-full">
                <Link href={rootSignUpUrl}>Create a tenant</Link>
              </Button>
            ) : null}
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
        topHref={signUpUrl}
        topAction={isRootHost ? "Sign up" : "Invite only"}
      >
        <Card className="w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]">
          <CardHeader className="space-y-4 pb-5 text-center">
            {!isRootHost && tenant ? (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                <LockKeyhole className="size-4" />
                {tenant.name}
              </div>
            ) : (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
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
              <CardTitle className="text-3xl tracking-tight text-foreground">
                {isPlatformAdminHost
                  ? "Sign in to platform admin"
                  : isRootHost
                    ? "Welcome back"
                    : "Sign in to your workspace"}
              </CardTitle>
              <CardDescription className="text-base leading-7 text-muted-foreground">
                {isPlatformAdminHost
                  ? "Only active platform users can access this internal surface."
                  : isRootHost
                  ? "Sign in once, then choose the tenant workspace or platform admin destination you want to enter."
                  : "Use your email and password to access your tenant workspace."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isRootHost && tenant ? (
              <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-foreground">
                  {tenant.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{tenantPreview}</p>
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
                  Sign in failed
                </AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              {googleEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-2 text-muted-foreground"
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
                        className="h-11 w-full justify-center gap-2 text-muted-foreground"
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
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  or
                </span>
                <Separator className="flex-1" />
              </div>
            </div>

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
                      {isRootHost ? (
                        <FieldDescription>
                          If your account has more than one destination, you&apos;ll choose it after sign-in.
                        </FieldDescription>
                      ) : null}
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
                          className="ml-auto text-sm font-medium text-muted-foreground transition hover:text-foreground"
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
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2.5">
                  <label
                    htmlFor="remember-me"
                    className="flex items-center gap-3 text-sm text-muted-foreground"
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

            <div className="space-y-3 pt-2 text-center">
              <p className="text-sm text-muted-foreground">
                {isRootHost ? "Need a tenant? " : "Need access? "}
                <Link
                  href={signUpUrl}
                  className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
                >
                  {isRootHost ? "Create one" : "Ask your admin"}
                </Link>
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <Link
                  href="/forgot-password"
                  className="transition hover:text-foreground"
                >
                  Forgot password
                </Link>
                <span className="text-border">•</span>
                <a
                  href={supportHref}
                  className="inline-flex items-center gap-1.5 transition hover:text-foreground"
                >
                  <LifeBuoy className="size-4" />
                  Support
                </a>
                <span className="text-border">•</span>
                <Link
                  href={signUpUrl}
                  className="transition hover:text-foreground"
                >
                  {isRootHost ? "Sign up" : "Invite only"}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </AuthSplitShell>
    </TooltipProvider>
  );
}
