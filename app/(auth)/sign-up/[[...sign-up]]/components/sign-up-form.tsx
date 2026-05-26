"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Apple } from "@/components/icons/apple";
import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  prepareGoogleAuthStartAction,
  sendRootSignupMagicLinkAction,
} from "@/modules/shared/actions";
import {
  signUpFormSchema,
  type SignUpFormValues,
} from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form.schema";

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

function buildSupportHref(rootDomain: string) {
  const emailDomain =
    rootDomain === "localhost" || rootDomain === "127.0.0.1"
      ? "example.com"
      : rootDomain;
  return `mailto:support@${emailDomain}`;
}

type FlowStep = {
  title: string;
  meta?: string;
  caption: string;
  current?: boolean;
};

const FLOW_STEPS: FlowStep[] = [
  {
    title: "Email",
    meta: "· this screen",
    caption: "Submit your work email. We send a magic link, no password.",
    current: true,
  },
  {
    title: "Confirm",
    meta: "· /signin/verify",
    caption: "One click in your inbox verifies your identity.",
  },
  {
    title: "Profile + workspace",
    meta: "· /onboarding",
    caption:
      "First and last name, workspace name, and your subdomain with live preview.",
  },
  {
    title: "Get started",
    meta: "· /get-started",
    caption:
      "Three quick questions inside your workspace — category, team, bill source. Then you're operating.",
  },
];

const INCLUDED_ROWS = [
  "Unlimited users, lots, products, and customers",
  "Catch-weight, FIFO, expiry alerts — all standard",
  "Branded PDF invoices with your subdomain",
  "PDF import (OCR) for supplier bills",
  "No card, no contract, cancel anytime",
];

