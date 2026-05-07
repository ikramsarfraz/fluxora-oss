"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { SubscriptionUpgradeMessage } from "@/components/subscription/subscription-upgrade-message";
import {
  useCreateSalesOrder,
  useUpdateSalesOrder,
  useUpdateSalesOrderStatus,
} from "@/hooks/use-orders";
import { useProducts } from "@/hooks/use-products";
import { useCustomers } from "@/hooks/use-customers";
import { formatMoney } from "@/lib/utils/currency";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";
import type { ProductListItem } from "@/services/products";

import { NewOrderCustomerCard } from "./new-order-customer-card";
import { NewOrderLinesTable } from "./new-order-lines-table";
import { NewOrderSummaryCard } from "./new-order-summary-card";
import {
  newOrderFormSchema,
  type NewOrderFormValues,
} from "./new-order-form.schema";
import { calculateLineTotal } from "./new-order-line-utils";

const C = {
  ink: "#0c0a09",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type SubmitMode = "draft" | "confirm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeDefaultValues(): NewOrderFormValues {
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
  const { state: sidebarState, isMobile } = useSidebar();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const draftIdRef = useRef<string | null>(null);
  const autoSaveInProgressRef = useRef(false);
  const isPendingRef = useRef(false);

  const { data: products } = useProducts();
  const { data: customers } = useCustomers();

  const createOrder = useCreateSalesOrder();
  const updateOrder = useUpdateSalesOrder();
  const updateOrderStatus = useUpdateSalesOrderStatus();

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: useMemo(() => makeDefaultValues(), []),
    mode: "onBlur",
  });

  const lines = useWatch({ control: form.control, name: "lines" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const addFuelSurcharge = useWatch({ control: form.control, name: "addFuelSurcharge" });
  const discountAmount = useWatch({ control: form.control, name: "discountAmount" });
  const allValues = useWatch({ control: form.control });

  const { lineCount, estTotal } = useMemo(() => {
    const productsById = new Map<string, ProductListItem>();
    for (const p of products ?? []) productsById.set(p.id, p);

    const customer = customers?.find(c => c.id === customerId) ?? null;
    const filledLines = (lines ?? []).filter(l => l.productId);

    let subtotal = 0;
    for (const l of filledLines) {
      subtotal += calculateLineTotal(l, productsById.get(l.productId)) ?? 0;
    }

    const fuel = addFuelSurcharge
      ? Number(customer?.fuelSurchargeAmount ?? 0) || 0
      : 0;
    const disc = Number(discountAmount) > 0 ? Number(discountAmount) : 0;

    return {
      lineCount: filledLines.length,
      estTotal: Math.max(0, subtotal + fuel - disc),
    };
  }, [lines, products, customers, customerId, addFuelSurcharge, discountAmount]);

  useEffect(() => {
    isPendingRef.current = pendingMode !== null;
  }, [pendingMode]);

  useEffect(() => {
    if (isPendingRef.current || autoSaveInProgressRef.current) return;

    const v = allValues as NewOrderFormValues;
    const readyLines = (v.lines ?? []).filter(
      (l) => l.productId && l.salesUnitId,
    );
    if (!v.customerId || readyLines.length === 0) return;

    const timer = setTimeout(async () => {
      if (isPendingRef.current || autoSaveInProgressRef.current) return;
      autoSaveInProgressRef.current = true;
      setAutoSaveStatus("saving");

      const orderLines = readyLines.map((l) => ({
        productId: l.productId,
        salesUnitId: l.salesUnitId,
        expectedCases: Number(l.quantity),
        unitType: l.unitType,
        pricePerLbOverride: l.pricePerLb || undefined,
      }));

      const payload = {
        customerId: v.customerId,
        orderDate: v.orderDate,
        dueDate: v.deliveryDate || undefined,
        addFuelSurcharge: v.addFuelSurcharge,
        customerNotes: v.customerNotes || undefined,
        internalNotes: v.internalNotes || undefined,
        lines: orderLines,
      };

      try {
        if (!draftIdRef.current) {
          const order = await createOrder.mutateAsync({
            ...payload,
            status: "sales_order",
          });
          if (order?.id) draftIdRef.current = order.id;
        } else {
          await updateOrder.mutateAsync({
            id: draftIdRef.current,
            ...payload,
          });
        }
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("error");
      } finally {
        autoSaveInProgressRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [allValues]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(mode: SubmitMode) {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Fix the errors above before continuing.");
      return;
    }
    const values = form.getValues();
    setPendingMode(mode);

    const orderLines = values.lines
      .filter((l) => l.productId && l.salesUnitId)
      .map((l) => ({
        productId: l.productId,
        salesUnitId: l.salesUnitId,
        expectedCases: Number(l.quantity),
        unitType: l.unitType,
        pricePerLbOverride: l.pricePerLb || undefined,
      }));

    const existingDraftId = draftIdRef.current;

    try {
      if (existingDraftId) {
        await updateOrder.mutateAsync({
          id: existingDraftId,
          customerId: values.customerId,
          orderDate: values.orderDate,
          dueDate: values.deliveryDate || undefined,
          addFuelSurcharge: values.addFuelSurcharge,
          customerNotes: values.customerNotes || undefined,
          internalNotes: values.internalNotes || undefined,
          lines: orderLines,
        });
        if (mode === "confirm") {
          await updateOrderStatus.mutateAsync({
            id: existingDraftId,
            status: "confirmed",
          });
        }
        toast.success(mode === "draft" ? "Draft saved" : "Order confirmed");
        router.push(`/orders/${existingDraftId}`);
      } else {
        const order = await createOrder.mutateAsync({
          status: mode === "draft" ? "sales_order" : "confirmed",
          customerId: values.customerId,
          orderDate: values.orderDate,
          dueDate: values.deliveryDate || undefined,
          addFuelSurcharge: values.addFuelSurcharge,
          customerNotes: values.customerNotes || undefined,
          internalNotes: values.internalNotes || undefined,
          lines: orderLines,
        });
        if (order?.id) draftIdRef.current = order.id;
        toast.success(mode === "draft" ? "Draft saved" : "Order confirmed");
        if (order?.id) router.push(`/orders/${order.id}`);
        else router.push("/orders");
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
    <>
      <form
        id="new-order-form"
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit("confirm");
        }}
        style={{ paddingBottom: "72px" }}
      >
        {/* Page header */}
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
              New sales order
            </div>
            <div style={{ fontSize: "13px", color: C.muted, marginTop: "4px" }}>
              Final weights and totals are captured during fulfillment.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <Button
              type="button"
              onClick={() => router.push("/orders")}
              disabled={isPending}
              variant="outline"
              className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit("draft")}
              disabled={isPending}
              variant="outline"
              className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
            >
              {pendingMode === "draft" ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {submitError && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              background: "oklch(97% 0.04 25)",
              border: "1px solid oklch(80% 0.1 25)",
              borderRadius: C.radiusSm,
              fontSize: "13px",
              color: "oklch(45% 0.22 25)",
            }}
          >
            {isLimitReachedMessage(submitError, "maxMonthlyOrders") ? (
              <SubscriptionUpgradeMessage message="Your current plan has reached the monthly order limit." />
            ) : (
              stripSubscriptionEnforcementPrefix(submitError)
            )}
          </div>
        )}

        {/* Two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "28px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", minWidth: 0 }}>
            <NewOrderCustomerCard control={form.control} />
            <NewOrderLinesTable control={form.control} setValue={form.setValue} />
            {form.formState.errors.lines?.root && (
              <p style={{ fontSize: "13px", color: "oklch(55% 0.22 25)" }}>
                {form.formState.errors.lines.root.message}
              </p>
            )}
          </div>

          <div style={{ position: "sticky", top: "76px" }}>
            <NewOrderSummaryCard control={form.control} />
          </div>
        </div>
      </form>

      {/* Sticky action bar */}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontSize: "13px",
            color: C.muted,
          }}
        >
          <span>
            <b style={{ color: C.ink, fontWeight: 500 }}>{lineCount}</b>{" "}
            {lineCount === 1 ? "item" : "items"} · est.{" "}
            <b style={{ fontFamily: C.mono, fontWeight: 500, color: C.ink }}>
              {formatMoney(estTotal)}
            </b>
          </span>
          {autoSaveStatus === "saving" && (
            <span style={{ fontSize: "12px" }}>Saving…</span>
          )}
          {autoSaveStatus === "saved" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "oklch(58% 0.13 155)",
                  flexShrink: 0,
                }}
              />
              Draft saved
            </span>
          )}
          {autoSaveStatus === "error" && (
            <span style={{ fontSize: "12px", color: "oklch(70% 0.13 70)" }}>
              Auto-save failed
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <Button
          type="button"
          onClick={() => void handleSubmit("draft")}
          disabled={isPending}
          variant="outline"
          className="h-8 border-stone-line bg-stone-surface px-3.5 text-[13px] text-stone-ink shadow-none hover:bg-stone-line2 disabled:opacity-60"
        >
          {pendingMode === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit("confirm")}
          disabled={isPending}
          className="h-8 border-stone-ink bg-stone-ink px-3.5 text-[13px] text-stone-surface hover:bg-stone-ink/90 disabled:opacity-60"
        >
          {pendingMode === "confirm" ? "Confirming…" : "Confirm order"}
        </Button>
      </div>
    </>
  );
}
