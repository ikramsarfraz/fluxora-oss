"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useReel } from "./reel-state";

// Reproduced from production:
//   modules/distribution/supplier-invoices/components/create-supplier-dialog.tsx
//   modules/distribution/suppliers/components/add-supplier-form.tsx
//   modules/distribution/supplier-invoices/components/create-product-dialog.tsx
//   modules/distribution/products/components/add-product-form.tsx
// JSX and field shape matched 1:1 so the reel renders the same dialogs the
// user would see in the app, just driven by reel state + mock handlers.

export function ReelDialogs() {
  const { state } = useReel();
  if (state.dialog.kind === "create-supplier") {
    return <CreateSupplierDialog prefillName={state.dialog.prefillName} />;
  }
  if (state.dialog.kind === "create-product") {
    return (
      <CreateProductDialog
        lineId={state.dialog.lineId}
        prefillName={state.dialog.prefillName}
      />
    );
  }
  return null;
}

// ---------- Create supplier dialog ----------
function CreateSupplierDialog({ prefillName }: { prefillName: string }) {
  const { state, dispatch } = useReel();
  const [name, setName] = useState(prefillName);
  const [netDays, setNetDays] = useState("30");
  // For manual clicks the dialog still owns local pending; for autopilot
  // clicks the reel-state flag drives the pending UI so the user sees
  // "Creating…" between the cursor flash and the close.
  const [localPending, setLocalPending] = useState(false);
  const pending = localPending || state.dialogPending;

  useEffect(() => {
    setName(prefillName);
  }, [prefillName]);

  function submit() {
    setLocalPending(true);
    window.setTimeout(() => {
      dispatch({
        type: "PICK_SUPPLIER",
        supplierId: "sup_northwind",
        name: name.trim() || "Northwind Trading Co.",
      });
      dispatch({ type: "CLOSE_DIALOG" });
      setLocalPending(false);
    }, 700);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dispatch({ type: "CLOSE_DIALOG" });
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl"
        style={{ padding: 0 }}
      >
        <DialogHeader style={{ padding: "20px 24px 0" }}>
          <DialogTitle>Create supplier from invoice</DialogTitle>
          <DialogDescription>
            We pulled this name from the invoice header. Confirm or adjust it,
            optionally set payment terms, and save — the supplier is assigned
            to this bill automatically.
          </DialogDescription>
        </DialogHeader>
        <div style={{ padding: "16px 24px 24px" }}>
          <Card className="w-full max-w-xl">
            <CardContent className="pt-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="form-add-supplier-name">
                    Supplier name *
                  </FieldLabel>
                  <Input
                    id="form-add-supplier-name"
                    placeholder="e.g. ABC Meat Co."
                    autoComplete="organization"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    // autoFocus removed: scrolls the focused input into view,
                    // which bubbles up from the iframe to the marketing page.
                    // The reel doesn't need real typing focus anyway.
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="form-add-supplier-net-days">
                    Payment terms (net days)
                  </FieldLabel>
                  <Input
                    id="form-add-supplier-net-days"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    step={1}
                    placeholder="e.g. 30"
                    value={netDays}
                    onChange={(e) => setNetDays(e.target.value)}
                  />
                  <FieldDescription>
                    Days from invoice date until payment is due. Leave blank for
                    Net-0 (due on invoice date). Common values: 0, 7, 15, 30.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            <DialogActionFooter
              pending={pending}
              cancelLabel="Cancel"
              submitLabel="Create supplier"
              pendingLabel="Creating…"
              submitReelTarget="dialog-create-supplier-submit"
              onCancel={() => dispatch({ type: "CLOSE_DIALOG" })}
              onSubmit={submit}
              disabled={!name.trim()}
            />
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Create product dialog ----------
function CreateProductDialog({
  lineId,
  prefillName,
}: {
  lineId: number;
  prefillName: string;
}) {
  const { state, dispatch } = useReel();
  const [name, setName] = useState(prefillName);
  const [categories, setCategories] = useState<string[]>(["Drive components"]);
  const [sellingMethod, setSellingMethod] = useState<"weight" | "unit">("unit");
  const [sellByLb, setSellByLb] = useState(false);
  const [sellByCase, setSellByCase] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const pending = localPending || state.dialogPending;

  useEffect(() => {
    setName(prefillName);
  }, [prefillName]);

  function submit() {
    setLocalPending(true);
    window.setTimeout(() => {
      dispatch({
        type: "CREATE_PRODUCT_FOR_LINE",
        lineId,
        productId: `prod_new_${lineId}`,
      });
      dispatch({ type: "CLOSE_DIALOG" });
      setLocalPending(false);
    }, 700);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dispatch({ type: "CLOSE_DIALOG" });
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl"
        style={{ padding: 0 }}
      >
        <DialogHeader style={{ padding: "20px 24px 0" }}>
          <DialogTitle>Create catalog product</DialogTitle>
          <DialogDescription>
            Fill out the full product profile. This is the same form as Settings
            → Products, so the new product is immediately usable for receiving,
            pricing, and order fulfilment.
          </DialogDescription>
        </DialogHeader>
        <div style={{ padding: "16px 24px 24px" }}>
          <Card className="w-full max-w-xl">
            <CardContent className="pt-6">
              <FieldGroup>
                {/* Name */}
                <Field>
                  <FieldLabel htmlFor="form-add-product-name">Name *</FieldLabel>
                  <Input
                    id="form-add-product-name"
                    placeholder="e.g. Beef Ribeye"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    // autoFocus removed: scrolls the focused input into view,
                    // which bubbles up from the iframe to the marketing page.
                    // The reel doesn't need real typing focus anyway.
                  />
                </Field>

                {/* Categories */}
                <Field>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Categories *</FieldLabel>
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="size-3.5" />
                      New category
                    </Button>
                  </div>
                  <CategoryCombobox
                    selected={categories}
                    onChange={setCategories}
                  />
                </Field>

                {/* Selling method */}
                <Field>
                  <FieldLabel>Selling method *</FieldLabel>
                  <div className="flex flex-col gap-2">
                    <SellingMethodOption
                      value="weight"
                      selected={sellingMethod === "weight"}
                      title="By weight — price per pound"
                      description="Meat, fish, deli — invoice uses actual weight."
                      onSelect={() => setSellingMethod("weight")}
                    />
                    <SellingMethodOption
                      value="unit"
                      selected={sellingMethod === "unit"}
                      title="By unit — flat price per item"
                      description="Beverages, dry goods, packaged items."
                      onSelect={() => setSellingMethod("unit")}
                    />
                  </div>
                </Field>

                {/* Selling units */}
                <Field>
                  <FieldLabel>Selling units *</FieldLabel>
                  <div className="flex flex-col gap-4 rounded-md border border-border-default p-4">
                    {sellingMethod === "weight" ? (
                      <>
                        <UnitCheckbox
                          checked={sellByLb}
                          onChange={setSellByLb}
                          label="Sell by the pound (lb)"
                        />
                        <UnitCheckbox
                          checked={sellByCase}
                          onChange={setSellByCase}
                          label="Sell by the case (cs)"
                          nestedLabel={
                            sellByCase ? "Estimated lbs per case" : undefined
                          }
                          nestedPlaceholder="e.g. 40"
                        />
                      </>
                    ) : (
                      <>
                        <UnitCheckbox
                          checked={!sellByCase}
                          onChange={(v) => setSellByCase(!v)}
                          label="Sell by the unit — each (ea)"
                        />
                        <UnitCheckbox
                          checked={sellByCase}
                          onChange={setSellByCase}
                          label="Sell by the case (cs)"
                          nestedLabel={sellByCase ? "Units per case" : undefined}
                          nestedPlaceholder="e.g. 24"
                        />
                      </>
                    )}
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
            <DialogActionFooter
              pending={pending}
              cancelLabel="Cancel"
              submitLabel="Create product"
              pendingLabel="Creating…"
              submitReelTarget="dialog-create-product-submit"
              onCancel={() => dispatch({ type: "CLOSE_DIALOG" })}
              onSubmit={submit}
              disabled={!name.trim() || categories.length === 0}
            />
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Shared footer (mirrors production's FormActionFooter) ----------
function DialogActionFooter({
  pending,
  cancelLabel,
  submitLabel,
  pendingLabel,
  submitReelTarget,
  onCancel,
  onSubmit,
  disabled,
}: {
  pending: boolean;
  cancelLabel: string;
  submitLabel: string;
  pendingLabel: string;
  submitReelTarget?: string;
  onCancel: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border-default px-6 py-4">
      <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
        {cancelLabel}
      </Button>
      <Button
        size="sm"
        data-reel={submitReelTarget}
        onClick={onSubmit}
        disabled={disabled || pending}
        className="gap-1.5 border-forest-mid bg-forest-mid text-card-warm hover:bg-forest"
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}

// ---------- Category combobox (static mock — looks like the real multi-select) ----------
function CategoryCombobox({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function remove(label: string) {
    onChange(selected.filter((s) => s !== label));
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding px-2.5 py-1.5 text-sm">
      {selected.map((label) => (
        <span
          key={label}
          className="flex h-[22px] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground"
        >
          {label}
          <button
            type="button"
            onClick={() => remove(label)}
            aria-label={`Remove ${label}`}
            className="-mr-1 opacity-50 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <span className="flex flex-1 items-center gap-1.5 px-1 text-subtle">
        <Search className="size-3.5" />
        <span className="text-[12.5px]">Search categories…</span>
      </span>
    </div>
  );
}

// ---------- Selling-method option ----------
function SellingMethodOption({
  value,
  selected,
  title,
  description,
  onSelect,
}: {
  value: string;
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
        selected
          ? "border-forest-mid bg-forest-tint/40"
          : "border-border-default bg-card hover:border-divider",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-forest-mid" : "border-border-default",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-forest-mid" /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="text-[12px] text-subtle">{description}</span>
      </span>
    </button>
  );
}

// ---------- Unit checkbox + optional nested input ----------
function UnitCheckbox({
  checked,
  onChange,
  label,
  nestedLabel,
  nestedPlaceholder,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  nestedLabel?: string;
  nestedPlaceholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2 text-[13px] text-ink">
        <span
          onClick={() => onChange(!checked)}
          role="checkbox"
          aria-checked={checked}
          className={cn(
            "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border",
            checked
              ? "border-forest-mid bg-forest-mid text-card-warm"
              : "border-border-default bg-card",
          )}
        >
          {checked ? (
            <svg
              viewBox="0 0 12 12"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 6L5 9L10 3" />
            </svg>
          ) : null}
        </span>
        <span>{label}</span>
      </label>
      {nestedLabel ? (
        <div className="ml-6 flex items-center gap-2">
          <span className="text-[11.5px] uppercase tracking-[0.06em] text-subtle">
            {nestedLabel}
          </span>
          <Input
            type="number"
            className="h-8 w-28 text-[12.5px]"
            placeholder={nestedPlaceholder}
          />
        </div>
      ) : null}
    </div>
  );
}
