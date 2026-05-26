"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { cn } from "@/lib/utils";
import { buildTenantHostnamePreview } from "@/lib/tenant-slug-policy";
import { completeUserOnboardingAction } from "@/modules/shared/actions";

import {
  onboardingFormSchema,
  type OnboardingFormValues,
} from "./onboarding-form.schema";

type OnboardingFormProps = {
  defaultFirstName: string;
  defaultLastName: string;
  defaultTenantName: string;
  protocol: "http" | "https";
  hostname: string;
  rootDomain: string;
  port: string | null;
};

function slugifyTenantInput(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function tightenSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function buildTenantUrlPreview(props: OnboardingFormProps & { slug: string }) {
  const hostPort = buildTenantHostnamePreview({
    slug: props.slug,
    hostname: props.hostname,
    rootDomain: props.rootDomain,
    port: props.port,
  });
  return `${props.protocol}://${hostPort}`;
}

export function OnboardingForm(props: OnboardingFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      firstName: props.defaultFirstName,
      lastName: props.defaultLastName,
      tenantName: props.defaultTenantName,
      tenantSlug: slugifyTenantInput(props.defaultTenantName),
    },
    mode: "onBlur",
  });

  const tenantName = form.watch("tenantName");
  const tenantSlug = form.watch("tenantSlug");
  const previewSlug = tenantSlug?.trim() ? tenantSlug : "your-workspace";

  const tenantPreview = useMemo(
    () => buildTenantUrlPreview({ ...props, slug: previewSlug }),
    [
      previewSlug,
      props,
    ],
  );

  async function onSubmit(values: OnboardingFormValues) {
    setError(null);
    try {
      const result = await completeUserOnboardingAction(values);
      window.location.assign(result.redirectUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't finish setting up your workspace.",
      );
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      {/* topbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
        <div className="text-[13px] text-subtle">
          Already set up?{" "}
          <Link
            href="/select-destination"
            className="border-b border-transparent pb-[2px] font-medium text-ink transition-colors hover:border-ink"
          >
            Choose workspace
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* form column */}
        <section className="flex items-start justify-center px-8 py-14">
          <form
            id="onboarding-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex w-full max-w-[480px] flex-col gap-8"
          >
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Workspace onboarding · 14-day trial active
              </span>
              <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                Set up your workspace.
              </h1>
              <p className="mt-1 text-[14.5px] leading-[1.55] text-subtle">
                Two short steps — your name and your workspace URL — and
                you&apos;re inside. Subdomain changes are limited later, so pick
                something clear and stable.
              </p>
            </div>

            {error ? (
              <div className="rounded-md border-[0.5px] border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">
                {error}
              </div>
            ) : null}

            {/* Section 1 — Profile */}
            <Section number={1} title="Your profile">
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="firstName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      id="onboarding-first"
                      label="First name"
                      placeholder="Marisol"
                      autoComplete="given-name"
                      invalid={fieldState.invalid}
                      error={fieldState.error?.message}
                      {...field}
                      onChange={(e) => {
                        setError(null);
                        field.onChange(e);
                      }}
                    />
                  )}
                />
                <Controller
                  name="lastName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      id="onboarding-last"
                      label="Last name"
                      placeholder="Reyes"
                      autoComplete="family-name"
                      invalid={fieldState.invalid}
                      error={fieldState.error?.message}
                      {...field}
                      onChange={(e) => {
                        setError(null);
                        field.onChange(e);
                      }}
                    />
                  )}
                />
              </div>
            </Section>

            {/* Section 2 — Workspace */}
            <Section number={2} title="Your workspace">
              <Controller
                name="tenantName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    id="onboarding-tenant-name"
                    label="Workspace name"
                    placeholder="Marin Provisions"
                    invalid={fieldState.invalid}
                    error={fieldState.error?.message}
                    help="Shown in the app sidebar and invitations."
                    {...field}
                    onChange={(e) => {
                      setError(null);
                      const value = e.target.value;
                      field.onChange(value);
                      // Auto-derive slug from name as long as the user hasn't
                      // started editing the slug field directly.
                      const slugDirty = form.getFieldState("tenantSlug").isDirty;
                      if (!slugDirty) {
                        form.setValue(
                          "tenantSlug",
                          slugifyTenantInput(value),
                          { shouldDirty: false },
                        );
                      }
                    }}
                  />
                )}
              />

              <Controller
                name="tenantSlug"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="onboarding-tenant-slug"
                      className="text-[12.5px] font-medium leading-none tracking-[-0.005em] text-ink"
                    >
                      Workspace URL
                    </label>
                    <div
                      className={cn(
                        "flex items-stretch overflow-hidden rounded-md border-[0.5px] bg-card transition-colors",
                        fieldState.invalid ? "border-danger-border" : "border-border-default",
                        "focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]",
                      )}
                    >
                      <input
                        {...field}
                        id="onboarding-tenant-slug"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="marin-provisions"
                        aria-invalid={fieldState.invalid}
                        onChange={(e) => {
                          setError(null);
                          field.onChange(tightenSlug(e.target.value));
                        }}
                        className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] font-mono text-[14px] text-ink outline-none placeholder:text-muted"
                      />
                      <span className="flex items-center gap-2 border-l-[0.5px] border-border-soft bg-card-warm px-3 font-mono text-[12.5px] text-subtle">
                        .{props.rootDomain}
                        {tenantSlug && tenantSlug.length >= 3 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                            <span className="size-1.5 rounded-full bg-success-fg" />
                            Available
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {fieldState.invalid && fieldState.error?.message ? (
                      <p className="text-[11.5px] text-danger-fg">
                        {fieldState.error.message}
                      </p>
                    ) : (
                      <p className="text-[11.5px] leading-[1.4] text-subtle">
                        Subdomain that teammates will use to reach your
                        workspace. Lowercase letters, digits, and dashes.
                      </p>
                    )}
                  </div>
                )}
              />

              {/* URL preview */}
              <div className="rounded-md border-[0.5px] border-border-soft bg-card-warm p-3">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                  Sign-in address preview
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-sm border-[0.5px] border-border-default bg-card px-3 py-2 font-mono text-[13px] text-ink">
                  <span className="text-muted">⌾</span>
                  <span className="break-all">{tenantPreview}</span>
                </div>
              </div>
            </Section>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-forest px-5 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating workspace…" : "Create workspace"}
                <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-[13px] font-medium text-subtle transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>

        {/* brand column */}
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
              Workspace preview
            </span>
            <h2 className="max-w-[440px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-card-warm">
              How your team will see it.
            </h2>
          </div>

          <div className="relative z-10 flex flex-col gap-4 rounded-lg border-[0.5px] border-card-warm/15 bg-card-warm/[0.04] p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid size-10 place-items-center rounded-md font-sans text-[16px] font-semibold leading-none text-ink"
                style={{ background: "#F4E6C2", color: "#6B4A0E" }}
              >
                {(tenantName || "Workspace").trim().charAt(0).toUpperCase() || "W"}
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-card-warm">
                  {tenantName || "Your workspace"}
                </span>
                <span className="font-mono text-[11.5px] text-forest-tint">
                  Owner
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-sm border-[0.5px] border-card-warm/15 bg-black/20 px-3 py-2 font-mono text-[12.5px] text-card-warm">
              <span className="text-forest-tint/70">⌾</span>
              <span className="break-all">
                {previewSlug}
                <span className="text-card-warm/55">.{props.rootDomain}</span>
              </span>
            </div>
          </div>

          <ol className="relative z-10 flex flex-col gap-3.5">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
              What&apos;s next
            </span>
            {[
              {
                title: "Get-started wizard",
                meta: "· /get-started",
                caption:
                  "Three questions: category, team size, bill source. Seeds the catalog.",
              },
              {
                title: "Invite teammates",
                caption:
                  "Picker, dispatcher, finance, auditor — granular roles per surface.",
              },
              {
                title: "First branded invoice",
                caption:
                  "Logo + slug + your color on PDF. No demo data — every record is real.",
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-md border-[0.5px] border-card-warm/15 bg-card-warm/[0.04] px-4 py-3"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-card-warm/10 font-mono text-[11px] font-medium text-forest-tint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="text-[13.5px] font-medium text-card-warm">
                    {step.title}
                    {step.meta ? (
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-forest-tint">
                        {step.meta}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12.5px] leading-[1.5] text-card-warm/70">
                    {step.caption}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 place-items-center rounded-full bg-forest-tint font-mono text-[11px] font-semibold text-forest">
          {number}
        </span>
        <span className="text-[14px] font-medium text-ink">{title}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  error?: string;
  help?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  ref?: React.Ref<HTMLInputElement>;
};

function TextField({
  id,
  label,
  placeholder,
  autoComplete,
  invalid,
  error,
  help,
  ...rest
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12.5px] font-medium leading-none tracking-[-0.005em] text-ink"
      >
        {label}
      </label>
      <div
        className={cn(
          "flex items-center rounded-md border-[0.5px] bg-card transition-colors",
          invalid ? "border-danger-border" : "border-border-default",
          "focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]",
        )}
      >
        <input
          id={id}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          {...rest}
          className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] font-sans text-[14px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      {invalid && error ? (
        <p className="text-[11.5px] text-danger-fg">{error}</p>
      ) : help ? (
        <p className="text-[11.5px] leading-[1.4] text-subtle">{help}</p>
      ) : null}
    </div>
  );
}
