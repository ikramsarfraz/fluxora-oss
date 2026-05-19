"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import { MOCK_BILLS, fmtAmount, fmtDate } from "./mock-data";

export function BillsArchive() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-72 max-w-full">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            placeholder="Search bills, suppliers…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="text-xs text-subtle">
          <span className="text-ink-warm">{MOCK_BILLS.length}</span> posted ·{" "}
          <span className="font-mono tabular-nums">
            ${fmtAmount(MOCK_BILLS.reduce((s, b) => s + b.totalAmount, 0))}
          </span>{" "}
          total
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border-default bg-card">
        <div
          className="grid gap-[18px] border-b border-border-default bg-divider px-[22px] py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle"
          style={{ gridTemplateColumns: "160px 1fr 130px 120px 130px 80px" }}
        >
          <div>Bill #</div>
          <div>Supplier</div>
          <div>Date</div>
          <div>Payment</div>
          <div className="text-right">Total</div>
          <div className="text-right">Received</div>
        </div>
        {MOCK_BILLS.map((bill) => (
          <div
            key={bill.id}
            className="grid cursor-pointer items-center gap-[18px] border-b border-border-default px-[22px] py-[14px] text-[13px] transition-colors hover:bg-divider/40 last:border-b-0"
            style={{ gridTemplateColumns: "160px 1fr 130px 120px 130px 80px" }}
          >
            <span className="font-mono text-[12.5px] tabular-nums text-ink">
              {bill.referenceNumber}
            </span>
            <span className="font-medium text-ink">{bill.supplierName}</span>
            <span className="tabular-nums text-ink-warm">
              {fmtDate(bill.invoiceDate)}
            </span>
            <span className="text-subtle">{bill.paymentMethod ?? "—"}</span>
            <span
              className="text-right font-mono tabular-nums text-ink"
              data-financial
            >
              ${fmtAmount(bill.totalAmount)}
            </span>
            <span className="text-right text-[11.5px] text-subtle">
              {bill.receivedAt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
