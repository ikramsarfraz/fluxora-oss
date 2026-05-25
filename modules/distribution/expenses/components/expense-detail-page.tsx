"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Loader2, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ActivityCard } from "@/modules/distribution/components/activity-card";
import { buildExpenseActivityItems } from "../utils/expense-activity";
import {
  useApproveExpense,
  useMarkExpensePaid,
  useRejectExpense,
  useResetExpenseToDraft,
  useSubmitExpense,
} from "../hooks/use-expense-status";
import {
  canTransition,
  expenseStatusPill,
  type ExpenseStatus,
} from "../utils/expense-status";
import { StatusPill } from "@/components/listing-page";
import { Textarea } from "@/components/ui/textarea";
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
          (() => {
            const pill = expenseStatusPill(expense.status);
            return (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {expenseCategoryLabel(expense.category)}
                </Badge>
                <StatusPill label={pill.label} bg={pill.bg} color={pill.color} />
              </div>
            );
          })()
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
              Void
            </Button>
          </>
        ) : null}
      </DetailPageHeader>

      {canManage && (
        <ApprovalSection
          expenseId={expense.id}
          status={expense.status as ExpenseStatus}
          submittedAt={expense.submittedAt}
          submittedByName={null}
          submittedByUserId={expense.submittedByUserId}
          approvedAt={expense.approvedAt}
          approvedByName={null}
          rejectedAt={expense.rejectedAt}
          rejectedByName={null}
          rejectionReason={expense.rejectionReason}
          paidAt={expense.paidAt}
          paidByName={null}
          currentUserId={currentUser?.id ?? null}
        />
      )}

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

      <ExpenseActivitySection expense={expense} />


      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void expense</AlertDialogTitle>
            <AlertDialogDescription>
              Void this expense for{" "}
              <strong>{formatMoney(expense.amount)}</strong> on{" "}
              <strong>{formatDisplayDate(expense.expenseDate)}</strong>?
              It will be hidden from the listing and any recurring schedule
              stops materializing future instances. The row is kept for
              audit and can be restored from the voided-expenses view.
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
                    toast.success("Expense voided.");
                    setShowDelete(false);
                    router.push("/expenses");
                  },
                  onError: (e: Error) => toast.error(e.message),
                });
              }}
            >
              {deleteExpense.isPending ? "Voiding…" : "Void"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ApprovalSection({
  expenseId,
  status,
  submittedAt,
  submittedByUserId,
  approvedAt,
  rejectedAt,
  rejectionReason,
  paidAt,
  currentUserId,
}: {
  expenseId: string;
  status: ExpenseStatus;
  submittedAt: Date | null;
  submittedByName: string | null;
  submittedByUserId: string | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  rejectedAt: Date | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  paidAt: Date | null;
  paidByName: string | null;
  currentUserId: string | null;
}) {
  const submit = useSubmitExpense(expenseId);
  const approve = useApproveExpense(expenseId);
  const reject = useRejectExpense(expenseId);
  const reset = useResetExpenseToDraft(expenseId);
  const markPaid = useMarkExpensePaid(expenseId);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Disable approve when current user is the submitter — mirrors the
  // server-side separation-of-duties check so the user sees the disabled
  // affordance instead of just hitting an error toast.
  const isSelfApprove = !!(
    currentUserId && submittedByUserId && currentUserId === submittedByUserId
  );

  function handleSubmit() {
    submit.mutate(undefined, {
      onSuccess: () => toast.success("Submitted for approval."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function handleApprove() {
    approve.mutate(undefined, {
      onSuccess: () => toast.success("Expense approved."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function handleReject() {
    reject.mutate(rejectReason, {
      onSuccess: () => {
        toast.success("Expense rejected.");
        setRejectOpen(false);
        setRejectReason("");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function handleReset() {
    reset.mutate(undefined, {
      onSuccess: () => toast.success("Returned to draft."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function handleMarkPaid() {
    markPaid.mutate(undefined, {
      onSuccess: () => toast.success("Marked as paid."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const canSubmit = canTransition(status, "submit");
  const canApprove = canTransition(status, "approve");
  const canReject = canTransition(status, "reject");
  const canReset = canTransition(status, "reset");
  const canMarkPaid = canTransition(status, "mark_paid");
  const anyAction = canSubmit || canApprove || canReject || canReset || canMarkPaid;

  return (
    <DetailSection title="Approval">
      {/* Timeline copy — surfaces who acted when */}
      <div className="mb-3 text-sm text-muted-foreground">
        {status === "draft" && (
          <>This expense is a draft. Submit it for approval to start the workflow.</>
        )}
        {status === "submitted" && submittedAt && (
          <>Submitted on {formatDisplayDateTime(submittedAt)}.</>
        )}
        {status === "approved" && approvedAt && (
          <>Approved on {formatDisplayDateTime(approvedAt)}.</>
        )}
        {status === "rejected" && rejectedAt && (
          <>
            Rejected on {formatDisplayDateTime(rejectedAt)}.
            {rejectionReason ? (
              <span className="block mt-1 text-foreground">Reason: {rejectionReason}</span>
            ) : null}
          </>
        )}
        {status === "paid" && paidAt && (
          <>Paid on {formatDisplayDateTime(paidAt)}.</>
        )}
      </div>

      {anyAction ? (
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submit.isPending}
            >
              {submit.isPending ? "Submitting…" : "Submit for approval"}
            </Button>
          )}
          {canApprove && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approve.isPending || isSelfApprove}
              title={
                isSelfApprove
                  ? "You can't approve an expense you submitted."
                  : undefined
              }
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
          )}
          {canReject && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRejectOpen(true)}
              disabled={reject.isPending}
            >
              Reject
            </Button>
          )}
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={reset.isPending}
            >
              {reset.isPending ? "Returning…" : "Return to draft"}
            </Button>
          )}
          {canMarkPaid && (
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? "Marking…" : "Mark as paid"}
            </Button>
          )}
        </div>
      ) : null}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this expense</AlertDialogTitle>
            <AlertDialogDescription>
              The submitter will see your reason and can edit + resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Missing receipt; please attach a copy and resubmit."
            aria-label="Rejection reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={reject.isPending || rejectReason.trim().length === 0}
              onClick={handleReject}
            >
              {reject.isPending ? "Rejecting…" : "Reject expense"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailSection>
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ExpenseActivitySection({ expense }: { expense: ExpenseDetail }) {
  // Same query the AttachmentsSection runs — TanStack dedupes by queryKey
  // so this doesn't fire a second network call. We need the attachments
  // here so the timeline can show upload events alongside the lifecycle
  // transitions held directly on the expense row.
  const { data: attachments, isLoading, isError } = useExpenseAttachments(expense.id);
  const items = buildExpenseActivityItems(expense, attachments ?? []);
  return (
    <ActivityCard items={items} isLoading={isLoading} isError={isError} />
  );
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="size-4" />
            Receipts
          </CardTitle>
          <CardDescription>
            Attach photos or PDFs of receipts and invoices. JPEG, PNG, WebP, HEIC, or PDF · max 10 MB per file.
          </CardDescription>
        </div>
        {canManage ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={upload.isPending}
              aria-hidden
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          // Matches the supplier-invoice attachments card empty state so the
          // two surfaces feel like one feature.
          <div className="border-muted-foreground/25 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-10 text-center text-sm">
            <Paperclip className="size-8 opacity-50" />
            <div className="font-medium">No receipts attached yet</div>
            <div className="text-xs">
              {canManage
                ? "Use Upload to attach a photo or PDF."
                : "Receipts will appear here when uploaded."}
            </div>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map(row => (
              <li
                key={row.fileId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Paperclip className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(row.fileId)}
                      className="truncate text-left text-sm font-medium hover:underline"
                    >
                      {row.originalFilename ?? "Receipt"}
                    </button>
                    <div className="text-muted-foreground truncate text-xs">
                      {formatBytes(row.sizeBytes)}
                      {row.mimeType ? ` · ${row.mimeType}` : ""}
                      {` · uploaded ${formatDisplayDate(
                        row.createdAt instanceof Date
                          ? row.createdAt.toISOString().slice(0, 10)
                          : String(row.createdAt).slice(0, 10),
                      )}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(row.fileId)}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pendingDeleteId === row.fileId}
                      onClick={() => handleRemove(row.fileId)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
