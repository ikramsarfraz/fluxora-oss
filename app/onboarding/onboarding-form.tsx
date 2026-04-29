"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Globe, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { completeUserOnboardingAction } from "@/actions/auth";
import { AuthSplitShell } from "@/app/(auth)/components/auth-shell";
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { buildTenantHostnamePreview } from "@/lib/tenant-slug-policy";

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

  const tenantSlug = form.watch("tenantSlug");
  const tenantPreview = useMemo(
    () =>
      buildTenantUrlPreview({
        ...props,
        slug: tenantSlug?.trim()
          ? tenantSlug
          : "your-workspace",
      }),
    [
      tenantSlug,
      props.hostname,
      props.port,
      props.protocol,
      props.rootDomain,
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
    <AuthSplitShell
      topLabel="Already set up?"
      topHref="/select-destination"
      topAction="Choose workspace"
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.96_0.01_230)] px-2.5 py-1 text-xs font-medium text-[oklch(0.40_0.03_230)]">
            <Building2 className="size-3" />
            Workspace onboarding
          </div>
          <h1 className="text-xl font-semibold text-[oklch(0.20_0.03_230)]">
            Finish setup
          </h1>
          <p className="text-sm text-[oklch(0.50_0.02_230)]">
            Add your profile, then choose how your workspace appears and the URL
            your team signs in through (
            <span className="font-mono">{props.rootDomain}</span>).
          </p>
        </div>

        <Card className="border-[oklch(0.92_0.01_230)] shadow-none">
          <CardContent className="space-y-8 pt-6">
            <form id="onboarding-form" onSubmit={form.handleSubmit(onSubmit)}>
              {error ? (
                <FormErrorAlert title="We couldn't finish setup">
                  {error}
                </FormErrorAlert>
              ) : null}

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <UserRound className="size-4 text-muted-foreground" />
                  Your profile
                </div>

                <FieldGroup>
                  <Controller
                    name="firstName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="onboarding-first">
                          First name
                        </FieldLabel>
                        <Input
                          {...field}
                          id="onboarding-first"
                          placeholder="Jane"
                          autoComplete="given-name"
                          aria-invalid={fieldState.invalid}
                          onChange={event => {
                            setError(null);
                            field.onChange(event);
                          }}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  <Controller
                    name="lastName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="onboarding-last">
                          Last name
                        </FieldLabel>
                        <Input
                          {...field}
                          id="onboarding-last"
                          placeholder="Doe"
                          autoComplete="family-name"
                          aria-invalid={fieldState.invalid}
                          onChange={event => {
                            setError(null);
                            field.onChange(event);
                          }}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Building2 className="size-4 text-muted-foreground" />
                  Your workspace
                </div>

                <FieldGroup>
                  <Controller
                    name="tenantName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="onboarding-tenant-name">
                          Workspace name
                        </FieldLabel>
                        <Input
                          {...field}
                          id="onboarding-tenant-name"
                          placeholder="Acme Distribution"
                          aria-invalid={fieldState.invalid}
                          onChange={event => {
                            setError(null);
                            field.onChange(event);
                            const currentSlug = form.getValues("tenantSlug");
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
                          Shown in the app sidebar and invitations.
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
                        <FieldLabel htmlFor="onboarding-tenant-slug">
                          Workspace URL
                        </FieldLabel>
                        <Input
                          {...field}
                          id="onboarding-tenant-slug"
                          placeholder="acme-distribution"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-invalid={fieldState.invalid}
                          onChange={event => {
                            setError(null);
                            field.onChange(slugifyTenantInput(event.target.value));
                          }}
                        />
                        <FieldDescription>
                          The subdomain for your workspace: teammates use this
                          address to reach your company app. Pick something clear
                          and stable; subdomain changes are limited.
                        </FieldDescription>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />

                  <div className="rounded-2xl border border-border bg-muted/50 p-4">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Sign-in address preview
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mirrors how subdomain routing uses your ROOT_DOMAIN (
                      <span className="font-mono">{props.rootDomain}</span>).
                    </p>
                    <p className="mt-3 break-all font-mono text-sm text-foreground">
                      {tenantPreview}
                    </p>
                  </div>
                </FieldGroup>
              </div>
            </form>
          </CardContent>
          <FormActionFooter
            formId="onboarding-form"
            isPending={isSubmitting}
            onCancel={() => router.push("/login")}
            pendingLabel="Creating workspace…"
            submitLabel="Create workspace"
          />
        </Card>
      </div>
    </AuthSplitShell>
  );
}
