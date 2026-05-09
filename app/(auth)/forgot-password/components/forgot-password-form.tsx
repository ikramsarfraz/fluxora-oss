"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { sendForgotMagicLinkAction } from "@/modules/shared/actions";
import { AuthCenteredShell } from "@/app/(auth)/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from "@/app/(auth)/forgot-password/components/forgot-password-form.schema";

export function ForgotPasswordForm() {
  const router = useRouter();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    await sendForgotMagicLinkAction({ email: data.email });

    toast.success(
      `If an account exists for ${data.email.trim()}, check your inbox for a sign-in link.`,
    );

    router.push("/login");
  }

  const { isSubmitting } = form.formState;

  return (
    <AuthCenteredShell
      topLabel="Remember your password?"
      topHref="/login"
      topAction="Sign in"
    >
      <Card className="w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]">
        <CardHeader className="space-y-2 pb-5 text-center">
          <div
            className="mx-auto mb-2 flex size-9 items-center justify-center rounded-[9px] text-[0.8rem] font-extrabold text-white"
            style={{ background: "var(--primary)" }}
          >
            Fx
          </div>
          <CardTitle className="text-2xl tracking-tight text-foreground">
            Email sign-in link
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we&apos;ll send you a one-time secure link to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="forgot-password-email">
                      Email address
                    </FieldLabel>
                    <Input
                      {...field}
                      id="forgot-password-email"
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending link…" : "Email sign-in link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Remember how you signed in?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
                >
                  Sign in
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}