export function SignUpForm({
  tenant,
  inactiveTenant,
  isRootHost,
  rootDomain,
  rootLoginUrl,
  tenantLoginUrl,
  inviteToken,
  googleEnabled,
}: SignUpFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const supportHref = useMemo(() => buildSupportHref(rootDomain), [rootDomain]);

  async function handleGoogleSignUp() {
    if (!googleEnabled) return;
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
    if (!agreed) return;
    setSubmitError(null);
    try {
      const result = await sendRootSignupMagicLinkAction({ email: data.email });
      setSentEmail(result.email);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't create your account.",
      );
    }
  }

  async function handleResend() {
    if (!sentEmail) return;
    setSubmitError(null);
    try {
      await sendRootSignupMagicLinkAction({ email: sentEmail });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not resend the link.",
      );
    }
  }

  const { isSubmitting } = form.formState;
  const loginUrl = isRootHost ? rootLoginUrl : tenantLoginUrl;

  // Tenant-host signup is invite-only
  if (!isRootHost && (tenant || inactiveTenant)) {
    const requestTenant = tenant ?? inactiveTenant;
    const requestsBlocked = Boolean(inactiveTenant && !tenant);
    return (
      <ShellLayout
        rootDomain={rootDomain}
        loginUrl={loginUrl}
        supportHref={supportHref}
      >
        <div className="flex flex-col gap-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-bg text-[18px] text-warning-fg">
            ⚠
          </span>
          <div>
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
              {requestsBlocked ? "Workspace inactive" : "Invite only"}
            </h1>
            <p className="mt-1 text-[14px] leading-[1.55] text-subtle">
              {requestsBlocked
                ? `${requestTenant?.name ?? "This workspace"} is currently inactive.`
                : "Contact your admin for access."}
            </p>
          </div>
          {inviteToken ? (
            <div className="rounded-md border-[0.5px] border-danger-border bg-danger-bg px-3 py-2.5 text-left text-[13px] text-danger-fg">
              This invite link is invalid, expired, already used, or does not
              belong to this tenant.
            </div>
          ) : null}
          <Link
            href={loginUrl}
            className="w-full rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card-warm"
          >
            Back to tenant sign in
          </Link>
        </div>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      rootDomain={rootDomain}
      loginUrl={loginUrl}
      supportHref={supportHref}
    >
      {sentEmail ? (
        <SentState
          email={sentEmail}
          onUseDifferent={() => {
            setSentEmail(null);
            form.reset({ email: sentEmail });
          }}
          onResend={handleResend}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Sign up · 14-day free trial
            </span>
            <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
              Start with your email.
            </h1>
            <p className="mt-1 text-[14.5px] leading-[1.55] text-subtle">
              We&apos;ll send you a sign-in link. After you confirm, you&apos;ll
              add your name and create your workspace — no password needed.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <ProviderButton
              icon={<Google className="size-[18px]" />}
              label={isGoogleLoading ? "Redirecting…" : "Sign up with Google"}
              disabled={!googleEnabled || isGoogleLoading}
              onClick={handleGoogleSignUp}
            />
            <ProviderButton
              icon={<Apple className="size-[18px] text-ink" />}
              label="Sign up with Apple"
              disabled
            />
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted before:h-[0.5px] before:flex-1 before:bg-border-default before:content-[''] after:h-[0.5px] after:flex-1 after:bg-border-default after:content-['']">
            or with email
          </div>

          {submitError ? (
            <div className="rounded-md border-[0.5px] border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">
              {submitError}
            </div>
          ) : null}

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
                    htmlFor="sign-up-email"
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
                      id="sign-up-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@acme-foods.com"
                      aria-invalid={fieldState.invalid}
                      className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] font-sans text-[14px] text-ink outline-none placeholder:text-muted"
                    />
                  </div>
                  <p className="text-[11.5px] leading-[1.4] text-subtle">
                    {fieldState.invalid && fieldState.error?.message
                      ? fieldState.error.message
                      : "We'll only use this to send your sign-in link. No marketing."}
                  </p>
                </div>
              )}
            />

            <label className="inline-flex cursor-pointer items-start gap-[9px] text-[13px] leading-[1.45] text-ink-warm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer appearance-none rounded-sm border-[0.5px] border-border-default bg-card transition-colors checked:border-forest checked:bg-forest checked:after:flex checked:after:size-full checked:after:items-center checked:after:justify-center checked:after:text-[11px] checked:after:font-semibold checked:after:text-card-warm checked:after:content-['✓'] focus:outline-none focus:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-ink underline-offset-2 hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-ink underline-offset-2 hover:underline">
                  Privacy policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !agreed}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-forest px-[14px] py-3 font-sans text-[14px] font-medium leading-none text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending link…" : "Email me a sign-in link"}
              <span aria-hidden>→</span>
            </button>
          </form>

          <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-border-soft bg-card-warm p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-forest-tint text-[14px] text-forest">
              ⌾
            </span>
            <div className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-ink-warm">
              <div className="text-[13px] font-medium text-ink">Passwordless by default</div>
              Magic links expire in 15 minutes. You&apos;ll set your name and
              workspace on the next screen, after you confirm.
            </div>
          </div>

          <div className="border-t-[0.5px] border-divider pt-[18px] text-center text-[13px] text-subtle">
            Already have a workspace?{" "}
            <Link
              href={loginUrl}
              className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
            >
              Sign in instead
            </Link>
          </div>
        </>
      )}
    </ShellLayout>
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
        "flex w-full items-center justify-center gap-2.5 rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[11px] text-[13.5px] font-medium text-ink transition-colors hover:bg-card-warm",
        disabled && "cursor-not-allowed opacity-60 hover:bg-card",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SentState({
  email,
  onUseDifferent,
  onResend,
}: {
  email: string;
  onUseDifferent: () => void;
  onResend: () => void;
}) {
  return (
    <>
      <span className="grid size-14 place-items-center rounded-full bg-forest-tint text-[22px] text-forest">
        ✉
      </span>
      <div>
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          Check your inbox.
        </h1>
        <p className="mt-1 text-[14px] leading-[1.55] text-subtle">
          We just sent a sign-in link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it to
          verify and continue setting up your workspace.
        </p>
      </div>

      <ol className="flex flex-col gap-3 rounded-lg border-[0.5px] border-border-soft bg-card-warm p-4 text-[13px] leading-[1.5] text-ink-warm">
        {[
          {
            n: 1,
            done: true,
            title: "Email submitted",
            body: "we created your account.",
          },
          {
            n: 2,
            done: false,
            title: "Click the link in your inbox",
            body: "expires in 15 minutes. Same browser preferred.",
          },
          {
            n: 3,
            done: false,
            title: "Add your name & workspace",
            body: "on the next screen — and you're in.",
          },
        ].map((row) => (
          <li key={row.n} className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                row.done
                  ? "bg-forest text-card-warm"
                  : "border-[0.5px] border-border-default bg-card text-subtle",
              )}
            >
              {row.done ? "✓" : row.n}
            </span>
            <span>
              <span className="font-medium text-ink">{row.title}</span> · {row.body}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onUseDifferent}
          className="rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={onResend}
          className="rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          Resend link
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border-[0.5px] border-border-soft bg-card-warm p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-warning-bg text-[14px] font-semibold text-warning-fg">
          !
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-ink-warm">
          <div className="text-[13px] font-medium text-ink">Don&apos;t see it?</div>
          Check spam, or — if your team uses an allowlist — ask IT to permit{" "}
          <span className="font-mono text-[11.5px] text-ink">no-reply@fluxora.app</span>.
        </div>
      </div>
    </>
  );
}

