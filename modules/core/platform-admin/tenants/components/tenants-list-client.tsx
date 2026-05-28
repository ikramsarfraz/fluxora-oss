"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { bulkSetTenantActiveAction } from "@/modules/core/platform-admin/actions";

export type TenantsListRow = {
  id: string;
  name: string;
  slug: string;
  tenantType: string;
  isActive: boolean;
  subscriptionPlan: React.ComponentProps<typeof SubscriptionPlanBadge>["plan"];
  subscriptionStatus: React.ComponentProps<
    typeof SubscriptionStatusBadge
  >["status"];
  userCount: number;
  createdAt: Date;
};

export function TenantsListClient({
  rows,
  canEdit,
  emptyMessage,
}: {
  rows: TenantsListRow[];
  canEdit: boolean;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<
    "activate" | "deactivate" | null
  >(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const pageIds = useMemo(() => rows.map(r => r.id), [rows]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const someOnPageSelected =
    !allOnPageSelected && pageIds.some(id => selected.has(id));

  const selectedRows = useMemo(
    () => rows.filter(r => selected.has(r.id)),
    [rows, selected],
  );
  const selectedActiveCount = selectedRows.filter(r => r.isActive).length;
  const selectedInactiveCount = selectedRows.length - selectedActiveCount;

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean | "indeterminate") => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked === true) {
        for (const id of pageIds) next.add(id);
      } else {
        for (const id of pageIds) next.delete(id);
      }
      return next;
    });
  };

  const closeDialog = () => {
    setPendingAction(null);
    setReason("");
  };

  const runBulk = (isActive: boolean) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkSetTenantActiveAction({
        tenantIds: ids,
        isActive,
        reason: reason.trim() || null,
      });
      if (result.ok) {
        const verb = isActive ? "Activated" : "Deactivated";
        toast.success(
          result.skippedCount > 0
            ? `${verb} ${result.updatedCount} tenant${
                result.updatedCount === 1 ? "" : "s"
              } (${result.skippedCount} already ${
                isActive ? "active" : "inactive"
              })`
            : `${verb} ${result.updatedCount} tenant${
                result.updatedCount === 1 ? "" : "s"
              }`,
        );
        setSelected(new Set());
        closeDialog();
      } else {
        toast.error(result.message);
      }
    });
  };

  const colSpan = canEdit ? 9 : 8;

  return (
    <>
      {canEdit && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-default bg-surface px-3 py-2 text-sm">
          <span className="font-medium text-ink">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || selectedInactiveCount === 0}
            onClick={() => setPendingAction("activate")}
          >
            Activate{selectedInactiveCount > 0 ? ` (${selectedInactiveCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || selectedActiveCount === 0}
            onClick={() => setPendingAction("deactivate")}
          >
            Deactivate{selectedActiveCount > 0 ? ` (${selectedActiveCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            {canEdit ? (
              <TableHead className="w-[40px]">
                <Checkbox
                  aria-label="Select all tenants on this page"
                  checked={
                    allOnPageSelected
                      ? true
                      : someOnPageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleAllOnPage}
                  disabled={rows.length === 0}
                />
              </TableHead>
            ) : null}
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Tenant Type</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map(tenant => {
              const isChecked = selected.has(tenant.id);
              return (
                <TableRow key={tenant.id} data-state={isChecked ? "selected" : undefined}>
                  {canEdit ? (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${tenant.name}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleRow(tenant.id)}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </TableCell>
                  <TableCell>{tenant.slug}</TableCell>
                  <TableCell className="capitalize">{tenant.tenantType}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.isActive ? "secondary" : "outline"}>
                      {tenant.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SubscriptionPlanBadge plan={tenant.subscriptionPlan} />
                  </TableCell>
                  <TableCell>
                    <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
                  </TableCell>
                  <TableCell>{tenant.userCount}</TableCell>
                  <TableCell>{formatDisplayDate(tenant.createdAt)}</TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={open => {
          if (!open) closeDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "activate"
                ? `Activate ${selectedInactiveCount} tenant${
                    selectedInactiveCount === 1 ? "" : "s"
                  }?`
                : `Deactivate ${selectedActiveCount} tenant${
                    selectedActiveCount === 1 ? "" : "s"
                  }?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "activate"
                ? "Tenant users will be able to sign in again on the affected tenant hosts."
                : "Tenant users will lose access to the affected tenant apps until they're activated again."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingAction === "deactivate" ? (
            <div className="space-y-2">
              <Label htmlFor="bulk-deactivate-reason">Reason (optional)</Label>
              <Textarea
                id="bulk-deactivate-reason"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Optional shared reason for the audit trail"
                rows={3}
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => runBulk(pendingAction === "activate")}
            >
              {isPending
                ? "Saving…"
                : pendingAction === "activate"
                  ? "Confirm activation"
                  : "Confirm deactivation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
