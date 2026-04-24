"use client";

import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setTenantActiveAction } from "@/actions/platform-admin";

export function TenantStatusForm({
  tenantId,
  isActive,
}: {
  tenantId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button
        type="button"
        variant={isActive ? "outline" : "default"}
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isPending ? "Saving…" : isActive ? "Deactivate tenant" : "Activate tenant"}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Deactivate tenant?" : "Activate tenant?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Tenant users will lose access to the tenant app until this workspace is activated again."
                : "Tenant users will be able to sign in again on the tenant host."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isActive ? (
            <div className="space-y-2">
              <Label htmlFor="deactivate-tenant-reason">Reason (optional)</Label>
              <Textarea
                id="deactivate-tenant-reason"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Optional context for the audit trail"
                rows={3}
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const updated = await setTenantActiveAction(
                      tenantId,
                      !isActive,
                      isActive ? reason : null,
                    );
                    setOpen(false);
                    toast.success(
                      updated.isActive ? "Tenant activated" : "Tenant deactivated",
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Failed to update tenant.",
                    );
                  }
                });
              }}
            >
              {isPending
                ? "Saving…"
                : isActive
                  ? "Confirm deactivation"
                  : "Confirm activation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