function ShellLayout({
  rootDomain,
  loginUrl,
  supportHref,
  children,
}: {
  rootDomain: string;
  loginUrl: string;
  supportHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="flex items-center justify-between border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
        <div className="text-[13px] text-subtle">
          Already a member?{" "}
          <Link
            href={loginUrl}
            className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
          >
            Sign in →
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="flex items-center justify-center px-8 py-14">
          <div className="flex w-full max-w-[420px] flex-col gap-7">{children}</div>
        </section>

        <aside className="hidden flex-col justify-between gap-12 bg-surface px-12 py-14 lg:flex">
          <div className="flex flex-col gap-3">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Sign-up to first invoice
            </span>
            <h2 className="max-w-[440px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
              Four steps from this screen to your first branded invoice.
            </h2>
            <p className="max-w-[380px] text-[14.5px] leading-[1.55] text-subtle">
              Email only here. Profile, workspace name, and subdomain come right
              after you confirm — so a typo on this page doesn&apos;t follow you
              for the next year.
            </p>
          </div>

          <ol className="flex flex-col gap-3.5">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step.title}
                className={cn(
                  "flex items-start gap-3.5 rounded-md border-[0.5px] bg-card px-4 py-3 transition-colors",
                  step.current
                    ? "border-forest-tint-deep bg-forest-tint/40"
                    : "border-border-soft",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium",
                    step.current
                      ? "bg-forest text-card-warm"
                      : "border-[0.5px] border-border-default bg-card-warm text-subtle",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="text-[13.5px] font-medium text-ink">
                    {step.title}
                    {step.meta ? (
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-subtle">
                        {step.meta}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12.5px] leading-[1.5] text-subtle">
                    {step.caption}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-2 border-t-[0.5px] border-border-soft pt-5">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              14 days. Everything unlocked.
            </span>
            {INCLUDED_ROWS.map((row) => (
              <div key={row} className="flex items-start gap-2 text-[12.5px] text-ink-warm">
                <span className="mt-0.5 grid size-4 place-items-center rounded-full bg-success-bg text-[10px] text-success-fg">
                  ✓
                </span>
                {row}
              </div>
            ))}
          </div>
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
          <span className="font-mono text-[11px] tracking-[0.04em] text-muted">
            {rootDomain}
          </span>
        </div>
      </footer>
    </div>
  );
}
