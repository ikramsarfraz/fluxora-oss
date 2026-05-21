"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { SubscriptionUpgradeMessage } from "@/modules/core/billing/components/subscription/subscription-upgrade-message";
import {
  useCreateSalesOrder,
  useOpenDraftForCustomer,
  useUpdateSalesOrder,
  useUpdateSalesOrderStatus,
} from "../hooks/use-orders";
import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useCustomer } from "@/modules/distribution/customers/hooks/use-customers";
import { formatMoney } from "@/lib/utils/currency";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";
import type { ProductListItem } from "@/modules/distribution/products/services/products";

import { NewOrderCustomerCard } from "./new-order-customer-card";
import { NewOrderLinesTable } from "./new-order-lines-table";
import { NewOrderSummaryCard } from "./new-order-summary-card";
import {
  newOrderFormSchema,
  type NewOrderFormValues,
} from "./new-order-form.schema";
import { calculateLineTotal } from "./new-order-line-utils";

const C = {
  ink: "var(--color-ink)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
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
        inventoryItemIds: [],
        quantity: "",
        pricePerLb: "",
      },
    ],
  };
}

export function NewOrderForm({ initialCustomerId = "" }: { initialCustomerId?: string }) {
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // Drafts the user has explicitly chosen to ignore on this page load.
  // Without this the banner would re-render every time their typing
  // triggers a refetch.
  const [dismissedDraftIds, setDismissedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const draftIdRef = useRef<string | null>(null);
  const autoSaveInProgressRef = useRef(false);
  const isPendingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Tracks the in-flight autosave promise so submit can await it before
  // reading draftIdRef — without this, a user clicking Confirm while an
  // autosave is mid-flight would race and create a duplicate order.
  const autoSavePromiseRef = useRef<Promise<unknown> | null>(null);

  const { data: products } = useProducts();

  const createOrder = useCreateSalesOrder();
  const updateOrder = useUpdateSalesOrder();
  const updateOrderStatus = useUpdateSalesOrderStatus();

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(newOrderFormSchema),
    defaultValues: useMemo(
      () => ({ ...makeDefaultValues(), customerId: initialCustomerId }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
    mode: "onBlur",
  });

  const lines = useWatch({ control: form.control, name: "lines" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const addFuelSurcharge = useWatch({ control: form.control, name: "addFuelSurcharge" });
  const discountAmount = useWatch({ control: form.control, name: "discountAmount" });
  const { data: selectedCustomer } = useCustomer(customerId);
  const { data: existingDraft } = useOpenDraftForCustomer(customerId);
  // Hide the banner if this draft is the session's own autosaved row,
  // or the user already dismissed it. The dismiss set is keyed by
  // draft id so picking a different customer with its own draft
  // resurfaces the banner.
  const showExistingDraftBanner =
    !!existingDraft &&
    existingDraft.id !== draftIdRef.current &&
    !dismissedDraftIds.has(existingDraft.id);
  const { lineCount, estTotal } = useMemo(() => {
    const productsById = new Map<string, ProductListItem>();
    for (const p of products ?? []) productsById.set(p.id, p);

    const filledLines = (lines ?? []).filter(l => l.productId);

    let subtotal = 0;
    for (const l of filledLines) {
      subtotal += calculateLineTotal(l, productsById.get(l.productId)) ?? 0;
    }

    const fuel = addFuelSurcharge
      ? Number(selectedCustomer?.fuelSurchargeAmount ?? 0) || 0
      : 0;
    const disc = Number(discountAmount) > 0 ? Number(discountAmount) : 0;

    return {
      lineCount: filledLines.length,
      estTotal: Math.max(0, subtotal + fuel - disc),
    };
  }, [lines, products, selectedCustomer, addFuelSurcharge, discountAmount]);

  useEffect(() => {
    isPendingRef.current = pendingMode !== null;
  }, [pendingMode]);

  useEffect(() => {
    const { unsubscribe } = form.watch(() => {
      clearTimeout(autoSaveTimerRef.current);
      if (isPendingRef.current || autoSaveInProgressRef.current) return;

      autoSaveTimerRef.current = setTimeout(async () => {
        if (isPendingRef.current || autoSaveInProgressRef.current) return;

        const v = form.getValues();
        const readyLines = (v.lines ?? []).filter(
          (l) => l.productId && l.salesUnitId,
        );
        if (!v.customerId || readyLines.length === 0) return;

        autoSaveInProgressRef.current = true;
        setAutoSaveStatus("saving");

        const orderLines = readyLines.map((l) => ({
          productId: l.productId,
          salesUnitId: l.salesUnitId,
          expectedCases: Number(l.quantity),
          unitType: l.unitType,
          inventoryItemIds: l.inventoryItemIds ?? [],
          pricePerLbOverride: l.pricePerLb || undefined,
        }));

        const payload = {
          customerId: v.customerId,
          orderDate: v.orderDate,
          dueDate: v.deliveryDate || undefined,
          addFuelSurcharge: v.addFuelSurcharge,
          discountAmount: v.discountAmount || undefined,
          customerNotes: v.customerNotes || undefined,
          internalNotes: v.internalNotes || undefined,
          lines: orderLines,
        };

        const work = (async () => {
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
        })();
        autoSavePromiseRef.current = work;
        work.finally(() => {
          if (autoSavePromiseRef.current === work) {
            autoSavePromiseRef.current = null;
          }
        });
      }, 1500);
    });

    return () => {
      unsubscribe();
      clearTimeout(autoSaveTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(mode: SubmitMode) {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Fix the errors above before continuing.");
      return;
    }
    const values = form.getValues();
    setPendingMode(mode);

    // Cancel any pending autosave timer that hasn't fired yet, and wait
    // for an in-flight autosave to finish so draftIdRef is up to date
    // before we read it. Without this, clicking Confirm mid-autosave
    // could create a duplicate order (draftIdRef still null while the
    // autosave's createOrder is in flight).
    clearTimeout(autoSaveTimerRef.current);
    if (autoSavePromiseRef.current) {
      try {
        await autoSavePromiseRef.current;
      } catch {
        // Autosave errors don't block explicit submit — we surface
        // any real failure from the calls below.
      }
    }

    const orderLines = values.lines
      .filter((l) => l.productId && l.salesUnitId)
      .map((l) => ({
        productId: l.productId,
        salesUnitId: l.salesUnitId,
        expectedCases: Number(l.quantity),
        unitType: l.unitType,
        inventoryItemIds: l.inventoryItemIds ?? [],
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
          discountAmount: values.discountAmount || undefined,
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
          discountAmount: values.discountAmount || undefined,
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
          // Form submit fires from Enter in any focused input. We swallow
          // it to avoid an inadvertent confirm — explicit confirm/save
          // happens via the buttons in the sticky action bar.
          e.preventDefault();
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
              className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider disabled:opacity-60"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit("draft")}
              disabled={isPending}
              variant="outline"
              className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider disabled:opacity-60"
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
              background: "var(--color-danger-bg)",
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

        {/* Existing-draft banner — surfaces when the picked customer
            already has an unconfirmed draft from a previous session, so
            the user can resume that one instead of accidentally
            creating a duplicate via the autosave path. */}
        {showExistingDraftBanner && existingDraft && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              background: "var(--color-info-bg)",
              border: "1px solid var(--color-info-border)",
              borderRadius: C.radiusSm,
              fontSize: "13px",
              color: "var(--color-info-fg)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ flex: 1 }}>
              <b style={{ fontWeight: 500 }}>Existing draft</b> for{" "}
              {selectedCustomer?.name ?? "this customer"}
              {" — "}
              <span style={{ fontFamily: C.mono }}>
                {existingDraft.orderNumber ?? existingDraft.id.slice(0, 8)}
              </span>
              {", last edited "}
              {new Date(existingDraft.updatedAt).toLocaleDateString()}.
            </span>
            <Button
              type="button"
              onClick={() => router.push(`/orders/${existingDraft.id}/edit`)}
              variant="outline"
              size="xs"
              className="h-7 border-border-default bg-card px-3 text-[12px] text-ink shadow-none hover:bg-divider"
            >
              Resume draft
            </Button>
            <Button
              type="button"
              onClick={() =>
                setDismissedDraftIds(prev => {
                  const next = new Set(prev);
                  next.add(existingDraft.id);
                  return next;
                })
              }
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-[12px] text-subtle hover:bg-divider hover:text-ink"
            >
              Start fresh
            </Button>
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
        <div style={{ fontSize: "13px", color: C.muted }}>
          <b style={{ color: C.ink, fontWeight: 500 }}>{lineCount}</b>{" "}
          {lineCount === 1 ? "item" : "items"} · est.{" "}
          <b style={{ fontFamily: C.mono, fontWeight: 500, color: C.ink }}>
            {formatMoney(estTotal)}
          </b>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          {autoSaveStatus === "saving" && (
            <span style={{ fontSize: "12px", color: C.muted }}>Saving…</span>
          )}
          {autoSaveStatus === "saved" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: C.muted,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-success-fg)",
                  flexShrink: 0,
                }}
              />
              Draft saved · just now
            </span>
          )}
          {autoSaveStatus === "error" && (
            <span style={{ fontSize: "12px", color: "var(--color-warning-fg)" }}>
              Auto-save failed
            </span>
          )}
        </div>
        <Button
          type="button"
          onClick={() => void handleSubmit("draft")}
          disabled={isPending}
          variant="outline"
          className="h-8 border-border-default bg-card px-3.5 text-[13px] text-ink shadow-none hover:bg-divider disabled:opacity-60"
        >
          {pendingMode === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit("confirm")}
          disabled={isPending}
          className="h-8 border-forest-mid bg-forest-mid px-3.5 text-[13px] text-card-warm hover:bg-forest disabled:opacity-60"
        >
          {pendingMode === "confirm" ? "Confirming…" : "Confirm order"}
        </Button>
      </div>
    </>
  );
}
