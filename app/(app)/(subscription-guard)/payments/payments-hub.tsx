"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt } from "lucide-react";

import { BillPaymentsPage } from "@/modules/distribution/supplier-payments/components/bill-payments-page";
import { GlobalBillPaymentEntryDialog } from "@/modules/distribution/supplier-payments/components/global-bill-payment-entry-dialog";
import { GlobalPaymentEntryDialog } from "@/modules/distribution/payments/components/global-payment-entry-dialog";
import { PaymentsPage } from "@/modules/distribution/payments/components/payments-page";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";

type TabValue = "customer" | "bill";

const TABS: ReadonlyArray<{
  value: TabValue;
  label: string;
  subtitle: string;
}> = [
  {
    value: "customer",
    label: "Customer payments",
    subtitle: "Customer payments recorded against sales invoices.",
  },
  {
    value: "bill",
    label: "Bill payments",
    subtitle: "Payments recorded against supplier bills.",
  },
];

export function PaymentsHub() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: TabValue = params?.get("tab") === "bill" ? "bill" : "customer";

  const { data: currentUser } = useCurrentPortalUser();
  const canRecordCustomer = can(currentUser?.role, "record_payment");
  const canRecordBill = can(currentUser?.role, "record_supplier_payment");

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);

  const activeMeta = TABS.find(t => t.value === tab) ?? TABS[0];
  const canRecord =
    tab === "customer" ? canRecordCustomer : canRecordBill;

  // Tabs share a URL but each list owns its own pagination/filter/search
  // params. Switching tabs wipes them so the new view starts clean instead
  // of inheriting a sort or filter that doesn't apply.
  function selectTab(next: TabValue) {
    if (next === tab) return;
    const search = next === "customer" ? "" : "?tab=bill";
    router.replace(`/payments${search}`, { scroll: false });
  }

  function openRecordDialog() {
    if (tab === "customer") setCustomerDialogOpen(true);
    else setBillDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
            Payments
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">{activeMeta.subtitle}</p>
        </div>
        {canRecord ? (
          <Button onClick={openRecordDialog} size="sm">
            <Receipt className="h-4 w-4" />
            Record payment
          </Button>
        ) : null}
      </header>

      <div
        role="tablist"
        aria-label="Payments view"
        className="inline-flex w-fit rounded-lg bg-divider p-[3px]"
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              tab === value
                ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-ink-warm hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "customer" ? (
        <PaymentsPage hideHeader />
      ) : (
        <BillPaymentsPage hideHeader />
      )}

      <GlobalPaymentEntryDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
      />
      <GlobalBillPaymentEntryDialog
        open={billDialogOpen}
        onOpenChange={setBillDialogOpen}
      />
    </div>
  );
}
