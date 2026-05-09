"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
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
  canManageExpenses,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  type ExpensePaymentMethod,
} from "@/lib/expenses/metadata";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

      <DetailSection title="Metadata">
        <DetailGrid>
          <DetailField label="Created by">
            {expense.createdBy?.fullName ?? "—"}
          </DetailField>
          <DetailField label="Created at">
            {formatDateTime(expense.createdAt)}
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
