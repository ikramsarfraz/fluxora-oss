"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Globe } from "lucide-react";
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

import {
  onboardingFormSchema,
  type OnboardingFormValues,
} from "./onboarding-form.schema";

type OnboardingFormProps = {
  defaultName: string;
  defaultEmail: string;
  protocol: "http" | "https";
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

function buildTenantPreview(args: {
  slug: string;
  protocol: "http" | "https";
  rootDomain: string;
  port: string | null;
}) {
  const portSuffix = args.port ? `:${args.port}` : "";
  const slug = args.slug || "your-workspace";
  return `${args.protocol}://${slug}.${args.rootDomain}${portSuffix}`;
}

export function OnboardingForm(props: OnboardingFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      tenantName:
        props.defaultName.trim() ||
        props.defaultEmail.split("@")[0] ||
        "Workspace",
      tenantSlug: slugifyTenantInput(
        props.defaultName.trim() ||
          props.defaultEmail.split("@")[0] ||
          "workspace",
      ),
    },
    mode: "onBlur",
  });

  const tenantSlug = form.watch("tenantSlug");
  const tenantPreview = useMemo(
    () =>
      buildTenantPreview({
        slug: tenantSlug,
        protocol: props.protocol,
        rootDomain: props.rootDomain,
        port: props.port,
      }),
    [props.port, props.protocol, props.rootDomain, tenantSlug],
  );

  async function onSubmit(values: OnboardingFormValues) {
    setError(null);
    try {
      const result = await completeUserOnboardingAction(values);
      router.push(result.redirectUrl);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't finish setting up your workspace.",
      );
    }
  }

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
            Create your workspace
          </h1>
          <p className="text-sm text-[oklch(0.50_0.02_230)]">
            Your account is ready. Choose the name and URL for the tenant
            you&apos;ll use in the app.
          </p>
        </div>

        <Card className="border-[oklch(0.92_0.01_230)] shadow-none">
          <CardContent className="pt-6">
            <form id="onboarding-form" onSubmit={form.handleSubmit(onSubmit)}>
              {error ? (
                <FormErrorAlert title="We couldn't finish setting up your workspace.">
                  {error}
                </FormErrorAlert>
              ) : null}

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
                        This is the company or workspace name shown across your tenant.
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
                        Used as the tenant subdomain for your team.
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
                      Workspace preview
                    </p>
                  </div>
                  <p className="mt-2 font-mono text-sm text-foreground">
                    {tenantPreview}
                  </p>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
          <FormActionFooter
            formId="onboarding-form"
            isPending={form.formState.isSubmitting}
            onCancel={() => router.push("/login")}
            pendingLabel="Creating…"
            submitLabel="Create workspace"
          />
        </Card>
      </div>
    </AuthSplitShell>
  );
}
