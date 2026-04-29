"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  MailPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { Google } from "@/components/icons/google";

import {
  prepareGoogleAuthStartAction,
  signUpBusinessTenantAccountAction,
  signUpSoloTenantAccountAction,
} from "@/actions/auth";
import {
  AuthSplitShell,
  AuthStepperPanel,
} from "@/app/(auth)/components/auth-shell";
import {
  signUpFormSchema,
  type SignUpFormValues,
} from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form.schema";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  protocol: "http" | "https";
  port: string | null;
  rootLoginUrl: string;
  tenantLoginUrl: string;
  inviteToken: string | null;
  googleEnabled: boolean;
};

type TeamInvite = {
  id: string;
  email: string;
  role: "member" | "admin";
};

type SignUpSuccess = {
  tenantName: string;
  tenantSlug: string;
  loginUrl: string;
  rootLoginUrl: string;
};

const RESERVED_TENANT_SLUGS = new Set(["www", "localhost"]);

const SIGN_UP_STEPS = [
  {
    id: "account",
    title: "Account details",
    description:
      "Create your login and choose whether this is a solo or team setup.",
  },
  {
    id: "tenant",
    title: "Workspace",
    description: "Choose the tenant name and subdomain your team will use.",
  },
  {
    id: "company",
    title: "Company details",
    description: "Add basic business context to personalize your onboarding.",
  },
  {
    id: "team",
    title: "Invite your team",
    description:
      "Prepare teammate invites so you can onboard faster after setup.",
  },
  {
    id: "review",
    title: "Review & create",
    description:
      "Confirm everything before we provision your tenant workspace.",
  },
] as const;

const INDUSTRY_OPTIONS = [
  "Food distribution",
  "Wholesale",
  "Retail",
  "Manufacturing",
  "Logistics",
  "Other",
];

const COMPANY_SIZE_OPTIONS = [
  "Just me",
  "2-10 employees",
  "11-50 employees",
  "51-200 employees",
  "200+ employees",
];

const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "Mexico",
  "United Kingdom",
  "Other",
];

const CURRENCY_OPTIONS = ["USD", "CAD", "EUR", "GBP", "MXN"];

function slugifyTenantInput(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "";
}

function buildSupportHref(rootDomain: string) {
  const emailDomain =
    rootDomain === "localhost" || rootDomain === "127.0.0.1"
      ? "example.com"
      : rootDomain;

  return `mailto:support@${emailDomain}`;
}

