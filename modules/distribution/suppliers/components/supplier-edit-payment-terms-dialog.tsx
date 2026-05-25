"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useUpdateSupplier } from "../hooks/use-suppliers";
import { NetTermsLegend } from "@/modules/shared/components/net-terms-legend";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  supplierId: string;
  supplierName: string;
  currentNetDays: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupplierEditPaymentTermsDialog({
  supplierId,
  supplierName,
  currentNetDays,
  open,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit payment terms</DialogTitle>
          <DialogDescription>
            Set payment terms for <strong>{supplierName}</strong>. AP aging
            uses these to compute the effective due date for this
            supplier&apos;s invoices.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <EditForm
            supplierId={supplierId}
            currentNetDays={currentNetDays}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  supplierId,
  currentNetDays,
  onCancel,
  onSaved,
}: {
  supplierId: string;
  currentNetDays: number | null | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<string>(
    currentNetDays == null ? "" : String(currentNetDays),
  );
  const [error, setError] = useState<string | null>(null);

  const updateSupplier = useUpdateSupplier();

  function parse():
    | { ok: true; netDays: number | null }
    | { ok: false; error: string } {
    const trimmed = value.trim();
    if (trimmed === "") return { ok: true, netDays: null };
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: "Enter a whole number of days or leave blank." };
    }
    if (n < 0) return { ok: false, error: "Payment terms cannot be negative." };
    if (n > 365)
      return { ok: false, error: "Payment terms cannot exceed 365 days." };
    return { ok: true, netDays: n };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parse();
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    updateSupplier.mutate(
      { id: supplierId, netDays: parsed.netDays },
      {
        onSuccess: () => {
          toast.success("Payment terms updated");
          onSaved();
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  }

  return (
    <>
      <form
        id="form-edit-supplier-terms"
        onSubmit={handleSubmit}
        className="pt-2"
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="form-edit-supplier-terms-net-days">
              Net days
            </FieldLabel>
            <Input
              id="form-edit-supplier-terms-net-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              step={1}
              placeholder="e.g. 30"
              value={value}
              onChange={e => setValue(e.target.value)}
              aria-invalid={Boolean(error)}
              autoFocus
            />
            <FieldDescription>
              Days from invoice date until payment is due. Leave blank for
              Net-0 (due on invoice date).
            </FieldDescription>
            {error ? <FieldError errors={[{ message: error }]} /> : null}
            <NetTermsLegend />
          </Field>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={updateSupplier.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="form-edit-supplier-terms"
          disabled={updateSupplier.isPending}
        >
          {updateSupplier.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
