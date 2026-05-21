"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSetCustomerPrice } from "@/modules/distribution/price-chart/hooks/use-price-chart";

/**
 * Small inline price-setter for the new-order line editor. When the user
 * picks a product that has no per-customer price AND no product default,
 * the price field exposes a "+ Set price" affordance instead of leaving
 * them to bounce over to /price-chart. This dialog writes a
 * (customer, product, NULL-supplier) row in customer_product_prices —
 * the customer's default for this product, independent of which supplier
 * fills the line.
 */
export function NewOrderSetPriceDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  productId,
  productLabel,
  initialPrice,
  baseUnitAbbreviation,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  productId: string;
  productLabel: string;
  initialPrice?: string;
  /**
   * Abbreviation of the product's base UOM (e.g. "lb", "ea", "gal"). Used
   * to label the input "Price per {unit}" and the description. Falls
   * back to "lb" when omitted so older callers keep working unchanged.
   */
  baseUnitAbbreviation?: string;
  /** Called after a successful save with the price the user entered. */
  onSaved: (pricePerLb: string) => void;
}) {
  const unit = baseUnitAbbreviation ?? "lb";
  const [value, setValue] = useState(initialPrice ?? "");
  const [error, setError] = useState<string | null>(null);
  const setPrice = useSetCustomerPrice();

  // Reset the input whenever the dialog is reopened for a different line.
  useEffect(() => {
    if (open) {
      setValue(initialPrice ?? "");
      setError(null);
    }
  }, [open, initialPrice]);

  async function handleSave() {
    const trimmed = value.trim();
    const n = Number(trimmed);
    if (!trimmed || !Number.isFinite(n) || n < 0) {
      setError("Enter a non-negative number.");
      return;
    }
    setError(null);
    try {
      await setPrice.mutateAsync({
        customerId,
        productId,
        pricePerLb: n.toFixed(4),
        supplierId: null,
      });
      toast.success(`Price saved for ${customerName}.`);
      onSaved(n.toFixed(4));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save price.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set price for {customerName}</DialogTitle>
          <DialogDescription>
            Saves the per-{unit} price for{" "}
            <span style={{ fontWeight: 500 }}>{productLabel}</span>. Future
            orders for this customer pre-fill from this value automatically.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-order-set-price-input">
            Price per {unit}
          </FieldLabel>
          <Input
            id="new-order-set-price-input"
            type="number"
            min="0"
            step="0.0001"
            inputMode="decimal"
            placeholder="0.0000"
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !setPrice.isPending) {
                e.preventDefault();
                void handleSave();
              }
            }}
            autoFocus
            aria-invalid={!!error}
          />
          <FieldDescription>
            Stored against the customer (any supplier). Manage per-supplier
            prices in the price chart.
          </FieldDescription>
          {error ? (
            <span style={{ fontSize: "12px", color: "var(--color-danger-fg)" }}>
              {error}
            </span>
          ) : null}
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={setPrice.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={setPrice.isPending}
          >
            {setPrice.isPending ? "Saving…" : "Save price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
