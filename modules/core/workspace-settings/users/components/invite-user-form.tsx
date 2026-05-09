"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";

import { SubscriptionUpgradeMessage } from "@/modules/core/billing/components/subscription/subscription-upgrade-message";
import { useInviteUser } from "@/modules/core/workspace-settings/hooks/use-users";
import { Card, CardContent } from "@/components/ui/card";
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  inviteUserFormSchema,
  type InviteUserFormValues,
} from "../validators/invite-user-form.schema";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";

const ROLE_OPTIONS: { value: InviteUserFormValues["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "warehouse", label: "Warehouse" },
  { value: "accounting", label: "Accounting" },
];

const defaultForm: InviteUserFormValues = {
  fullName: "",
  email: "",
  role: "sales",
};

export function InviteUserForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserFormSchema),
    defaultValues: defaultForm,
  });

  const sendInvite = useInviteUser();

  function onSubmit(data: InviteUserFormValues) {
    setError(null);
    sendInvite.mutate(
      {
        fullName: data.fullName,
        email: data.email,
        role: data.role,
      },
      {
        onSuccess: () => {
          form.reset(defaultForm);
          setError(null);
          toast.success("Invitation sent");
          router.push("/users");
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-user" onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert title="We couldn't send the invitation.">
                {isLimitReachedMessage(error, "maxPortalUsers") ? (
                  <SubscriptionUpgradeMessage message="Your current plan has reached the portal user limit." />
                ) : (
                  stripSubscriptionEnforcementPrefix(error)
                )}
            </FormErrorAlert>
          ) : null}
          <FieldGroup>
            <Controller
              name="fullName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-user-full-name">
                    Full name *
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-add-user-full-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Jane Smith"
                    autoComplete="name"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-user-email">Email *</FieldLabel>
                  <Input
                    {...field}
                    id="form-add-user-email"
                    type="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-user-role">Role *</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="form-add-user-role"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId="form-add-user"
        isPending={sendInvite.isPending}
        onCancel={() => router.push("/users")}
        pendingLabel="Sending…"
        submitLabel="Send invitation"
      />
    </Card>
  );
}
