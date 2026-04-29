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
  Package,
  Receipt,
  BarChart3,
  Boxes,
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
          ? "Platform Administration"
          : isRootHost
            ? "All-in-one ERP platform"
            : "Secure workspace access"
      }
      title={
        isPlatformAdminHost ? (
          <>
            Manage your
            <br />
            <span className="text-primary">entire platform.</span>
          </>
        ) : isRootHost ? (
          <>
            Run your business.
            <br />
            <span className="text-primary">All in one place.</span>
          </>
        ) : (
          <>
            Welcome back to
            <br />
            <span className="text-primary">{tenant?.name || "your workspace"}.</span>
          </>
        )
      }
      description={
        isPlatformAdminHost
          ? "Access the admin console to manage tenants, users, subscriptions, and platform-wide settings."
          : isRootHost
            ? "PrimeERP helps distribution and wholesale teams manage inventory, sales, purchasing, and finances from a single tenant-isolated platform."
            : "Sign in to access your orders, inventory, invoices, and team collaboration tools."
      }
      features={
        isPlatformAdminHost
          ? [
              {
                icon: <Building2 className="size-5" />,
                title: "Tenant Management",
                description: "Create, configure, and monitor all tenant workspaces from one dashboard.",
              },
              {
                icon: <Users className="size-5" />,
                title: "User Administration",
                description: "Manage platform users, permissions, and access controls.",
              },
              {
                icon: <BarChart3 className="size-5" />,
                title: "Subscription Analytics",
                description: "Track subscription health, usage metrics, and billing across tenants.",
              },
            ]
          : [
              {
                icon: <Boxes className="size-5" />,
                title: "Real-time Inventory",
                description: "Track stock levels, lots, and product movements across locations.",
              },
              {
                icon: <Receipt className="size-5" />,
                title: "Order Management",
                description: "Process sales orders, generate invoices, and manage customer accounts.",
              },
              {
                icon: <Package className="size-5" />,
                title: "Purchasing Control",
                description: "Manage suppliers, track invoices, and optimize procurement.",
              },
              {
                icon: <BarChart3 className="size-5" />,
                title: "Financial Insights",
                description: "Monitor payments, expenses, and profitability in real-time.",
              },
            ]
      }
      testimonial={
        !isPlatformAdminHost
          ? {
              quote: "PrimeERP transformed how we manage our distribution business. What used to take hours now takes minutes.",
              author: "Sarah Chen",
              role: "Operations Director",
              company: "Metro Foods Inc.",
            }
          : undefined
      }
      footerLabel={
        isPlatformAdminHost
          ? "Internal access for platform administrators only."
          : "Trusted by modern distribution, wholesale, and operations teams."
      }
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
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Building2 className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {inactiveTenant ? "Tenant access is inactive" : "Tenant not found"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {inactiveTenant ? (
                <>
                  <span className="font-medium text-foreground">
                    {inactiveTenant.name}
                  </span>{" "}
                  is currently deactivated. Contact support if you believe this
                  tenant should be reactivated.
                </>
              ) : (
                <>
                  We couldn&apos;t find an active tenant for{" "}
                  <span className="font-mono text-foreground">{tenantSlug}</span>.
                  Double-check the subdomain or create a new tenant.
                </>
              )}
            </p>
          </div>
          <div className="space-y-3">
            {!inactiveTenant ? (
              <Button asChild className="h-11 w-full">
                <Link href={rootSignUpUrl}>Create a tenant</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-11 w-full">
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
        side={marketingPanel}
        topLabel="Don&apos;t have an account?"
        topHref={signUpUrl}
        topAction={isRootHost ? "Sign up" : "Invite only"}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            {!isRootHost && tenant ? (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                <LockKeyhole className="size-4" />
                {tenant.name}
              </div>
            ) : (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                {isPlatformAdminHost ? (
                  <>
                    <ShieldCheck className="size-4" />
                    Platform Admin
                  </>
                ) : (
                  <>
                    <Users className="size-4" />
                    Central Login
                  </>
                )}
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isPlatformAdminHost
                ? "Sign in to admin"
                : isRootHost
                  ? "Welcome back"
                  : "Sign in to your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPlatformAdminHost
                ? "Only active platform users can access this console."
                : isRootHost
                  ? "Sign in to access your tenant workspaces."
                  : "Enter your credentials to continue."}
            </p>
          </div>

          {/* Tenant preview for non-root */}
          {!isRootHost && tenant ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {tenant.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tenantPreview}</p>
            </div>
          ) : null}

          {/* Success alert for account creation */}
          {created ? (
            <Alert className="border-emerald-200 bg-emerald-50">
              <ShieldCheck className="size-4 text-emerald-600" />
              <AlertTitle>Tenant created</AlertTitle>
              <AlertDescription>
                Your account and tenant are ready. Sign in to get started.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Error alert */}
          {submitError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Social login */}
          <div className="space-y-3">
            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center gap-2"
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
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-center gap-2"
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
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                or
              </span>
              <Separator className="flex-1" />
            </div>
          </div>

          {/* Email/Password form */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sign-in-email">Email address</FieldLabel>
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
                        You&apos;ll choose your workspace after signing in.
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
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                      <Link
                        href="/forgot-password"
                        className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        Forgot?
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={checked => setRememberMe(Boolean(checked))}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm text-muted-foreground"
                >
                  Keep me signed in
                </label>
              </div>
              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </FieldGroup>
          </form>

          {/* Footer links */}
          <div className="text-center text-sm text-muted-foreground">
            {isRootHost ? "Need a workspace? " : "Need access? "}
            <Link
              href={signUpUrl}
              className="font-medium text-foreground underline underline-offset-2 transition hover:opacity-70"
            >
              {isRootHost ? "Create one" : "Ask your admin"}
            </Link>
          </div>
        </div>
      </AuthSplitShell>
    </TooltipProvider>
  );
}
