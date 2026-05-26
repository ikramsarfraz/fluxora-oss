"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Apple } from "@/components/icons/apple";
import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { prepareGoogleAuthStartAction } from "@/modules/shared/actions";
import {
  signInFormSchema,
  type SignInFormValues,
} from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form.schema";

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

const WORKSPACE_HINTS: { letter: string; color: string; name: string; role: string }[] = [
  { letter: "M", color: "#D9B872", name: "Marin Provisions", role: "Owner" },
  { letter: "P", color: "#B8C99E", name: "Pacific Wharf Distributors", role: "Finance" },
  { letter: "H", color: "#D49074", name: "Highland Provisions", role: "Auditor" },
];

export function SignInForm({
  tenant,
  inactiveTenant,
  tenantSlug,
  isRootHost,
  isPlatformAdminHost,
  rootDomain,
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

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: emailParam },
  });

  const supportHref = useMemo(() => buildSupportHref(rootDomain), [rootDomain]);

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
    setLinkSent(data.email.trim());
  }

  const { isSubmitting } = form.formState;

  async function handleGoogleSignIn() {
    if (!googleEnabled) return;
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

  const showTenantNotFound = !isRootHost && tenantSlug && !tenant;

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      {/* topbar */}
      <header className="flex items-center justify-between border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
        <div className="text-[13px] text-subtle">
          New here?{" "}
          <Link
            href={signUpUrl}
            className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
          >
            Create a workspace →
          </Link>
        </div>
      </header>

      {/* page */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* form column */}
        <section className="flex items-center justify-center px-8 py-14">
          <div className="flex w-full max-w-[420px] flex-col gap-7">
            {showTenantNotFound ? (
              <TenantNotFoundCard
                inactiveTenant={inactiveTenant}
                tenantSlug={tenantSlug}
                supportHref={supportHref}
                rootSignUpUrl={signUpUrl}
              />
            ) : linkSent ? (
              <LinkSentCard
                email={linkSent}
                onTryDifferent={() => {
                  setLinkSent(null);
                  setSubmitError(null);
                }}
              />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Sign in
                  </span>
                  <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                    Welcome back.
                  </h1>
                  <p className="mt-1 text-[14.5px] leading-[1.55] text-subtle">
                    {isPlatformAdminHost
                      ? "Access the platform admin console."
                      : isRootHost
                        ? "Sign in with your email, then we'll route you to the right workspace."
                        : tenant
                          ? `Sign in to continue to ${tenant.name}.`
                          : "Sign in with your email, then we'll route you to the right workspace."}
                  </p>
                </div>

                {/* providers */}
                <div className="flex flex-col gap-2">
                  <ProviderButton
                    icon={<Google className="size-[18px]" />}
                    label={isGoogleLoading ? "Redirecting…" : "Continue with Google"}
                    disabled={!googleEnabled || isGoogleLoading}
                    onClick={handleGoogleSignIn}
                  />
                  <ProviderButton
                    icon={<Apple className="size-[18px] text-ink" />}
                    label="Continue with Apple"
                    disabled
                  />
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted before:h-[0.5px] before:flex-1 before:bg-border-default before:content-[''] after:h-[0.5px] after:flex-1 after:bg-border-default after:content-['']">
                  or
                </div>

                {submitError && (
                  <div className="rounded-md border-[0.5px] border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">
                    {submitError}
                  </div>
                )}

                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  noValidate
                  className="flex flex-col gap-[14px]"
                >
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="sign-in-email"
                          className="text-[12.5px] font-medium leading-none tracking-[-0.005em] text-ink"
                        >
                          Work email
                        </label>
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-md border-[0.5px] bg-card transition-colors",
                            fieldState.invalid ? "border-danger-border" : "border-border-default",
                            "focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]",
                          )}
                        >
                          <input
                            {...field}
                            id="sign-in-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@acme-foods.com"
                            aria-invalid={fieldState.invalid}
                            className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] font-sans text-[14px] text-ink outline-none placeholder:text-muted"
                          />
                        </div>
                        {fieldState.invalid && fieldState.error?.message ? (
                          <p className="text-[12px] text-danger-fg">{fieldState.error.message}</p>
                        ) : null}
                      </div>
                    )}
                  />

                  <label className="inline-flex cursor-pointer items-center gap-[9px] text-[13px] text-ink-warm">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="size-4 cursor-pointer appearance-none rounded-sm border-[0.5px] border-border-default bg-card transition-colors checked:border-forest checked:bg-forest checked:after:flex checked:after:size-full checked:after:items-center checked:after:justify-center checked:after:text-[11px] checked:after:font-semibold checked:after:text-card-warm checked:after:content-['✓'] focus:outline-none focus:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]"
                    />
                    Keep me signed in for 30 days
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-md bg-forest px-[14px] py-3 font-sans text-[14px] font-medium leading-none text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Sending…" : "Email me a sign-in link"}
                  </button>
                </form>

                {isRootHost && (
                  <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-border-soft bg-card-warm p-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-forest-tint text-[14px] text-forest">
                      ⌕
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink">
                        Already know your workspace?
                      </div>
                      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-warm">
                        Go directly to{" "}
                        <span className="font-mono text-[12px] text-ink">
                          your-name.{rootDomain}/signin
                        </span>{" "}
                        — or{" "}
                        <Link
                          href={signUpUrl}
                          className="border-b border-forest-tint-deep pb-px font-medium text-forest"
                        >
                          find by email
                        </Link>{" "}
                        if you&apos;ve forgotten the URL.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t-[0.5px] border-divider pt-[18px] text-center text-[13px] text-subtle">
                  Don&apos;t have a workspace yet?{" "}
                  <Link
                    href={signUpUrl}
                    className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
                  >
                    Create one in 90 seconds
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* brand column — hide below lg */}
        <aside className="relative hidden flex-col justify-between gap-12 overflow-hidden bg-forest px-12 py-14 text-card-warm lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 80% 10%, rgba(201,169,97,.10) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 20% 90%, rgba(74,122,94,.25) 0%, transparent 60%)",
            }}
          />
          <div className="relative z-10 flex flex-col gap-3">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
              One identity · many workspaces
            </span>
            <h2 className="max-w-[440px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-card-warm">
              Sign in once. Switch between every workspace you belong to.
            </h2>
            <p className="max-w-[380px] text-[14.5px] leading-[1.55] text-card-warm/70">
              Your Fluxora login is portable across every tenant that&apos;s invited
              you — your auditor, your warehouse, and the broker you co-pack with
              all under one identity.
            </p>
          </div>

          <div className="relative z-10 flex flex-col gap-[14px] rounded-lg border-[0.5px] border-card-warm/15 bg-card-warm/[0.04] p-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-forest-tint">
              Workspaces you belong to
            </span>
            <div className="flex flex-col gap-1.5">
              {WORKSPACE_HINTS.map((ws) => (
                <div
                  key={ws.letter}
                  className="flex items-center gap-3 rounded-md border-[0.5px] border-card-warm/10 bg-card-warm/[0.04] px-3 py-2.5 transition-colors hover:bg-card-warm/10"
                >
                  <span
                    className="grid size-7 place-items-center rounded-sm border border-gold font-sans text-[12px] font-semibold text-ink"
                    style={{ background: ws.color }}
                  >
                    {ws.letter}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-card-warm">
                    {ws.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-forest-tint">
                    {ws.role}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-sm border-[0.5px] border-card-warm/15 bg-black/20 px-3 py-2 font-mono text-[13px] text-card-warm">
              <span className="text-forest-tint/70">⌾</span>
              <span>marin-provisions</span>
              <span className="text-card-warm/50">.{rootDomain}/dashboard</span>
            </div>
          </div>

          <figure className="relative z-10 flex flex-col gap-[14px]">
            <blockquote className="text-[18px] font-medium leading-[1.45] tracking-[-0.015em] text-card-warm">
              &ldquo;Sign in once, four workspaces. We finally stopped paying for
              the same data four times.&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full border border-gold bg-card-warm font-sans text-[12px] font-semibold text-ink">
                MR
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12.5px] font-medium text-card-warm">Marisol Reyes</span>
                <span className="text-[11.5px] text-card-warm/55">
                  Ops Director · Marin Provisions
                </span>
              </span>
            </figcaption>
          </figure>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t-[0.5px] border-border-soft px-8 py-[18px] text-[12px] text-subtle">
        <div className="font-mono text-[11px] tracking-[0.04em]">
          © {new Date().getFullYear()} Fluxora, Inc.
        </div>
        <div className="flex gap-[18px]">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <a href={supportHref} className="hover:text-ink">
            Help
          </a>
        </div>
      </footer>
    </div>
  );
}

function ProviderButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[11px] text-[13.5px] font-medium text-ink transition-colors hover:bg-card-warm hover:border-border-default",
        disabled && "cursor-not-allowed opacity-60 hover:bg-card",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function LinkSentCard({
  email,
  onTryDifferent,
}: {
  email: string;
  onTryDifferent: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-forest-tint text-[18px] text-forest">
        ✉
      </span>
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          Check your inbox.
        </h1>
        <p className="text-[14px] leading-[1.55] text-subtle">
          We sent a sign-in link to{" "}
          <span className="font-medium text-ink">{email}</span>. Open it on this
          device to continue.
        </p>
      </div>
      <button
        type="button"
        onClick={onTryDifferent}
        className="w-full rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card-warm"
      >
        Try a different email
      </button>
    </div>
  );
}

function TenantNotFoundCard({
  inactiveTenant,
  tenantSlug,
  supportHref,
  rootSignUpUrl,
}: {
  inactiveTenant: { name: string } | null;
  tenantSlug: string | null;
  supportHref: string;
  rootSignUpUrl: string;
}) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-bg text-[18px] text-warning-fg">
        ⚠
      </span>
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          {inactiveTenant ? "Workspace inactive" : "Workspace not found"}
        </h1>
        <p className="text-[14px] leading-[1.55] text-subtle">
          {inactiveTenant
            ? `${inactiveTenant.name} is currently deactivated.`
            : `No active workspace for "${tenantSlug}".`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {!inactiveTenant && (
          <Link
            href={rootSignUpUrl}
            className="w-full rounded-md bg-forest px-[14px] py-3 text-center text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
          >
            Create a workspace
          </Link>
        )}
        <a
          href={supportHref}
          className="w-full rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-3 text-center text-[14px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
