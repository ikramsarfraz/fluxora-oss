"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useDemo } from "../state";
import type { ImportedInvoice, Supplier } from "../types";

type Props = {
  invoice: ImportedInvoice;
};

export function InvoiceHeader({ invoice }: Props) {
  return (
    <section
      data-section="header"
      className="rounded-md border border-border-default bg-card"
    >
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-ink">Invoice details</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
            Extracted
          </span>
        </div>
        <Sparkles className="size-3 text-forest-mid/60" aria-label="AI-extracted" />
      </header>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <SupplierField invoice={invoice} />

        <Field>
          <FieldLabel htmlFor="invoice-number">Invoice number</FieldLabel>
          <InvoiceNumberField invoice={invoice} />
        </Field>

        <Field>
          <FieldLabel htmlFor="invoice-date">Invoice date</FieldLabel>
          <DateField
            invoice={invoice}
            field="invoiceDate"
            id="invoice-date"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="due-date">Due date</FieldLabel>
          <DateField invoice={invoice} field="dueDate" id="due-date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <CurrencyField invoice={invoice} />
        </Field>
      </div>
    </section>
  );
}

function SupplierField({ invoice }: Props) {
  const { state, dispatch } = useDemo();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CreateSupplierInline
        prefillName={invoice.supplierName}
        onCancel={() => setCreating(false)}
        onCreate={(s) => {
          dispatch({ type: "CREATE_SUPPLIER", supplier: s });
          setCreating(false);
        }}
      />
    );
  }

  const selected = state.suppliers.find((s) => s.id === invoice.supplierId);

  return (
    <Field>
      <FieldLabel htmlFor="supplier-trigger">Supplier</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id="supplier-trigger"
            data-reel="supplier-trigger"
            variant="secondary"
            className={cn(
              "h-9 w-full justify-between font-normal",
              !selected &&
                "border-danger-border/70 bg-danger-bg/30 text-danger-fg",
            )}
          >
            <span className="truncate">
              {selected ? (
                selected.name
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-danger-fg" />
                  Select supplier
                </span>
              )}
            </span>
            <ChevronDown className="size-3.5 text-subtle" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em] text-subtle">
            Extracted from invoice
          </DropdownMenuLabel>
          <DropdownMenuItem disabled className="opacity-100">
            <span className="font-medium">{invoice.supplierName}</span>
            <span className="ml-auto text-[10px] text-subtle">not in catalog</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em] text-subtle">
            Your suppliers
          </DropdownMenuLabel>
          {state.suppliers.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() =>
                dispatch({
                  type: "UPDATE_HEADER",
                  patch: { supplierId: s.id, supplierName: s.name },
                })
              }
            >
              <span className="flex-1">{s.name}</span>
              <span className="text-[10px] text-subtle">Net {s.netDays}</span>
              {invoice.supplierId === s.id && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus className="size-3.5" />
            Create supplier {`"${invoice.supplierName}"`}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {selected ? (
        <FieldDescription>
          Net {selected.netDays} · {selected.defaultCurrency}
        </FieldDescription>
      ) : (
        <FieldDescription className="text-danger-fg">
          Required to save the invoice.
        </FieldDescription>
      )}
    </Field>
  );
}

function InvoiceNumberField({ invoice }: Props) {
  const { dispatch } = useDemo();
  return (
    <Input
      id="invoice-number"
      value={invoice.invoiceNumber}
      onChange={(e) =>
        dispatch({
          type: "UPDATE_HEADER",
          patch: { invoiceNumber: e.target.value },
        })
      }
      className="font-mono text-[12px]"
    />
  );
}

function DateField({
  invoice,
  field,
  id,
}: {
  invoice: ImportedInvoice;
  field: "invoiceDate" | "dueDate";
  id: string;
}) {
  const { dispatch } = useDemo();
  return (
    <Input
      id={id}
      type="date"
      value={invoice[field]}
      onChange={(e) =>
        dispatch({ type: "UPDATE_HEADER", patch: { [field]: e.target.value } })
      }
    />
  );
}

function CurrencyField({ invoice }: Props) {
  const { dispatch } = useDemo();
  return (
    <Select
      value={invoice.currency}
      onValueChange={(v) =>
        dispatch({ type: "UPDATE_HEADER", patch: { currency: v } })
      }
    >
      <SelectTrigger id="currency" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USD">USD — US Dollar</SelectItem>
        <SelectItem value="CAD">CAD — Canadian Dollar</SelectItem>
        <SelectItem value="EUR">EUR — Euro</SelectItem>
        <SelectItem value="GBP">GBP — Pound Sterling</SelectItem>
      </SelectContent>
    </Select>
  );
}

function CreateSupplierInline({
  prefillName,
  onCancel,
  onCreate,
}: {
  prefillName: string;
  onCancel: () => void;
  onCreate: (s: Supplier) => void;
}) {
  const [name, setName] = useState(prefillName);
  const [currency, setCurrency] = useState("USD");
  const [netDays, setNetDays] = useState(30);

  function submit() {
    if (!name.trim()) return;
    onCreate({
      id: `sup_new_${Date.now()}`,
      name: name.trim(),
      defaultCurrency: currency,
      netDays,
    });
  }

  return (
    <Field>
      <FieldLabel>New supplier</FieldLabel>
      <div className="rounded-md border border-border-default bg-card-warm p-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-subtle">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Supplier name"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-subtle">
              Currency
            </label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-subtle">
              Payment terms
            </label>
            <Select
              value={String(netDays)}
              onValueChange={(v) => setNetDays(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Due on receipt</SelectItem>
                <SelectItem value="15">Net 15</SelectItem>
                <SelectItem value="30">Net 30</SelectItem>
                <SelectItem value="45">Net 45</SelectItem>
                <SelectItem value="60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>
            Create supplier
          </Button>
        </div>
      </div>
    </Field>
  );
}
