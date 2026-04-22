"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSalesOrder } from "@/hooks/use-orders";

import { NewOrderCustomerCard } from "./new-order-customer-card";
import { NewOrderLinesTable } from "./new-order-lines-table";
import { NewOrderSummaryCard } from "./new-order-summary-card";
import {
  newOrderFormSchema,
  type NewOrderFormValues,
} from "./new-order-form.schema";

type SubmitMode = "draft" | "confirm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultValues(): NewOrderFormValues {
  return {
    customerId: "",
    orderDate: todayIso(),
    deliveryDate: "",
    customerNotes: "",
    internalNotes: "",
    addFuelSurcharge: true,
    discountAmount: "",
    lines: [
      {
        key:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `line-${Date.now()}`,
        productId: "",
        salesUnitId: "",
        unitType: "catch_weight",
        quantity: "",
        pricePerLb: "",
      },
    ],
  };
}

export function NewOrderForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);

  const createOrder = useCreateSalesOrder();

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: useMemo(defaultValues, []),
    mode: "onBlur",
  });

  async function handleSubmit(mode: SubmitMode) {
    setSubmitError(null);
    const valid = await form.trigger();

    if (!valid) {
      toast.error("Fix the errors above before continuing.");
      return;
    }
    const values = form.getValues();
    setPendingMode(mode);
    try {
      const order = await createOrder.mutateAsync({
        status: mode === "draft" ? "sales_order" : "confirmed",
        customerId: values.customerId,
        orderDate: values.orderDate,
        dueDate: values.deliveryDate || undefined,
        addFuelSurcharge: values.addFuelSurcharge,
        customerNotes: values.customerNotes || undefined,
        internalNotes: values.internalNotes || undefined,
        lines: values.lines.map(l => ({
          productId: l.productId,
          expectedCases: Number(l.quantity),
          unitType: l.unitType,
          pricePerLbOverride: l.pricePerLb || undefined,
        })),
      });

      toast.success(mode === "draft" ? "Draft saved" : "Order confirmed");

      if (order?.id) {
        router.push(`/orders/${order.id}`);
      } else {
        router.push("/orders");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save order.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setPendingMode(null);
    }
  }

  const isPending = pendingMode !== null;

  return (
    <form
      id="new-order-form"
      onSubmit={e => {
        e.preventDefault();
        void handleSubmit("confirm");
      }}
      className="flex flex-col gap-6 pb-28"
    >
      <PageHeader
        title="Create Sales Order"
        description="Draft a new sales order for a customer. Final weights and totals are captured during fulfillment."
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/orders")}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleSubmit("draft")}
          disabled={isPending}
        >
          {pendingMode === "draft" ? "Saving…" : "Save as draft"}
        </Button>
        <Button type="submit" disabled={isPending}>
          {pendingMode === "confirm" ? "Confirming…" : "Confirm order"}
        </Button>
      </PageHeader>

      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not save order</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <NewOrderCustomerCard control={form.control} />

          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
              <CardDescription>
                Scheduling and notes for this order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  control={form.control}
                  name="orderDate"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="new-order-order-date">
                        Order date *
                      </FieldLabel>
                      <Input
                        {...field}
                        id="new-order-order-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="deliveryDate"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="new-order-delivery-date">
                        Delivery date
                      </FieldLabel>
                      <Input
                        {...field}
                        id="new-order-delivery-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="customerNotes"
                  render={({ field }) => (
                    <Field className="md:col-span-2">
                      <FieldLabel htmlFor="new-order-customer-notes">
                        Notes (visible on invoice)
                      </FieldLabel>
                      <Textarea
                        {...field}
                        id="new-order-customer-notes"
                        rows={2}
                        placeholder="Delivery instructions, packing requests…"
                      />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <Field className="md:col-span-2">
                      <FieldLabel htmlFor="new-order-internal-notes">
                        Internal notes
                      </FieldLabel>
                      <Textarea
                        {...field}
                        id="new-order-internal-notes"
                        rows={2}
                        placeholder="Notes for warehouse and office staff…"
                      />
                    </Field>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <NewOrderLinesTable control={form.control} setValue={form.setValue} />

          {form.formState.errors.lines?.root ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.lines.root.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <NewOrderSummaryCard control={form.control} />
        </div>
      </div>
    </form>
  );
}
