"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  SubscriptionPlanBadge,
  SubscriptionStatusBadge,
} from "@/modules/core/billing/components/subscription/subscription-badges";
import { TenantSubscriptionForm } from "@/modules/core/platform-admin/tenants/components/tenant-subscription-form";
import type { PlatformAdminSubscriptionRow } from "@/modules/core/platform-admin/services/platform-admin";

export function SubscriptionsByTenantTable({
  rows,
  emptyMessage,
}: {
  rows: PlatformAdminSubscriptionRow[];
  emptyMessage: string;
}) {
  // The dialog drives an entire form's-worth of local state, so we
  // remount it on tenant change (key=row.id) — way simpler than
  // synchronizing every controlled field whenever the user clicks a
  // different row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRow = rows.find(r => r.id === editingId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trial ends</TableHead>
            <TableHead>Period ends</TableHead>
            <TableHead>Stripe customer</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/tenants/${row.id}`}
                    className="hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.slug}</div>
                  {!row.isActive ? (
                    <Badge variant="outline" className="mt-1">
                      Tenant inactive
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <SubscriptionPlanBadge plan={row.subscriptionPlan} />
                </TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={row.subscriptionStatus} />
                </TableCell>
                <TableCell className="text-xs">
                  {row.trialEndsAt ? formatDisplayDate(row.trialEndsAt) : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {row.currentPeriodEndsAt
                    ? formatDisplayDate(row.currentPeriodEndsAt)
                    : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.stripeCustomerId ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(row.id)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={editingRow !== null}
        onOpenChange={next => {
          if (!next) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? `Edit subscription · ${editingRow.name}` : "Edit subscription"}
            </DialogTitle>
            <DialogDescription>
              Manual corrections to plan, status, billing dates, or Stripe ids.
              Stripe webhooks may overwrite these later — see the warning
              inside the form.
            </DialogDescription>
          </DialogHeader>
          {editingRow ? (
            <TenantSubscriptionForm
              // Remount on tenant change so the form's `useState` initial
              // values pick up the row we just clicked.
              key={editingRow.id}
              tenant={editingRow}
              onSuccess={() => setEditingId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
