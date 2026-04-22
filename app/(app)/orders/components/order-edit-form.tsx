"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/hooks/use-products";
import { useSalesOrder, useUpdateSalesOrder } from "@/hooks/use-orders";

import { NewOrderCustomerCard } from "./new-order-customer-card";
import { NewOrderLinesTable } from "./new-order-lines-table";
import { NewOrderSummaryCard } from "./new-order-summary-card";
import {
  getDefaultSalesUnit,
  inferLineUnitType,
} from "./new-order-line-utils";
import {
  newOrderFormSchema,
  type NewOrderFormValues,
} from "./new-order-form.schema";
import { getOrderActionAvailability } from "./order-action-rules";

function emptyDefaults(): NewOrderFormValues {
  return {
    customerId: "",
    orderDate: "",
    deliveryDate: "",
    customerNotes: "",
    internalNotes: "",
    addFuelSurcharge: true,
    discountAmount: "",
    lines: [],
  };
}

export function OrderEditForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: order, isLoading, isError, error } = useSalesOrder(orderId);
  const { data: products } = useProducts();
  const updateOrder = useUpdateSalesOrder();

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: emptyDefaults(),
    mode: "onBlur",
  });

  const actionState = useMemo(
    () => (order ? getOrderActionAvailability(order) : null),
    [order],
  );

  useEffect(() => {
    if (!order || !products) return;

    const productsById = new Map(products.map(product => [product.id, product]));
    form.reset({
      customerId: order.customerId,
      orderDate: order.orderDate,
      deliveryDate: order.dueDate ?? "",
      customerNotes: order.customerNotes ?? "",
      internalNotes: order.internalNotes ?? "",
      addFuelSurcharge: order.addFuelSurcharge,
      discountAmount: "",
      lines:
        order.lines?.map(line => {
          const product = productsById.get(line.productId);
          const defaultSalesUnit = getDefaultSalesUnit(product);
          return {
            key: line.id,
            existingLineId: line.id,
            productId: line.productId,
            salesUnitId: line.salesUnitId ?? defaultSalesUnit?.unitId ?? "",
            unitType: line.unitType ?? inferLineUnitType(product),
            quantity: String(line.expectedCases),
            pricePerLb: line.pricePerLbOverride ?? product?.defaultPricePerLb ?? "",
          };
        }) ?? [],
    });
  }, [form, order, products]);

  async function handleSubmit() {
    setSubmitError(null);
    const valid = await form.trigger();

    if (!valid || !order) {
      toast.error("Fix the errors above before saving.");
      return;
    }

    const values = form.getValues();
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        customerId: values.customerId,
        orderDate: values.orderDate,
        dueDate: values.deliveryDate || null,
        addFuelSurcharge: values.addFuelSurcharge,
        customerNotes: values.customerNotes || null,
        internalNotes: values.internalNotes || null,
        lines: values.lines.map(line => ({
          existingLineId: line.existingLineId,
          productId: line.productId,
          salesUnitId: line.salesUnitId,
          expectedCases: Number(line.quantity),
          unitType: line.unitType,
          pricePerLbOverride: line.pricePerLb || null,
        })),
      });
      toast.success("Sales order updated.");
      router.push(`/orders/${order.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Could not update the order.";
      setSubmitError(message);
      toast.error(message);
    }
  }

  if (isLoading) {
    return <PageLoading message="Loading order editor..." />;
  }

  if (isError || !order) {
    return (
      <PageError
        message={error instanceof Error ? error.message : "Order not found."}
      />
    );
  }

  if (!actionState?.canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`Edit ${order.orderNumber ?? "Sales Order"}`}
          description="This order is no longer editable in the current workflow state."
        >
          <Button asChild variant="outline">
            <Link href={`/orders/${order.id}`}>Back to order</Link>
          </Button>
        </PageHeader>

        <Alert>
          <Lock />
          <AlertTitle>Editing is locked</AlertTitle>
          <AlertDescription>
            {actionState.editReason ??
              "This order can no longer be edited. Use the fulfillment and financial workflow on the detail page instead."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        void handleSubmit();
      }}
      className="flex flex-col gap-6 pb-28"
    >
      <PageHeader
        title={`Edit ${order.orderNumber ?? "Sales Order"}`}
        description="Update order details and line items before fulfillment or invoicing activity begins."
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/orders/${order.id}`)}
          disabled={updateOrder.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={updateOrder.isPending}>
          {updateOrder.isPending ? "Saving…" : "Save changes"}
        </Button>
      </PageHeader>

      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not update order</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <NewOrderCustomerCard control={form.control} />
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Order details</h2>
              <p className="text-sm text-muted-foreground">
                Scheduling and notes for this order.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-order-date">Order date</FieldLabel>
                <Input
                  id="edit-order-date"
                  type="date"
                  {...form.register("orderDate")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-delivery-date">
                  Delivery date
                </FieldLabel>
                <Input
                  id="edit-delivery-date"
                  type="date"
                  {...form.register("deliveryDate")}
                />
              </Field>
              <Field className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch("addFuelSurcharge")}
                    onCheckedChange={checked =>
                      form.setValue("addFuelSurcharge", checked === true)
                    }
                  />
                  <span>Apply customer fuel surcharge</span>
                </label>
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="edit-customer-notes">
                  Notes (visible on invoice)
                </FieldLabel>
                <Textarea
                  id="edit-customer-notes"
                  rows={3}
                  placeholder="Delivery instructions, packing requests…"
                  {...form.register("customerNotes")}
                />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="edit-internal-notes">
                  Internal notes
                </FieldLabel>
                <Textarea
                  id="edit-internal-notes"
                  rows={3}
                  placeholder="Notes for warehouse and office staff…"
                  {...form.register("internalNotes")}
                />
              </Field>
            </div>
          </div>

          <NewOrderLinesTable control={form.control} setValue={form.setValue} />
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <NewOrderSummaryCard control={form.control} showDiscountInput={false} />
        </div>
      </div>
    </form>
  );
}
