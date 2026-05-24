"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import {
  useDeleteExpense,
  useExpense,
} from "../hooks/use-expenses";
import {
  openExpenseAttachmentDownload,
  useExpenseAttachments,
  useRemoveExpenseAttachment,
  useUploadExpenseAttachment,
} from "../hooks/use-expense-attachments";
import {
  canManageExpenses,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  expenseRecurrenceLabel,
  nextRecurrenceDate,
  type ExpensePaymentMethod,
  type ExpenseRecurrenceInterval,
} from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils/date";

export function ExpenseDetailPage({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const { data: expense, isLoading, error, refetch } = useExpense(expenseId);
  const { data: currentUser } = useCurrentPortalUser();
  const canManage = canManageExpenses(currentUser?.role);
  const [showDelete, setShowDelete] = useState(false);
  const deleteExpense = useDeleteExpense();

  useSetBreadcrumbLabel(
    `/expenses/${expenseId}`,
    expense
      ? `${expenseCategoryLabel(expense.category)} · ${formatMoney(expense.amount)}`
      : null,
  );

  if (isLoading) {
    return <DetailPageSkeleton sections={2} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!expense) {
    return (
      <div className="text-sm text-muted-foreground" role="alert">
        Expense not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={`${expenseCategoryLabel(expense.category)} · ${formatMoney(expense.amount)}`}
        description={`Expense recorded on ${formatDisplayDate(expense.expenseDate)}.`}
        badge={
          <Badge variant="outline" className="font-normal">
            {expenseCategoryLabel(expense.category)}
          </Badge>
        }
      >
        <Button variant="outline" asChild>
          <Link href="/expenses">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        {canManage ? (
          <>
            <Button variant="outline" asChild>
              <Link href={`/expenses/${expense.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        ) : null}
      </DetailPageHeader>

      <DetailSection title="Summary">
        <DetailGrid>
          <DetailField label="Expense date">
            {formatDisplayDate(expense.expenseDate)}
          </DetailField>
          <DetailField label="Category">
            {expenseCategoryLabel(expense.category)}
          </DetailField>
          <DetailField label="Amount">
            <span className="tabular-nums">{formatMoney(expense.amount)}</span>
          </DetailField>
          <DetailField label="Payment method">
            {expensePaymentMethodLabel(
              expense.paymentMethod as ExpensePaymentMethod | null,
            )}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {expense.note ? (
        <DetailSection title="Notes">
          <p className="whitespace-pre-wrap text-sm">{expense.note}</p>
        </DetailSection>
      ) : null}

      {/* Recurrence context — visible only when this row participates in a
          recurring schedule, either as the schedule itself or as a child
          instance the cron materialized. */}
      {expense.recurrenceInterval && expense.recurrenceInterval !== "none" ? (
        <ScheduleSection
          interval={expense.recurrenceInterval as ExpenseRecurrenceInterval}
          startDate={expense.recurrenceStartDate}
          endDate={expense.recurrenceEndDate}
          nextDueDate={expense.recurrenceNextDueDate}
        />
      ) : expense.recurrenceParentId ? (
        <DetailSection title="Recurring schedule">
          <p className="text-sm">
            Auto-generated by a recurring schedule.{" "}
            <Link
              href={`/expenses/${expense.recurrenceParentId}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              View schedule
            </Link>
          </p>
        </DetailSection>
      ) : null}

      <AttachmentsSection expenseId={expense.id} canManage={canManage} />

      <DetailSection title="Metadata">
        <DetailGrid>
          <DetailField label="Created by">
            {expense.createdBy?.fullName ?? "—"}
          </DetailField>
          <DetailField label="Created at">
            {formatDisplayDateTime(expense.createdAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this expense for{" "}
              <strong>{formatMoney(expense.amount)}</strong> on{" "}
              <strong>{formatDisplayDate(expense.expenseDate)}</strong>? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteExpense.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteExpense.isPending}
              onClick={() => {
                deleteExpense.mutate(expense.id, {
                  onSuccess: () => {
                    toast.success("Expense deleted.");
                    setShowDelete(false);
                    router.push("/expenses");
                  },
                  onError: (e: Error) => toast.error(e.message),
                });
              }}
            >
              {deleteExpense.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentsSection({
  expenseId,
  canManage,
}: {
  expenseId: string;
  canManage: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: attachments, isLoading } = useExpenseAttachments(expenseId);
  const upload = useUploadExpenseAttachment(expenseId);
  const remove = useRemoveExpenseAttachment(expenseId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires onChange
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => toast.success("Receipt uploaded."),
      onError: (err: Error) => toast.error(err.message),
    });
  }

  function handleDownload(fileId: string) {
    openExpenseAttachmentDownload({ expenseId, fileId }).catch((err: Error) =>
      toast.error(err.message),
    );
  }

  function handleRemove(fileId: string) {
    setPendingDeleteId(fileId);
    remove.mutate(fileId, {
      onSuccess: () => {
        toast.success("Receipt removed.");
        setPendingDeleteId(null);
      },
      onError: (err: Error) => {
        toast.error(err.message);
        setPendingDeleteId(null);
      },
    });
  }

  const rows = attachments ?? [];

  return (
    <DetailSection title="Receipts">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden
      />
      {canManage ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs text-subtle">
            Accepted: JPEG, PNG, WebP, HEIC, PDF · max 10 MB
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {upload.isPending ? "Uploading…" : "Upload receipt"}
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canManage ? "No receipts attached yet." : "No receipts on this expense."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(row => (
            <li
              key={row.fileId}
              className="flex items-center gap-3 rounded-md border border-border-default bg-card px-3 py-2"
            >
              <Paperclip className="size-4 text-subtle" />
              <button
                type="button"
                onClick={() => handleDownload(row.fileId)}
                className="flex-1 truncate text-left text-sm font-medium text-ink hover:underline"
              >
                {row.originalFilename ?? "Receipt"}
              </button>
              <span className="hidden text-xs text-subtle tabular-nums sm:inline">
                {formatBytes(row.sizeBytes)}
              </span>
              <span className="hidden text-xs text-subtle sm:inline">
                {formatDisplayDate(
                  row.createdAt instanceof Date
                    ? row.createdAt.toISOString().slice(0, 10)
                    : String(row.createdAt).slice(0, 10),
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(row.fileId)}
                aria-label="Download receipt"
              >
                <Download className="size-4" />
              </Button>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingDeleteId === row.fileId}
                  onClick={() => handleRemove(row.fileId)}
                  aria-label="Remove receipt"
                >
                  <Trash2 className="size-4 text-danger-fg" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

function ScheduleSection({
  interval,
  startDate,
  endDate,
  nextDueDate,
}: {
  interval: ExpenseRecurrenceInterval;
  startDate: string | null;
  endDate: string | null;
  nextDueDate: string | null;
}) {
  // Walk the next 3 occurrences from nextDueDate so users can sanity-check
  // the schedule without running the cron. Stops early when the end date
  // is reached.
  const upcoming: string[] = [];
  let cursor = nextDueDate;
  while (cursor != null && upcoming.length < 3) {
    if (endDate && cursor > endDate) break;
    upcoming.push(cursor);
    cursor = nextRecurrenceDate(cursor, interval);
  }

  return (
    <DetailSection title="Recurring schedule">
      <DetailGrid>
        <DetailField label="Repeats">{expenseRecurrenceLabel(interval)}</DetailField>
        <DetailField label="First run">
          {startDate ? formatDisplayDate(startDate) : "—"}
        </DetailField>
        <DetailField label="Ends">
          {endDate ? formatDisplayDate(endDate) : "No end date"}
        </DetailField>
        <DetailField label="Next due">
          {nextDueDate ? formatDisplayDate(nextDueDate) : "Exhausted"}
        </DetailField>
      </DetailGrid>
      {upcoming.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Upcoming:{" "}
          {upcoming.map((d, i) => (
            <span key={d}>
              <span className="tabular-nums text-foreground">{formatDisplayDate(d)}</span>
              {i < upcoming.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </DetailSection>
  );
}
