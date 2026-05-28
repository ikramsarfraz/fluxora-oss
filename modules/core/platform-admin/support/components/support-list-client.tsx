"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  bulkAssignSupportTicketsAction,
  bulkUpdateSupportTicketsStatusAction,
} from "@/modules/core/platform-admin/support/actions";

export type SupportListAssignee = {
  id: string;
  label: string;
};

export type SupportListRow = {
  id: string;
  subject: string;
  issueTypeLabel: string;
  priorityLabel: string;
  tenantName: string;
  submitterName: string;
  submitterEmail: string;
  status: string;
  statusLabel: string;
  assigneeLabel: string;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const UNASSIGNED_VALUE = "__unassigned__";

export function SupportListClient({
  rows,
  canManage,
  statusOptions,
  assignees,
  emptyMessage,
}: {
  rows: SupportListRow[];
  canManage: boolean;
  statusOptions: ReadonlyArray<{ value: string; label: string }>;
  assignees: ReadonlyArray<SupportListAssignee>;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingAssignee, setPendingAssignee] = useState<{
    id: string | null;
    label: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const pageIds = useMemo(() => rows.map(r => r.id), [rows]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const someOnPageSelected =
    !allOnPageSelected && pageIds.some(id => selected.has(id));

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

  const closeStatusDialog = () => setPendingStatus(null);
  const closeAssignDialog = () => setPendingAssignee(null);

  const runBulkStatus = (status: string) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkUpdateSupportTicketsStatusAction({
        ticketIds: ids,
        status,
      });
      if (result.ok) {
        toast.success(
          result.skippedCount > 0
            ? `Updated ${result.updatedCount} ticket${
                result.updatedCount === 1 ? "" : "s"
              } (${result.skippedCount} already in this status)`
            : `Updated ${result.updatedCount} ticket${
                result.updatedCount === 1 ? "" : "s"
              }`,
        );
        setSelected(new Set());
        closeStatusDialog();
      } else {
        toast.error(result.message);
      }
    });
  };

  const runBulkAssign = (assigneeId: string | null) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkAssignSupportTicketsAction({
        ticketIds: ids,
        assignedPlatformUserId: assigneeId,
      });
      if (result.ok) {
        toast.success(
          result.skippedCount > 0
            ? `Assigned ${result.updatedCount} ticket${
                result.updatedCount === 1 ? "" : "s"
              } (${result.skippedCount} unchanged)`
            : `Assigned ${result.updatedCount} ticket${
                result.updatedCount === 1 ? "" : "s"
              }`,
        );
        setSelected(new Set());
        closeAssignDialog();
      } else {
        toast.error(result.message);
      }
    });
  };

  const colSpan = canManage ? 11 : 10;

  return (
    <>
      {canManage && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-default bg-surface px-3 py-2 text-sm">
          <span className="font-medium text-ink">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="bulk-status"
              className="text-xs text-muted-foreground"
            >
              Set status
            </Label>
            <Select
              value=""
              onValueChange={value => setPendingStatus(value)}
              disabled={isPending}
            >
              <SelectTrigger id="bulk-status" className="h-8 w-[160px]">
                <SelectValue placeholder="Pick…" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="bulk-assign"
              className="text-xs text-muted-foreground"
            >
              Assign to
            </Label>
            <Select
              value=""
              onValueChange={value => {
                if (value === UNASSIGNED_VALUE) {
                  setPendingAssignee({ id: null, label: "Unassigned" });
                  return;
                }
                const match = assignees.find(a => a.id === value);
                if (match) {
                  setPendingAssignee({ id: match.id, label: match.label });
                }
              }}
              disabled={isPending}
            >
              <SelectTrigger id="bulk-assign" className="h-8 w-[200px]">
                <SelectValue placeholder="Pick…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                {assignees.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            {canManage ? (
              <TableHead className="w-[40px]">
                <Checkbox
                  aria-label="Select all support tickets on this page"
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
            <TableHead>Subject</TableHead>
            <TableHead>Issue type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Submitted by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Attachments</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map(ticket => {
              const isChecked = selected.has(ticket.id);
              return (
                <TableRow
                  key={ticket.id}
                  data-state={isChecked ? "selected" : undefined}
                >
                  {canManage ? (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${ticket.subject}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleRow(ticket.id)}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{ticket.issueTypeLabel}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ticket.priorityLabel}</Badge>
                  </TableCell>
                  <TableCell>{ticket.tenantName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{ticket.submitterName}</span>
                      <span className="text-xs text-muted-foreground">
                        {ticket.submitterEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ticket.statusLabel}</Badge>
                  </TableCell>
                  <TableCell>{ticket.assigneeLabel}</TableCell>
                  <TableCell>{ticket.attachmentCount}</TableCell>
                  <TableCell>{formatDisplayDate(ticket.createdAt)}</TableCell>
                  <TableCell>{formatDisplayDate(ticket.updatedAt)}</TableCell>
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
        open={pendingStatus !== null}
        onOpenChange={open => {
          if (!open) closeStatusDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set status to{" "}
              {pendingStatus
                ? (statusOptions.find(o => o.value === pendingStatus)?.label ??
                  pendingStatus)
                : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies to {selected.size} selected ticket
              {selected.size === 1 ? "" : "s"}. Tenant submitters whose tickets
              change status will receive an email notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending || pendingStatus === null}
              onClick={() => pendingStatus && runBulkStatus(pendingStatus)}
            >
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingAssignee !== null}
        onOpenChange={open => {
          if (!open) closeAssignDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Assign to {pendingAssignee?.label ?? ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies to {selected.size} selected ticket
              {selected.size === 1 ? "" : "s"}.
              {pendingAssignee?.id
                ? " The new assignee will receive a single notification email."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending || pendingAssignee === null}
              onClick={() =>
                pendingAssignee && runBulkAssign(pendingAssignee.id)
              }
            >
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
