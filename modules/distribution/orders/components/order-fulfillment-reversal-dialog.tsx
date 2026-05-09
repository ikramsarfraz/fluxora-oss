"use client";

import { useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useReverseSalesOrderFulfillment } from "../hooks/use-orders";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { can, getPermissionDeniedReason } from "@/lib/auth/permissions";

import { formatFulfillmentTimestamp } from "./order-fulfillment-utils";

type FulfillmentSummary = {
  id: string;
  quantityFulfilled: number;
  weightLbs: string | null;
  fulfilledAt: Date;
  notes: string | null;
  reversedAt: Date | null;
  productLabel: string;
  fulfilledBy?: {
    fullName: string | null;
  } | null;
};

interface OrderFulfillmentReversalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  fulfillment: FulfillmentSummary | null;
}

export function OrderFulfillmentReversalDialog({
  open,
  onOpenChange,
  orderId,
  fulfillment,
}: OrderFulfillmentReversalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse fulfillment</DialogTitle>
          <DialogDescription>
            Reverse this fulfillment entry instead of editing it in place. The
            line rollups, order status, inventory state, and allocation sync
            will be recalculated automatically.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ReversalBody
            orderId={orderId}
            fulfillment={fulfillment}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReversalBody({
  orderId,
  fulfillment,
  onClose,
}: {
  orderId: string;
  fulfillment: FulfillmentSummary | null;
  onClose: () => void;
}) {
  const reverseFulfillment = useReverseSalesOrderFulfillment();
  const { data: currentUser } = useCurrentPortalUser();
  const canReverse = can(currentUser?.role, "reverse_fulfillment");
  const reverseDeniedReason = canReverse
    ? null
    : getPermissionDeniedReason("reverse_fulfillment");
  const [reversalReason, setReversalReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onReverse() {
    if (!fulfillment) return;

    try {
      setSubmitError(null);
      await reverseFulfillment.mutateAsync({
        salesOrderId: orderId,
        fulfillmentId: fulfillment.id,
        reversalReason: reversalReason.trim() || undefined,
      });
      toast.success("Fulfillment reversed.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reverse fulfillment.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <>
      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not reverse fulfillment</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : reverseDeniedReason ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Reverse is not available</AlertTitle>
          <AlertDescription>{reverseDeniedReason}</AlertDescription>
        </Alert>
      ) : null}

      {fulfillment ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="font-medium">{fulfillment.productLabel}</div>
            <div className="mt-1 text-muted-foreground">
              {fulfillment.quantityFulfilled} qty
              {fulfillment.weightLbs
                ? ` · ${Number(fulfillment.weightLbs).toFixed(2)} lbs`
                : ""}
              {" · "}
              {formatFulfillmentTimestamp(fulfillment.fulfilledAt)}
              {fulfillment.fulfilledBy?.fullName
                ? ` · ${fulfillment.fulfilledBy.fullName}`
                : ""}
            </div>
            {fulfillment.notes ? (
              <div className="mt-2 text-muted-foreground">
                {fulfillment.notes}
              </div>
            ) : null}
          </div>

          <Field>
            <FieldLabel htmlFor="fulfillment-reversal-reason">
              Reversal reason
            </FieldLabel>
            <Textarea
              id="fulfillment-reversal-reason"
              rows={3}
              value={reversalReason}
              onChange={event => setReversalReason(event.target.value)}
              placeholder="Optional note about what was entered incorrectly or what changed…"
            />
          </Field>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void onReverse()}
          disabled={!fulfillment || reverseFulfillment.isPending || !canReverse}
          title={reverseDeniedReason ?? undefined}
        >
          <RotateCcw className="h-4 w-4" />
          {reverseFulfillment.isPending ? "Reversing…" : "Reverse fulfillment"}
        </Button>
      </DialogFooter>
    </>
  );
}