function buildTenantPreview(args: {
  slug: string;
  protocol: "http" | "https";
  rootDomain: string;
  port: string | null;
}) {
  if (!args.slug) {
    return `${args.protocol}://your-tenant.${args.rootDomain}${args.port ? `:${args.port}` : ""}`;
  }

  return `${args.protocol}://${args.slug}.${args.rootDomain}${args.port ? `:${args.port}` : ""}`;
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
  protocol,
  port,
  rootLoginUrl,
  tenantLoginUrl,
  inviteToken,
  googleEnabled,
}: SignUpFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [success, setSuccess] = useState<SignUpSuccess | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      accountType: "business",
      name: "",
      email: "",
      tenantName: "",
      tenantSlug: "",
      companyName: "",
      industry: "",
      companySize: "",
      countryRegion: "",
      currency: "USD",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const accountType = form.watch("accountType");
  const password = form.watch("password");
  const tenantName = form.watch("tenantName") ?? "";
  const tenantSlug = form.watch("tenantSlug") ?? "";
  const name = form.watch("name");
  const email = form.watch("email");
  const companyName = form.watch("companyName");
  const companySize = form.watch("companySize");
  const countryRegion = form.watch("countryRegion");
  const currency = form.watch("currency");
  const industry = form.watch("industry");

  const derivedSoloSlug = useMemo(
    () => slugifyTenantInput(name || email.split("@")[0] || "tenant"),
    [email, name],
  );
  const slugPreview = useMemo(
    () =>
      buildTenantPreview({
        slug: accountType === "business" ? tenantSlug : derivedSoloSlug,
        protocol,
        rootDomain,
        port,
      }),
    [accountType, derivedSoloSlug, port, protocol, rootDomain, tenantSlug],
  );
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

  const stepFields: Record<number, Array<keyof SignUpFormValues>> = {
    0: ["accountType", "name", "email", "password", "confirmPassword"],
    1: accountType === "business" ? ["tenantName", "tenantSlug"] : [],
    2: [],
    3: [],
    4: [],
  };

  async function goToNextStep() {
    setSubmitError(null);

    if (currentStep === 1 && accountType === "business") {
      const normalizedSlug = slugifyTenantInput(
        form.getValues("tenantSlug") ?? "",
      );
      form.setValue("tenantSlug", normalizedSlug, {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (normalizedSlug && RESERVED_TENANT_SLUGS.has(normalizedSlug)) {
        form.setError("tenantSlug", {
          type: "manual",
          message: "That tenant slug is reserved. Please choose another.",
        });
        return;
      }
    }

    const isValid = await form.trigger(stepFields[currentStep] ?? [], {
      shouldFocus: true,
    });

    if (!isValid) {
      return;
    }

    setCurrentStep(step => Math.min(step + 1, SIGN_UP_STEPS.length - 1));
  }

  function goToPreviousStep() {
    setSubmitError(null);
    setCurrentStep(step => Math.max(step - 1, 0));
  }

  function addTeamInvite() {
    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setSubmitError("Please enter a valid teammate email before adding it.");
      return;
    }

    if (teamInvites.some(invite => invite.email === normalizedEmail)) {
      setSubmitError("That teammate email is already in the invite list.");
      return;
    }

    setTeamInvites(invites => [
      ...invites,
      {
        id: `${normalizedEmail}-${Date.now()}`,
        email: normalizedEmail,
        role: inviteRole,
      },
    ]);
    setInviteEmail("");
    setInviteRole("member");
    setSubmitError(null);
  }

  function removeTeamInvite(id: string) {
    setTeamInvites(invites => invites.filter(invite => invite.id !== id));
  }

  async function handleGoogleSignUp() {
    setSubmitError(null);
    setIsGoogleLoading(true);
    try {
      const payload = await prepareGoogleAuthStartAction({
        mode: "signup",
        signupType: "solo",
        returnTo: "/",
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

    const normalizedSlug = slugifyTenantInput(data.tenantSlug ?? "");
    if (data.accountType === "business") {
      if (RESERVED_TENANT_SLUGS.has(normalizedSlug)) {
        form.setError("tenantSlug", {
          type: "manual",
          message: "That tenant slug is reserved. Please choose another.",
        });
        setCurrentStep(1);
        return;
      }
    }

    try {
      const result =
        data.accountType === "business"
          ? await signUpBusinessTenantAccountAction({
              name: data.name,
              email: data.email,
              password: data.password,
              tenantName: data.tenantName ?? "",
              tenantSlug: normalizedSlug,
            })
          : await signUpSoloTenantAccountAction({
              name: data.name,
              email: data.email,
              password: data.password,
            });

      setSuccess({
        tenantName: result.tenantName,
        tenantSlug: result.tenantSlug,
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

  const sidebar = (
    <AuthStepperPanel
      currentStep={success ? SIGN_UP_STEPS.length - 1 : currentStep}
      steps={Array.from(SIGN_UP_STEPS)}
    />
  );

  if (!isRootHost && (tenant || inactiveTenant)) {
    const requestTenant = tenant ?? inactiveTenant;
    const requestsBlocked = Boolean(inactiveTenant && !tenant);

    return (
      <TooltipProvider>
        <AuthSplitShell
          side={
            <AuthStepperPanel
              currentStep={0}
              steps={[
                {
                  id: "invite-only",
                  title: requestsBlocked ? "Tenant inactive" : "Invite only",
                  description: requestsBlocked
                    ? "This workspace is inactive, so new access requests are blocked."
                    : "Ask your admin for an invitation link.",
                },
              ]}
            />
          }
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
            <div className="space-y-5">
              <Alert className="border-amber-200 bg-amber-50 text-left">
                <Building2 className="size-4 text-amber-600" />
                <AlertTitle>{requestTenant?.name}</AlertTitle>
                <AlertDescription>
                  Workspace URL:{" "}
                  {buildTenantPreview({
                    slug: requestTenant?.slug ?? "",
                    protocol,
                    rootDomain,
                    port,
                  })}
                </AlertDescription>
              </Alert>

              {requestsBlocked ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground">
                    Ask your internal administrator to reactivate this tenant
                    before requesting access.
                  </div>
                  <Button asChild className="h-11 w-full" variant="outline">
                    <Link href={tenantLoginUrl}>Back to tenant sign in</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {inviteToken ? (
                    <Alert variant="destructive" className="text-left">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Invite link invalid</AlertTitle>
                      <AlertDescription>
                        This invite link is invalid, expired, already used, or
                        does not belong to this tenant.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="rounded-2xl border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground">
                    Ask your admin for an invite.
                  </div>
                  <div className="space-y-3">
                    <Button asChild className="h-11 w-full" variant="outline">
                      <Link href={tenantLoginUrl}>Back to tenant sign in</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AuthSplitShell>
      </TooltipProvider>
    );
  }

  if (success) {
    return (
      <TooltipProvider>
        <AuthSplitShell
          side={sidebar}
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
                Workspace ready
              </h1>
              <p className="text-sm text-[oklch(0.50_0.02_230)]">
                Redirecting to {success.tenantName}...
              </p>
            </div>
            <div className="rounded-lg border border-[oklch(0.92_0.01_230)] bg-[oklch(0.98_0.005_230)] px-3 py-2.5 text-left">
              <p className="text-sm font-medium text-[oklch(0.25_0.03_230)]">
                {success.tenantName}
              </p>
              <p className="text-xs text-[oklch(0.55_0.02_230)]">
                {buildTenantPreview({ slug: success.tenantSlug, protocol, rootDomain, port })}
              </p>
            </div>
            <Button asChild className="h-10 w-full">
              <Link href={success.loginUrl}>Go to workspace</Link>
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
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <AuthSplitShell
        side={sidebar}
        topLabel="Already have an account?"
        topHref={rootLoginUrl}
        topAction="Sign in"
      >
        <div className="w-full">
          <div className="space-y-1 pb-6">
            <p className="text-xs font-medium text-[oklch(0.55_0.02_230)]">
              Step {currentStep + 1} of {SIGN_UP_STEPS.length}
            </p>
            <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
              {currentStep === 0 && "Create your account"}
              {currentStep === 1 && "Name your workspace"}
              {currentStep === 2 && "Company details"}
              {currentStep === 3 && "Invite teammates"}
              {currentStep === 4 && "Review & create"}
            </h1>
          </div>
          <div>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                {!isRootHost && tenant ? (
                  <Alert className="border-amber-200 bg-amber-50 text-left">
                    <Building2 className="size-4 text-amber-600" />
                    <AlertTitle>You&apos;re on {tenant.name}</AlertTitle>
                    <AlertDescription>
                      This signup flow creates a separate tenant account. If you
                      meant to access {tenant.name}, head back to sign in
                      instead.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {submitError ? (
                  <Alert variant="destructive" className="text-left">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Sign up failed</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                ) : null}

                {currentStep === 0 ? (
                  <>
                    <Field className="gap-3">
                      <FieldLabel>Account type</FieldLabel>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          className={`rounded-2xl border p-4 text-left transition ${
                            accountType === "business"
                              ? "border-primary bg-muted shadow-[0_4px_12px_oklch(0_0_0/0.08)]"
                              : "border-border bg-white hover:border-border"
                          }`}
                          onClick={() => {
                            form.setValue("accountType", "business");
                            form.clearErrors(["tenantName", "tenantSlug"]);
                          }}
                        >
                          <p className="font-medium text-foreground">
                            Business / Team
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Choose your workspace name and invite your team
                            later.
                          </p>
                        </button>
                        <button
                          type="button"
                          className={`rounded-2xl border p-4 text-left transition ${
                            accountType === "solo"
                              ? "border-primary bg-muted shadow-[0_4px_12px_oklch(0_0_0/0.08)]"
                              : "border-border bg-white hover:border-border"
                          }`}
                          onClick={() => {
                            form.setValue("accountType", "solo");
                            form.clearErrors(["tenantName", "tenantSlug"]);
                          }}
                        >
                          <p className="font-medium text-foreground">
                            Solo / Freelancer
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            We&apos;ll create a personal tenant automatically
                            for you.
                          </p>
                        </button>
                      </div>
                    </Field>

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
                          {isGoogleLoading
                            ? "Redirecting to Google…"
                            : "Sign up with Google"}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                          Creates a personal workspace automatically. For a
                          business workspace, use email/password below.
                        </p>
                      </div>
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
                              Sign up with Google
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

                    <Controller
                      name="name"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="sign-up-name">
                            Full name
                          </FieldLabel>
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
                          <FieldLabel htmlFor="sign-up-email">
                            Email address
                          </FieldLabel>
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
                          <FieldLabel htmlFor="sign-up-password">
                            Password
                          </FieldLabel>
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
                            <Check className="size-4" />
                            {check.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {currentStep === 1 ? (
                  <>
                    {accountType === "business" ? (
                      <>
                        <Controller
                          name="tenantName"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor="tenant-name">
                                Workspace name
                              </FieldLabel>
                              <Input
                                {...field}
                                id="tenant-name"
                                type="text"
                                placeholder="Acme Distribution"
                                aria-invalid={fieldState.invalid}
                                onChange={event => {
                                  field.onChange(event);
                                  const currentSlug =
                                    form.getValues("tenantSlug");
                                  if (!currentSlug) {
                                    form.setValue(
                                      "tenantSlug",
                                      slugifyTenantInput(event.target.value),
                                      {
                                        shouldDirty: true,
                                      },
                                    );
                                  }
                                }}
                              />
                              <FieldDescription>
                                This will be the display name used across your
                                tenant.
                              </FieldDescription>
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />

                        <Controller
                          name="tenantSlug"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor="tenant-slug">
                                Workspace URL (subdomain)
                              </FieldLabel>
                              <Input
                                {...field}
                                id="tenant-slug"
                                type="text"
                                placeholder="acme-distribution"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                aria-invalid={fieldState.invalid}
                                onChange={event => {
                                  setSubmitError(null);
                                  form.clearErrors("tenantSlug");
                                  field.onChange(
                                    slugifyTenantInput(event.target.value),
                                  );
                                }}
                                onBlur={event => {
                                  const normalized = slugifyTenantInput(
                                    event.target.value,
                                  );
                                  form.setValue("tenantSlug", normalized, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });

                                  if (
                                    normalized &&
                                    RESERVED_TENANT_SLUGS.has(normalized)
                                  ) {
                                    form.setError("tenantSlug", {
                                      type: "manual",
                                      message:
                                        "That tenant slug is reserved. Please choose another.",
                                    });
                                  }
                                }}
                              />
                              <FieldDescription>
                                Reserved slugs are blocked automatically.
                              </FieldDescription>
                              {fieldState.invalid ? (
                                <FieldError errors={[fieldState.error]} />
                              ) : null}
                            </Field>
                          )}
                        />
                      </>
                    ) : (
                      <div className="space-y-4 rounded-2xl border border-border bg-muted/50 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Globe className="size-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Personal workspace
                            </p>
                            <p className="text-sm text-muted-foreground">
                              We&apos;ll create a solo tenant automatically
                              using your name.
                            </p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white bg-white px-4 py-3">
                          <p className="text-sm font-medium text-foreground">
                            Workspace name
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {(name?.trim() || "Your name") + "'s Workspace"}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-border bg-muted/50 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Workspace preview
                      </p>
                      <p className="mt-2 font-mono text-sm text-foreground">
                        {slugPreview}
                      </p>
                    </div>
                  </>
                ) : null}

                {currentStep === 2 ? (
                  <>
                    <Controller
                      name="companyName"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor="company-name">
                            Company name
                          </FieldLabel>
                          <Input
                            {...field}
                            id="company-name"
                            type="text"
                            placeholder={
                              accountType === "business"
                                ? tenantName || "Enter company name"
                                : "Enter business name"
                            }
                          />
                          <FieldDescription>
                            Optional in this v1. We use it only for setup
                            context today.
                          </FieldDescription>
                        </Field>
                      )}
                    />

                    <Controller
                      name="industry"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Industry</FieldLabel>
                          <Select
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDUSTRY_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Controller
                        name="companySize"
                        control={form.control}
                        render={({ field }) => (
                          <Field>
                            <FieldLabel>Company size</FieldLabel>
                            <Select
                              value={field.value || undefined}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="h-10 w-full">
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                {COMPANY_SIZE_OPTIONS.map(option => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      />

                      <Controller
                        name="countryRegion"
                        control={form.control}
                        render={({ field }) => (
                          <Field>
                            <FieldLabel>Country / Region</FieldLabel>
                            <Select
                              value={field.value || undefined}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="h-10 w-full">
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                {COUNTRY_OPTIONS.map(option => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      />
                    </div>

                    <Controller
                      name="currency"
                      control={form.control}
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Currency</FieldLabel>
                          <Select
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />
                  </>
                ) : null}

                {currentStep === 3 ? (
                  <>
                    {accountType === "solo" ? (
                      <div className="rounded-2xl border border-border bg-muted/50 p-5">
                        <p className="font-medium text-foreground">
                          Solo setup selected
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          You can skip team invites for now. If you add
                          teammates later, you&apos;ll be able to invite them
                          from inside the app.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
                      <div className="grid gap-3 sm:grid-cols-[1.4fr_0.9fr_auto]">
                        <Input
                          type="email"
                          placeholder="teammate@company.com"
                          value={inviteEmail}
                          onChange={event => {
                            setInviteEmail(event.target.value);
                            setSubmitError(null);
                          }}
                        />
                        <Select
                          value={inviteRole}
                          onValueChange={value =>
                            setInviteRole(value as "member" | "admin")
                          }
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 gap-2"
                          onClick={addTeamInvite}
                        >
                          <Plus className="size-4" />
                          Add
                        </Button>
                      </div>
                      <FieldDescription>
                        Invitees are captured for review here, but this v1
                        signup flow does not send invites automatically yet.
                      </FieldDescription>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">
                        Added team members
                      </p>
                      {teamInvites.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                          No teammates added yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {teamInvites.map(invite => (
                            <div
                              key={invite.id}
                              className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {invite.email}
                                </p>
                                <p className="text-sm capitalize text-muted-foreground">
                                  {invite.role}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTeamInvite(invite.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {currentStep === 4 ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-muted/50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Account
                          </p>
                          <p className="mt-1 font-medium text-foreground">
                            {name}
                          </p>
                          <p className="text-sm text-muted-foreground">{email}</p>
                          <p className="mt-2 text-sm text-muted-foreground capitalize">
                            {accountType === "business"
                              ? "Business / Team"
                              : "Solo / Freelancer"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-primary"
                          onClick={() => setCurrentStep(0)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Workspace
                          </p>
                          <p className="mt-1 font-medium text-foreground">
                            {accountType === "business"
                              ? tenantName || "Workspace pending"
                              : `${name || "Your"}'s Workspace`}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {slugPreview}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-primary"
                          onClick={() => setCurrentStep(1)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Company
                          </p>
                          <p className="mt-1 font-medium text-foreground">
                            {companyName || "Not provided"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {[industry, companySize, countryRegion, currency]
                              .filter(Boolean)
                              .join(" • ") ||
                              "This onboarding context is UI-only for now."}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-primary"
                          onClick={() => setCurrentStep(2)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Team
                          </p>
                          <p className="mt-1 font-medium text-foreground">
                            {teamInvites.length === 0
                              ? "No teammates added"
                              : `${teamInvites.length} teammate${teamInvites.length === 1 ? "" : "s"} prepared`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Invites will be managed after signup in this v1.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-primary"
                          onClick={() => setCurrentStep(3)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                  {currentStep > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 sm:min-w-28"
                      onClick={goToPreviousStep}
                    >
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}

                  {currentStep < SIGN_UP_STEPS.length - 1 ? (
                    <Button
                      type="button"
                      className="h-11 gap-2 sm:min-w-36"
                      onClick={goToNextStep}
                    >
                      Continue
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="h-11 sm:min-w-40"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Creating…" : "Create workspace"}
                    </Button>
                  )}
                </div>

                <div className="space-y-2 pt-1 text-center text-sm text-muted-foreground">
                  <p>
                    By creating an account, you agree to our terms of service
                    and privacy policy. Detailed legal pages can be added to the
                    tenant marketing site in a follow-up pass.
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
        </div>
      </AuthSplitShell>
    </TooltipProvider>
  );
}
