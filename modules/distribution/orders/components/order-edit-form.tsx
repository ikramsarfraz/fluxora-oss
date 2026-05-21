"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { formatMoney } from "@/lib/utils/currency";
import { useCustomer } from "@/modules/distribution/customers/hooks/use-customers";
import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useSalesOrder, useUpdateSalesOrder } from "../hooks/use-orders";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import type { ProductListItem } from "@/modules/distribution/products/services/products";

import { NewOrderCustomerCard } from "./new-order-customer-card";
import { NewOrderLinesTable } from "./new-order-lines-table";
import { NewOrderSummaryCard } from "./new-order-summary-card";
import { getDefaultSalesUnit, inferLineUnitType } from "./new-order-line-utils";
import { useLinesSubtotal } from "./use-lines-subtotal";
import {
  newOrderFormSchema,
  type NewOrderFormValues,
} from "./new-order-form.schema";
import { getOrderActionAvailability } from "./order-action-rules";

// Design tokens mirror new-order-form so the two surfaces look identical.
const C = {
  ink: "var(--color-ink)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

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

type EditorProduct = { defaultPricePerLb?: string | null } | undefined;

/**
 * Resolves the $/lb value to show in the edit form. The line's stored
 * `pricePerLbOverride` is the authoritative input and is never recomputed,
 * so it takes precedence. For legacy rows we fall back to the pricing
 * snapshot (reconstructing $/lb from case pricing) and finally to the
 * product default.
 */
function resolvePricePerLbForEditor(
  line: {
    pricePerLbOverride: string | null;
    pricingUnitTypeSnapshot: "per_lb" | "per_case" | null;
    pricePerUnitSnapshot: string | null;
    pricingConversionSnapshot: string | null;
  },
  product: EditorProduct,
): string {
  if (line.pricePerLbOverride) return line.pricePerLbOverride;

  if (line.pricePerUnitSnapshot) {
    const priceNum = parseFloat(line.pricePerUnitSnapshot);
    if (Number.isFinite(priceNum)) {
      if (line.pricingUnitTypeSnapshot === "per_case") {
        const conv = parseFloat(line.pricingConversionSnapshot ?? "");
        if (Number.isFinite(conv) && conv > 0) {
          return (priceNum / conv).toFixed(4);
        }
      }
      return priceNum.toFixed(4);
    }
  }

  return product?.defaultPricePerLb ?? "";
}

export function OrderEditForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { data: order, isLoading, isError, error } = useSalesOrder(orderId);
  const { data: products } = useProducts();
  const { data: currentUser } = useCurrentPortalUser();
  const updateOrder = useUpdateSalesOrder();

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: emptyDefaults(),
    mode: "onBlur",
  });

  const actionState = useMemo(
    () => (order ? getOrderActionAvailability(order, currentUser?.role) : null),
    [order, currentUser?.role],
  );

  // Mirror new-order-form's live estimate so the sticky action bar shows
  // the same "N items · est $X" line count + total.
  const lines = useWatch({ control: form.control, name: "lines" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const addFuelSurcharge = useWatch({
    control: form.control,
    name: "addFuelSurcharge",
  });
  const discountAmount = useWatch({
    control: form.control,
    name: "discountAmount",
  });
  const { data: selectedCustomer } = useCustomer(customerId);
  const productsById = useMemo(() => {
    const map = new Map<string, ProductListItem>();
    for (const p of products ?? []) map.set(p.id, p);
    return map;
  }, [products]);
  // Same shared subtotal as the new-order form + the Estimate card so
  // all three surfaces agree on real-weight-aware totals for
  // catch-weight lines.
  const { subtotal, filledLineCount } = useLinesSubtotal(lines, productsById);
  const { lineCount, estTotal } = useMemo(() => {
    const fuel = addFuelSurcharge
      ? Number(selectedCustomer?.fuelSurchargeAmount ?? 0) || 0
      : 0;
    const disc = Number(discountAmount) > 0 ? Number(discountAmount) : 0;
    return {
      lineCount: filledLineCount,
      estTotal: Math.max(0, subtotal + fuel - disc),
    };
  }, [subtotal, filledLineCount, selectedCustomer, addFuelSurcharge, discountAmount]);

  useEffect(() => {
    if (!order || !products) return;

    const productsById = new Map(
      products.map(product => [product.id, product]),
    );
    // Mirror the form's optional-discount UI: only seed the input when
    // the order actually has a non-zero discount, otherwise leave the
    // field blank so the "+ Add discount" affordance still shows.
    const storedDiscount = parseFloat(order.discountAmount ?? "0");
    const seededDiscount =
      Number.isFinite(storedDiscount) && storedDiscount > 0
        ? storedDiscount.toFixed(2)
        : "";

    form.reset({
      customerId: order.customerId,
      orderDate: order.orderDate,
      deliveryDate: order.dueDate ?? "",
      customerNotes: order.customerNotes ?? "",
      internalNotes: order.internalNotes ?? "",
      addFuelSurcharge: order.addFuelSurcharge,
      discountAmount: seededDiscount,
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
            inventoryItemIds: (line.allocations ?? [])
              .map(allocation => allocation.inventoryItemId)
              .filter((id): id is string => Boolean(id)),
            quantity: String(line.expectedCases),
            pricePerLb: resolvePricePerLbForEditor(line, product),
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
    setIsSaving(true);
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        customerId: values.customerId,
        orderDate: values.orderDate,
        dueDate: values.deliveryDate || null,
        addFuelSurcharge: values.addFuelSurcharge,
        discountAmount: values.discountAmount || null,
        customerNotes: values.customerNotes || null,
        internalNotes: values.internalNotes || null,
        lines: values.lines.map(line => ({
          existingLineId: line.existingLineId,
          productId: line.productId,
          salesUnitId: line.salesUnitId,
          expectedCases: Number(line.quantity),
          unitType: line.unitType,
          inventoryItemIds: line.inventoryItemIds ?? [],
          pricePerLbOverride: line.pricePerLb || null,
        })),
      });
      toast.success("Sales order updated.");
      router.push(`/orders/${order.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update the order.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
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
            {actionState?.editReason ??
              "This order can no longer be edited. Use the fulfillment and financial workflow on the detail page instead."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const orderLabel = order.orderNumber ?? order.id.slice(0, 8);

  return (
    <>
      <form
        id="order-edit-form"
        onSubmit={e => {
          // Match new-order: swallow form submit so Enter in any input
          // doesn't accidentally save. Explicit save happens via the
          // buttons in the sticky bar below.
          e.preventDefault();
        }}
        style={{ paddingBottom: "72px" }}
      >
        {/* Page header — same shape as new-order-form */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "24px",
            paddingBottom: "22px",
            borderBottom: `1px solid ${C.line}`,
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: C.ink,
              }}
            >
              Edit sales order
            </div>
            <div style={{ fontSize: "13px", color: C.muted, marginTop: "4px" }}>
              <span style={{ fontFamily: C.mono }}>{orderLabel}</span> ·
              update details and line items before fulfillment starts.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <Button
              type="button"
              onClick={() => router.push(`/orders/${order.id}`)}
              disabled={isSaving}
              variant="outline"
              className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider disabled:opacity-60"
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {submitError && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              background: "var(--color-danger-bg)",
              border: "1px solid oklch(80% 0.1 25)",
              borderRadius: C.radiusSm,
              fontSize: "13px",
              color: "oklch(45% 0.22 25)",
            }}
          >
            {submitError}
          </div>
        )}

        {/* Two-column layout — identical to new-order */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "28px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              minWidth: 0,
            }}
          >
            <NewOrderCustomerCard control={form.control} />
            <NewOrderLinesTable
              control={form.control}
              setValue={form.setValue}
            />
            {form.formState.errors.lines?.root && (
              <p style={{ fontSize: "13px", color: "var(--color-danger-fg)" }}>
                {form.formState.errors.lines.root.message}
              </p>
            )}
          </div>

          <div style={{ position: "sticky", top: "76px" }}>
            <NewOrderSummaryCard control={form.control} />
          </div>
        </div>
      </form>

      {/* Sticky action bar — same shell as new-order; single Save action */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: sidebarState === "expanded" && !isMobile ? "16rem" : 0,
          right: 0,
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          zIndex: 10,
          transition: "left 0.2s ease-linear",
        }}
      >
        <div style={{ fontSize: "13px", color: C.muted }}>
          <b style={{ color: C.ink, fontWeight: 500 }}>{lineCount}</b>{" "}
          {lineCount === 1 ? "item" : "items"} · est.{" "}
          <b style={{ fontFamily: C.mono, fontWeight: 500, color: C.ink }}>
            {formatMoney(estTotal)}
          </b>
        </div>
        <div style={{ flex: 1 }} />
        <Button
          type="button"
          onClick={() => router.push(`/orders/${order.id}`)}
          disabled={isSaving}
          variant="outline"
          className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider disabled:opacity-60"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSaving}
          className="h-8 border-forest-mid bg-forest-mid px-3.5 text-[13px] text-card-warm hover:bg-forest disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}
