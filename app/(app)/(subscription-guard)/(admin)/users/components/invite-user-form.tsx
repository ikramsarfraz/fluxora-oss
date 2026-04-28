"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";

import { useInviteUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
} from "./invite-user-form.schema";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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

function isPortalUserLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("portal users") &&
    normalized.includes("upgrade your plan")
  );
}

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
            <Alert variant="destructive" className="max-w-xl mb-4">
              <AlertCircle />
              <AlertTitle>Invite user failed</AlertTitle>
              <AlertDescription>
                {isPortalUserLimitError(error) ? (
                  <div className="space-y-2">
                    <p>Your current plan has reached the portal user limit.</p>
                    <Link
                      href="/account/billing#billing-plans"
                      className="font-medium underline underline-offset-4"
                    >
                      Upgrade plan
                    </Link>
                  </div>
                ) : (
                  error
                )}
              </AlertDescription>
            </Alert>
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
      <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/users")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-add-user"
          disabled={sendInvite.isPending}
        >
          {sendInvite.isPending ? "Sending…" : "Send invitation"}
        </Button>
      </CardFooter>
    </Card>
  );
}
