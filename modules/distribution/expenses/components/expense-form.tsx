"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, ScanLine, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import { uploadExpenseAttachmentAction } from "@/modules/distribution/expenses/actions";

import {
  useCreateExpense,
  useUpdateExpense,
} from "../hooks/use-expenses";
import { useParseExpenseReceipt } from "../hooks/use-parse-expense-receipt";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_RECURRENCE_INTERVALS,
} from "@/lib/expenses/metadata";
import type { ExpenseDetail } from "../services/expenses";

import {
  expenseFormSchema,
  type ExpenseFormParsed,
  type ExpenseFormValues,
} from "../validators/expense.schemas";

type ExpenseFormProps =
  | { mode: "create" }
  | { mode: "edit"; expense: ExpenseDetail };

const ACCEPTED_RECEIPT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const ACCEPT_ATTR = ACCEPTED_RECEIPT_MIME.join(",");
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Map the model's coarse payment hint to one of our enum values. Returns
 *  null when the hint can't be mapped — the form leaves payment method
 *  alone so the user picks it. */
function mapPaymentHint(
  hint: "card" | "cash" | "check" | "ach" | "other" | null,
): ExpenseFormValues["paymentMethod"] | null {
  switch (hint) {
    case "card":
      return "credit_card";
    case "cash":
      return "cash";
    case "check":
      return "check";
    case "ach":
      return "ach";
    default:
      return null;
  }
}

export function ExpenseForm(props: ExpenseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const parseReceipt = useParseExpenseReceipt();

  // Receipt OCR is create-mode only. On the edit screen, the detail-page
  // attachment widget owns receipt management — wedging a parser here too
  // would confuse the "this expense is already created" mental model.
  const showReceiptScanner = props.mode === "create";

  // Staged file (set when the user picks a receipt) — used to (a) drive
  // the scan mutation and (b) auto-attach the file to the new expense
  // on submit. Cleared via the small × button.
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          recurrenceInterval:
            (props.expense.recurrenceInterval as ExpenseFormValues["recurrenceInterval"]) ??
            "none",
          recurrenceEndDate: props.expense.recurrenceEndDate ?? "",
        }
      : {
          expenseDate: new Date().toISOString().slice(0, 10),
          category: "other",
          amount: "",
          paymentMethod: "",
          note: "",
          recurrenceInterval: "none",
          recurrenceEndDate: "",
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

  function pickReceiptFile(file: File) {
    if (file.size === 0) {
      toast.error("That receipt file is empty.");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error(
        `Receipt is too large (max ${MAX_RECEIPT_BYTES / (1024 * 1024)} MB).`,
      );
      return;
    }
    if (
      !ACCEPTED_RECEIPT_MIME.includes(
        file.type as (typeof ACCEPTED_RECEIPT_MIME)[number],
      )
    ) {
      toast.error("Receipt must be a JPEG, PNG, WebP, or PDF.");
      return;
    }

    setStagedFile(file);
    setPrefilledFields(new Set());

    parseReceipt.mutate(file, {
      onSuccess: result => {
        if (result.status !== "success") {
          // Keep the file staged so it still attaches on save — failed
          // OCR doesn't have to lose the receipt itself.
          toast.message("Couldn't read the receipt automatically.", {
            description:
              "Fill the fields by hand; the file is still attached on save.",
          });
          return;
        }
        const filled = new Set<string>();
        if (result.transactionDate) {
          form.setValue("expenseDate", result.transactionDate, {
            shouldDirty: true,
          });
          filled.add("expenseDate");
        }
        if (result.totalAmount) {
          form.setValue("amount", result.totalAmount, { shouldDirty: true });
          filled.add("amount");
        }
        if (result.paymentMethodHint) {
          const mapped = mapPaymentHint(result.paymentMethodHint);
          // Only prefill payment method if the user hasn't already chosen
          // one — the model's hint is informational; user intent wins.
          if (mapped && !form.getValues("paymentMethod")) {
            form.setValue("paymentMethod", mapped, { shouldDirty: true });
            filled.add("paymentMethod");
          }
        }
        if (result.vendorName) {
          const currentNote = form.getValues("note") ?? "";
          if (currentNote.trim().length === 0) {
            form.setValue("note", result.vendorName, { shouldDirty: true });
            filled.add("note");
          }
        }
        setPrefilledFields(filled);
        toast.success("Receipt scanned — review the prefilled fields.");
      },
      onError: e => {
        toast.error(e instanceof Error ? e.message : "Receipt scan failed.");
      },
    });
  }

  function onReceiptInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice re-fires the change
    // event (browsers otherwise silently no-op the second pick).
    event.target.value = "";
    if (file) pickReceiptFile(file);
  }

  function onReceiptDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) pickReceiptFile(file);
  }

  function clearStagedFile() {
    setStagedFile(null);
    setPrefilledFields(new Set());
    parseReceipt.reset();
  }

  function prefillBadge(field: string) {
    if (!prefilledFields.has(field)) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Sparkles className="size-3" aria-hidden="true" />
        AI prefilled
      </span>
    );
  }

  async function onSubmit(data: ExpenseFormParsed) {
    setError(null);
    const payload = {
      expenseDate: data.expenseDate,
      category: data.category,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      note: data.note,
      recurrenceInterval: data.recurrenceInterval,
      recurrenceEndDate:
        data.recurrenceInterval === "none" ? null : data.recurrenceEndDate,
    };

    try {
      if (props.mode === "create") {
        const expense = await createExpense.mutateAsync(payload);
        // Auto-attach the staged receipt to the freshly-created expense.
        // Best-effort: a failure here doesn't unwind the expense — the
        // user can re-attach from the detail page.
        if (stagedFile && expense?.id) {
          try {
            const bytes = await stagedFile.arrayBuffer();
            await uploadExpenseAttachmentAction({
              expenseId: expense.id,
              bytes,
              originalFilename: stagedFile.name,
              mimeType: stagedFile.type || null,
            });
          } catch (uploadErr) {
            console.warn("[expense-form] receipt attach failed", uploadErr);
            toast.warning(
              "Expense saved, but the receipt didn't attach. Add it from the detail page.",
            );
          }
        }
        toast.success("Expense created.");
        router.push(expense?.id ? `/expenses/${expense.id}` : "/expenses");
        return;
      }

      await updateExpense.mutateAsync({ id: props.expense.id, ...payload });
      toast.success("Expense updated.");
      router.push(`/expenses/${props.expense.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    }
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

          {showReceiptScanner ? (
            <ReceiptScanner
              stagedFile={stagedFile}
              isScanning={parseReceipt.isPending}
              onDropZoneClick={() => fileInputRef.current?.click()}
              onDrop={onReceiptDrop}
              onClear={clearStagedFile}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={onReceiptInputChange}
          />

          <FieldGroup>
            <Controller
              name="expenseDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={`${formId}-date`}>
                      Expense date *
                    </FieldLabel>
                    {prefillBadge("expenseDate")}
                  </div>
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
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={`${formId}-amount`}>Amount *</FieldLabel>
                    {prefillBadge("amount")}
                  </div>
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
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={`${formId}-method`}>
                      Payment method
                    </FieldLabel>
                    {prefillBadge("paymentMethod")}
                  </div>
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
              name="recurrenceInterval"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={`${formId}-recurrence`}>Repeats</FieldLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id={`${formId}-recurrence`}>
                      <SelectValue placeholder="Does not repeat" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_RECURRENCE_INTERVALS.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {form.watch("recurrenceInterval") !== "none" ? (
              <Controller
                name="recurrenceEndDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${formId}-recurrence-end`}>
                      Repeat until (optional)
                    </FieldLabel>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      id={`${formId}-recurrence-end`}
                      type="date"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ) : null}

            <Controller
              name="note"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={`${formId}-note`}>Notes</FieldLabel>
                    {prefillBadge("note")}
                  </div>
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

