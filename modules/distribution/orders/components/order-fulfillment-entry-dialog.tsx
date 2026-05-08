"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { AlertCircle, Info, PackagePlus, Scale } from "lucide-react";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useMarkSalesOrderLineShortShipped,
  useRecordSalesOrderFulfillment,
} from "../hooks/use-orders";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";

import type { SalesOrderDetail } from "../services/orders";

import { getOrderActionAvailability } from "./order-action-rules";
import {
  getLineFulfillmentState,
  getLineRemainingQuantity,
} from "./order-fulfillment-utils";

type Line = SalesOrderDetail["lines"][number];

interface OrderFulfillmentEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrderDetail;
}

interface FulfillmentFormValues {
  salesOrderLineId: string;
  quantityFulfilled: string;
  weightLbs: string;
  notes: string;
}

interface LineOption {
  id: string;
  label: string;
  subtitle: string;
  line: Line;
  remainingQuantity: number;
}

function makeDefaultValues(line?: LineOption): FulfillmentFormValues {
  return {
    salesOrderLineId: line?.id ?? "",
    quantityFulfilled: line ? String(line.remainingQuantity) : "1",
    weightLbs: "",
    notes: "",
  };
}

function buildLineOptions(lines: Line[]): LineOption[] {
  return lines
    .map(line => {
      const remainingQuantity = getLineRemainingQuantity(line);
      const productLabel = line.product
        ? `${line.product.sku} · ${line.product.name}`
        : "Line item";

      return {
        id: line.id,
        label: productLabel,
        subtitle: `${remainingQuantity} remaining · ${line.unitType === "catch_weight" ? "Catch weight" : "Fixed unit"}`,
        line,
        remainingQuantity,
      };
    })
    .filter(option => option.remainingQuantity > 0);
}

function getQuantityValidationMessage(
  value: string,
  selectedLine: LineOption | undefined,
): string | true {
  if (!value) return "Enter a fulfilled quantity.";

  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return "Quantity must be a positive whole number.";
  }

  if (!selectedLine) return "Select a sales order line.";

  if (quantity > selectedLine.remainingQuantity) {
    return `Quantity cannot exceed ${selectedLine.remainingQuantity} remaining.`;
  }

  return true;
}

function getWeightValidationMessage(
  value: string,
  selectedLine: LineOption | undefined,
): string | true {
  if (!selectedLine) return "Select a sales order line.";

  if (selectedLine.line.unitType === "catch_weight") {
    if (!value) return "Enter the billed weight captured during fulfillment.";
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) {
      return "Weight must be greater than 0.";
    }
    return true;
  }

  if (!value) return true;
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 0) {
    return "Weight must be a non-negative number.";
  }
  return true;
}

