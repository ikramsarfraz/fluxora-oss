"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createSupportTicketAction, uploadTenantSupportTicketAttachmentAction } from "@/actions/support";
import { Card, CardContent } from "@/components/ui/card";
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import {
  Field,
  FieldDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_ISSUE_TYPES,
  SUPPORT_PRIORITIES,
} from "@/lib/support/metadata";
import {
  supportFormSchema,
  type SupportFormParsed,
  type SupportFormValues,
} from "./support-form.schema";

interface SupportFormProps {
  defaults: Pick<SupportFormValues, "name" | "email" | "tenantName">;
}

export function SupportForm({ defaults }: SupportFormProps) {
  const router = useRouter();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SupportFormValues, unknown, SupportFormParsed>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      ...defaults,
      issueType: "bug",
      priority: "medium",
      subject: "",
      message: "",
      pageUrl: "",
    },
  });

  useEffect(() => {
    const pageUrl = document.referrer || window.location.href;
    form.setValue("pageUrl", pageUrl, { shouldDirty: false });
  }, [form]);

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: SupportFormParsed) {
    setError(null);
    try {
      const ticket = await createSupportTicketAction({
        name: data.name,
        email: data.email,
        issueType: data.issueType,
        priority: data.priority,
        subject: data.subject,
        message: data.message,
        pageUrl: data.pageUrl || null,
      });
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        await uploadTenantSupportTicketAttachmentAction(ticket.id, null, formData);
      }
      toast.success("Support ticket submitted.");
      router.push(`/support/${ticket.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not submit support ticket.",
      );
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form id="support-ticket-form" onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert title="We couldn't submit the support ticket.">
              {error}
            </FormErrorAlert>
          ) : null}
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="support-name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="support-name"
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
                    <FieldLabel htmlFor="support-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="support-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="tenantName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="support-tenant">Tenant / company</FieldLabel>
                  <Input
                    {...field}
                    id="support-tenant"
                    readOnly
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="issueType"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="support-issue-type">
                      Issue type
                    </FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="support-issue-type"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_ISSUE_TYPES.map(item => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
              <Controller
                name="priority"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="support-priority">Priority</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="support-priority"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_PRIORITIES.map(item => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="subject"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="support-subject">Subject</FieldLabel>
                  <Input
                    {...field}
                    id="support-subject"
                    placeholder="Briefly describe the issue"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              name="message"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="support-message">Message / details</FieldLabel>
                  <Textarea
                    {...field}
                    id="support-message"
                    rows={7}
                    placeholder="Tell us what happened, what you expected, and steps to reproduce."
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Tell us what happened, what you expected, and steps to
                    reproduce.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Controller
              name="pageUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="support-page-url">
                    Current page URL (optional)
                  </FieldLabel>
                  <Input
                    {...field}
                    id="support-page-url"
                    placeholder="https://..."
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    We auto-fill this when the browser provides it. You can edit
                    or clear it before submitting.
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <Field>
              <FieldLabel htmlFor="support-attachments">
                Supporting documents (optional)
              </FieldLabel>
              <Input
                id="support-attachments"
                type="file"
                multiple
                onChange={event =>
                  setAttachments(Array.from(event.target.files ?? []))
                }
              />
              <FieldDescription>
                Attach screenshots, PDFs, spreadsheets, or notes that help
                explain the issue. Max 25 MB per file.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId="support-ticket-form"
        isPending={isSubmitting}
        onCancel={() => router.push("/support")}
        pendingLabel="Submitting…"
        submitLabel="Create support ticket"
      />
    </Card>
  );
}