function ReceiptScanner({
  stagedFile,
  isScanning,
  onDropZoneClick,
  onDrop,
  onClear,
}: {
  stagedFile: File | null;
  isScanning: boolean;
  onDropZoneClick: () => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onClear: () => void;
}) {
  // Single component for both empty and staged states. Empty = clickable
  // drop zone. Staged = small chip with filename + a clear button. We
  // keep this inline (vs. a separate file) because it's tightly coupled
  // to the form's local handlers.
  if (stagedFile) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-md border border-border-default bg-muted/40 px-3 py-2 text-sm">
        {isScanning ? (
          <Loader2
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <ScanLine
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{stagedFile.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {isScanning
              ? "Reading receipt…"
              : "Attaches to this expense on save."}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Remove receipt"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <label
      htmlFor="expense-form-receipt-input"
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onClick={e => {
        // Native label behavior would open the input twice in some
        // browsers when we also imperatively click it via the ref —
        // prevent the default and rely on the explicit click.
        e.preventDefault();
        onDropZoneClick();
      }}
      className={cn(
        "mb-5 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border-default px-4 py-3 text-sm transition-colors",
        "hover:bg-muted/40",
      )}
    >
      <ScanLine
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Scan a receipt</div>
        <div className="text-[11px] text-muted-foreground">
          Drop a JPEG, PNG, or PDF. We&apos;ll prefill the fields below.
        </div>
      </div>
    </label>
  );
}
