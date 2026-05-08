"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateExpense,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from "@/lib/expenses/metadata";
import type { ExpenseDetail } from "@/services/expenses";

import {
  expenseFormSchema,
  type ExpenseFormParsed,
  type ExpenseFormValues,
} from "../validators/expense.schemas";

type ExpenseFormProps =
  | { mode: "create" }
  | { mode: "edit"; expense: ExpenseDetail };

export function ExpenseForm(props: ExpenseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const defaults: ExpenseFormValues =
    props.mode === "edit"
      ? {
          expenseDate: props.expense.expenseDate,
          category: props.expense.category as ExpenseFormValues["category"],
          amount: String(props.expense.amount),
          paymentMethod:
            (props.expense.paymentMethod as ExpenseFormValues["paymentMethod"]) ??
            "",
          note: props.expense.note ?? "",
        }
      : {
          expenseDate: new Date().toISOString().slice(0, 10),
          category: "other",
          amount: "",
          paymentMethod: "",
          note: "",
        };

  const form = useForm<ExpenseFormValues, unknown, ExpenseFormParsed>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaults,
  });

  const isSubmitting = createExpense.isPending || updateExpense.isPending;
  const formId =
    props.mode === "edit"
      ? `form-edit-expense-${props.expense.id}`
      : "form-new-expense";

  function onSubmit(data: ExpenseFormParsed) {
    setError(null);
    const payload = {
      expenseDate: data.expenseDate,
      category: data.category,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      note: data.note,
    };

    if (props.mode === "create") {
      createExpense.mutate(payload, {
        onSuccess: expense => {
          toast.success("Expense created.");
          router.push(expense?.id ? `/expenses/${expense.id}` : "/expenses");
        },
        onError: (e: Error) => setError(e.message),
      });
      return;
    }

    updateExpense.mutate(
      { id: props.expense.id, ...payload },
      {
        onSuccess: () => {
          toast.success("Expense updated.");
          router.push(`/expenses/${props.expense.id}`);
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          {error ? (
            <FormErrorAlert
              title={
                props.mode === "edit"
                  ? "We couldn't save your changes."
                  : "We couldn't create the expense."
              }
            >
              {error}
            </FormErrorAlert>
          ) : null}
          <FieldGroup>
            <Controller
              name="expenseDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-date`}>
                    Expense date *
                  </FieldLabel>
                  <Input
                    {...field}
                    id={`${formId}-date`}
                    type="date"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="category"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-category`}>
                    Category *
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id={`${formId}-category`}
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
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

            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-amount`}>Amount *</FieldLabel>
                  <Input
                    {...field}
                    id={`${formId}-amount`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="paymentMethod"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-method`}>
                    Payment method
                  </FieldLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={v => field.onChange(v)}
                  >
                    <SelectTrigger id={`${formId}-method`}>
                      <SelectValue placeholder="(none)" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
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

            <Controller
              name="note"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={`${formId}-note`}>Notes</FieldLabel>
                  <Textarea
                    {...field}
                    id={`${formId}-note`}
                    rows={3}
                    placeholder="Optional"
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId={formId}
        isPending={isSubmitting}
        onCancel={() =>
          router.push(
            props.mode === "edit"
              ? `/expenses/${props.expense.id}`
              : "/expenses",
          )
        }
        pendingLabel={props.mode === "edit" ? "Saving…" : "Creating…"}
        submitLabel={
          props.mode === "edit" ? "Save changes" : "Create expense"
        }
      />
    </Card>
  );
}