export function OrderFulfillmentEntryDialog({
  open,
  onOpenChange,
  order,
}: OrderFulfillmentEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record fulfillment</DialogTitle>
          <DialogDescription>
            Capture fulfilled quantity and billed weight. Inventory is linked
            automatically from the order&apos;s oldest allocated lots.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <FulfillmentEntryBody
            order={order}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FulfillmentEntryBody({
  order,
  onClose,
}: {
  order: SalesOrderDetail;
  onClose: () => void;
}) {
  const createFulfillment = useRecordSalesOrderFulfillment();
  const markShortShipped = useMarkSalesOrderLineShortShipped();
  const { data: currentUser } = useCurrentPortalUser();
  const actionState = useMemo(
    () => getOrderActionAvailability(order, currentUser?.role),
    [order, currentUser?.role],
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lineOptions = useMemo(() => buildLineOptions(order.lines ?? []), [order.lines]);
  const defaultLine = lineOptions[0];

  const form = useForm<FulfillmentFormValues>({
    defaultValues: makeDefaultValues(defaultLine),
    mode: "onBlur",
  });

  const selectedLineId = useWatch({
    control: form.control,
    name: "salesOrderLineId",
  });

  const selectedLine = useMemo(
    () => lineOptions.find(option => option.id === selectedLineId),
    [lineOptions, selectedLineId],
  );
  const selectedLineRemainingQuantity = selectedLine?.remainingQuantity;
  const selectedLineUnitType = selectedLine?.line.unitType;

  useEffect(() => {
    if (!selectedLineId || selectedLineRemainingQuantity == null) return;

    form.setValue("quantityFulfilled", String(selectedLineRemainingQuantity), {
      shouldDirty: false,
      shouldValidate: true,
    });

    if (selectedLineUnitType !== "catch_weight") {
      form.setValue("weightLbs", "", { shouldValidate: true });
    }
  }, [form, selectedLineId, selectedLineRemainingQuantity, selectedLineUnitType]);

  const isCatchWeight = selectedLine?.line.unitType === "catch_weight";
  const isSubmitting =
    createFulfillment.isPending || markShortShipped.isPending;
  const canRecordFulfillment = actionState.canFulfill;
  const recordFulfillmentReason = actionState.fulfillReason;
  const canShortShip = actionState.canShortShip;
  const shortShipReason = actionState.shortShipReason;
  const canSubmit =
    lineOptions.length > 0 && !isSubmitting && canRecordFulfillment;

  async function onSubmit(values: FulfillmentFormValues) {
    setSubmitError(null);

    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Fix the fulfillment entry fields and try again.");
      return;
    }

    try {
      await createFulfillment.mutateAsync({
        salesOrderId: order.id,
        salesOrderLineId: values.salesOrderLineId,
        quantityFulfilled: Number.parseInt(values.quantityFulfilled, 10),
        weightLbs: values.weightLbs || undefined,
        notes: values.notes.trim() || undefined,
      });

      toast.success("Fulfillment recorded.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not record fulfillment.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  async function onShortShip() {
    if (!selectedLine) {
      toast.error("Select a sales order line first.");
      return;
    }

    try {
      setSubmitError(null);
      await markShortShipped.mutateAsync({
        salesOrderId: order.id,
        salesOrderLineId: selectedLine.id,
        notes: form.getValues("notes").trim() || undefined,
      });
      toast.success("Line marked short shipped.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not short ship line.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <>
      {submitError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not record fulfillment</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : !canRecordFulfillment && recordFulfillmentReason ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Recording fulfillment is not available</AlertTitle>
            <AlertDescription>{recordFulfillmentReason}</AlertDescription>
          </Alert>
        ) : null}

        {lineOptions.length === 0 ? (
          <Alert>
            <PackagePlus />
            <AlertTitle>No open lines</AlertTitle>
            <AlertDescription>
              Every line on this order has already been closed by fulfillment or
              short shipment.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            id="order-fulfillment-entry-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <Controller
              control={form.control}
              name="salesOrderLineId"
              rules={{
                validate: value =>
                  lineOptions.some(option => option.id === value) ||
                  "Select an open sales order line.",
              }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Sales order line *</FieldLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={value => {
                      const nextLine = lineOptions.find(option => option.id === value);
                      field.onChange(value);
                      form.setValue(
                        "quantityFulfilled",
                        nextLine ? String(nextLine.remainingQuantity) : "1",
                        { shouldValidate: true },
                      );
                      form.setValue("weightLbs", "", { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Select a line…" />
                    </SelectTrigger>
                    <SelectContent>
                      {lineOptions.map(option => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLine ? (
                    <>
                      <FieldDescription>{selectedLine.subtitle}</FieldDescription>
                      {getLineFulfillmentState(selectedLine.line) === "partial" ? (
                        <FieldDescription>
                          This line already has partial fulfillment recorded. You
                          can add more fulfillment or close the remaining
                          quantity as a short ship.
                        </FieldDescription>
                      ) : null}
                    </>
                  ) : null}
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            {selectedLine ? (
              <Alert>
                {isCatchWeight ? <Scale /> : <PackagePlus />}
                <AlertTitle>
                  {isCatchWeight ? "Catch-weight line" : "Fixed-unit line"}
                </AlertTitle>
                <AlertDescription>
                  {isCatchWeight
                    ? "Billed weight comes from fulfillment for this product. Enter the captured weight for the fulfilled quantity below."
                    : "Quantity is the primary entry for this line. Weight can be omitted unless your team wants to capture it for reference."}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                data-invalid={!!form.formState.errors.quantityFulfilled}
              >
                <FieldLabel htmlFor="order-fulfillment-quantity">
                  Fulfilled quantity *
                </FieldLabel>
                <Input
                  id="order-fulfillment-quantity"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="1"
                  aria-invalid={!!form.formState.errors.quantityFulfilled}
                  {...form.register("quantityFulfilled", {
                    validate: value =>
                      getQuantityValidationMessage(value, selectedLine),
                  })}
                />
                {selectedLine ? (
                  <FieldDescription>
                    Up to {selectedLine.remainingQuantity} remaining on this line.
                  </FieldDescription>
                ) : null}
                <FieldError errors={[form.formState.errors.quantityFulfilled]} />
              </Field>

              {isCatchWeight ? (
                <Field data-invalid={!!form.formState.errors.weightLbs}>
                  <FieldLabel htmlFor="order-fulfillment-weight">
                    Weight (lbs) *
                  </FieldLabel>
                  <Input
                    id="order-fulfillment-weight"
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    placeholder="0.0000"
                    aria-invalid={!!form.formState.errors.weightLbs}
                    {...form.register("weightLbs", {
                      validate: value =>
                        getWeightValidationMessage(value, selectedLine),
                    })}
                  />
                  <FieldDescription>
                    Final billed weight is captured here during fulfillment.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.weightLbs]} />
                </Field>
              ) : null}
            </div>

            <Field>
              <FieldLabel htmlFor="order-fulfillment-notes">
                Notes
              </FieldLabel>
              <Textarea
                id="order-fulfillment-notes"
                rows={3}
                placeholder="Optional warehouse notes, exceptions, or handoff details…"
                {...form.register("notes")}
              />
            </Field>

            <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Fulfillment is recorded with the current timestamp and user, then
                the order summary, line detail rows, activity timeline, and
                financial estimate refresh automatically.
              </span>
            </div>
          </form>
        )}

      <DialogFooter>
        {selectedLine ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void onShortShip()}
            disabled={
              isSubmitting ||
              selectedLine.remainingQuantity <= 0 ||
              !canShortShip
            }
            title={!canShortShip ? (shortShipReason ?? undefined) : undefined}
          >
            {markShortShipped.isPending
              ? "Closing…"
              : `Short ship ${selectedLine.remainingQuantity}`}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="order-fulfillment-entry-form"
          disabled={!canSubmit}
          title={
            !canRecordFulfillment
              ? (recordFulfillmentReason ?? undefined)
              : undefined
          }
        >
          {createFulfillment.isPending ? "Recording…" : "Record fulfillment"}
        </Button>
      </DialogFooter>
    </>
  );
}
