"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CheckCircle2, XCircle, Download, Upload, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImportType = "products" | "suppliers" | "customers";

type ParsedRow = Record<string, string>;
type ValidationError = { row: number; errors: string[] };
type ColumnSpec = { key: string; label: string; required?: boolean };

// ── Configs ───────────────────────────────────────────────────────────────────

const CONFIGS: Record<ImportType, {
  displayName: string;
  columns: ColumnSpec[];
  templateRows: ParsedRow[];
}> = {
  products: {
    displayName: "Products",
    columns: [
      { key: "sku", label: "SKU", required: true },
      { key: "name", label: "Name", required: true },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "default_price", label: "Default price" },
      { key: "shelf_life_days", label: "Shelf life (days)" },
      { key: "allergens", label: "Allergens" },
    ],
    templateRows: [
      { sku: "BEF-BRSK-01", name: "Beef Brisket", category: "beef", unit: "lb", default_price: "4.50", shelf_life_days: "14", allergens: "" },
      { sku: "CHK-WNG-01", name: "Chicken Wings", category: "poultry", unit: "lb", default_price: "2.20", shelf_life_days: "10", allergens: "" },
    ],
  },
  suppliers: {
    displayName: "Suppliers",
    // Columns mirror the supplier record fields (db/schema.ts → suppliers table).
    // `name` is the only required field — leave the rest blank for any supplier
    // you don't have details for yet.
    columns: [
      { key: "name", label: "Name", required: true },
      { key: "net_days", label: "Payment terms (net days)" },
      { key: "primary_contact_name", label: "Primary contact" },
      { key: "primary_contact_email", label: "Email" },
      { key: "primary_contact_phone", label: "Phone" },
      { key: "tax_id", label: "Tax ID (EIN)" },
      { key: "account_number", label: "Account number" },
      { key: "address_line1", label: "Address line 1" },
      { key: "address_line2", label: "Address line 2" },
      { key: "address_city", label: "City" },
      { key: "address_region", label: "State" },
      { key: "address_postal_code", label: "ZIP" },
      { key: "website_url", label: "Website" },
      { key: "notes", label: "Notes" },
    ],
    templateRows: [
      {
        name: "Carnivore North",
        net_days: "30",
        primary_contact_name: "John Smith",
        primary_contact_email: "ap@carnivore.com",
        primary_contact_phone: "(555) 123-4567",
        tax_id: "12-3456789",
        account_number: "CN-00421",
        address_line1: "123 Market St",
        address_line2: "Suite 400",
        address_city: "San Francisco",
        address_region: "CA",
        address_postal_code: "94103",
        website_url: "carnivorenorth.com",
        notes: "Cold-chain only. Delivery window 6–10am.",
      },
      {
        name: "Fresh Farms",
        net_days: "15",
        primary_contact_name: "Jane Doe",
        primary_contact_email: "billing@freshfarms.com",
        primary_contact_phone: "",
        tax_id: "",
        account_number: "",
        address_line1: "",
        address_line2: "",
        address_city: "",
        address_region: "",
        address_postal_code: "",
        website_url: "",
        notes: "",
      },
    ],
  },
  customers: {
    displayName: "Customers",
    // Columns mirror the customer record fields (db/schema.ts → customers
    // + customer_addresses). `name` is the only required field; address
    // fields are co-required — if any address column is set, address_line1
    // (the only NOT NULL field on customer_addresses) must be set.
    columns: [
      { key: "name", label: "Name", required: true },
      { key: "abbreviation", label: "Invoice prefix" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "tax_id", label: "Tax ID (EIN)" },
      { key: "net_days", label: "Payment terms (net days)" },
      { key: "fuel_surcharge", label: "Fuel surcharge ($)" },
      { key: "address_line1", label: "Street" },
      { key: "address_city", label: "City" },
      { key: "address_state", label: "State" },
      { key: "address_zip", label: "ZIP" },
    ],
    templateRows: [
      {
        name: "City Diner",
        abbreviation: "CD",
        email: "ap@citydiner.com",
        phone: "(555) 123-4567",
        tax_id: "12-3456789",
        net_days: "30",
        fuel_surcharge: "15.00",
        address_line1: "123 Main St",
        address_city: "San Francisco",
        address_state: "CA",
        address_zip: "94103",
      },
      {
        name: "Fast Eats Truck",
        abbreviation: "",
        email: "",
        phone: "(555) 567-8910",
        tax_id: "",
        net_days: "",
        fuel_surcharge: "",
        address_line1: "",
        address_city: "",
        address_state: "",
        address_zip: "",
      },
    ],
  },
};

// ── CSV utils ─────────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = (lines[0] ?? "").split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
  return { headers, rows };
}

function autoMap(csvHeaders: string[], expected: ColumnSpec[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const col of expected) {
    const normalized = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
    const match = csvHeaders.find(h => normalized(h) === normalized(col.key) || normalized(h) === normalized(col.label));
    mapping[col.key] = match ?? "";
  }
  return mapping;
}

function applyMapping(rows: ParsedRow[], mapping: Record<string, string>): ParsedRow[] {
  return rows.map(row => {
    const out: ParsedRow = {};
    for (const [colKey, csvHeader] of Object.entries(mapping)) {
      out[colKey] = csvHeader ? (row[csvHeader] ?? "") : "";
    }
    return out;
  });
}

function validate(rows: ParsedRow[], importType: ImportType): ValidationError[] {
  const errors: ValidationError[] = [];
  rows.forEach((row, i) => {
    const rowErrors: string[] = [];
    if (importType === "products") {
      if (!row.name) rowErrors.push("name is required");
      if (!row.sku) rowErrors.push("sku is required");
    } else if (importType === "suppliers") {
      if (!row.name) rowErrors.push("name is required");
      if (row.primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.primary_contact_email)) {
        rowErrors.push("primary_contact_email is not a valid email");
      }
      // US EIN — accept "123456789" or "12-3456789"; normalized server-side.
      if (row.tax_id && !/^\d{2}-?\d{7}$/.test(row.tax_id)) {
        rowErrors.push("tax_id must be a 9-digit US EIN (e.g. 12-3456789)");
      }
      if (row.net_days) {
        const n = Number(row.net_days);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 365) {
          rowErrors.push("net_days must be a whole number between 0 and 365");
        }
      }
    } else if (importType === "customers") {
      if (!row.name) rowErrors.push("name is required");
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        rowErrors.push("email is not a valid email address");
      }
      if (row.tax_id && !/^\d{2}-?\d{7}$/.test(row.tax_id)) {
        rowErrors.push("tax_id must be a 9-digit US EIN (e.g. 12-3456789)");
      }
      if (row.net_days) {
        const n = Number(row.net_days);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 365) {
          rowErrors.push("net_days must be a whole number between 0 and 365");
        }
      }
      if (row.fuel_surcharge) {
        const n = Number(row.fuel_surcharge);
        if (!Number.isFinite(n) || n < 0) {
          rowErrors.push("fuel_surcharge must be a non-negative number");
        }
      }
      // Address columns are co-required: if any sub-field is filled, the
      // street (the only NOT NULL column on customer_addresses) must be
      // set too — otherwise the address insert fails server-side.
      const anyAddressField = Boolean(
        row.address_city || row.address_state || row.address_zip,
      );
      if (anyAddressField && !row.address_line1) {
        rowErrors.push(
          "address_line1 (street) is required when other address fields are set",
        );
      }
    }
    if (rowErrors.length > 0) errors.push({ row: i + 2, errors: rowErrors });
  });
  return errors;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const c = {
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-default)",
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
  text3: "var(--color-muted)",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  greenBorder: "var(--color-success-border)",
  amber: "#d97706",
  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
} as const;

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Map columns", "Validate", "Apply"] as const;
type Step = 0 | 1 | 2 | 3;

function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: done ? c.green : active ? c.text : "var(--color-border-default)",
                color: done || active ? "var(--color-card)" : c.text3,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? c.text : done ? c.green : c.text3, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? c.green : "var(--color-border-default)", margin: "0 8px", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export type CsvApplyResult = {
  created: number;
  failed: Array<{ row: number; name: string; message: string }>;
};

interface CsvImportModalProps {
  importType: ImportType;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /**
   * Called with the validated, mapped rows when the user clicks Apply.
   * When provided, the modal replaces its built-in mock-success stub with
   * the real result of this call — including per-row failures rendered
   * as errors so the user can fix and re-upload.
   *
   * Pass this from the importing domain (e.g. supplier-page wires a
   * bulkCreateSuppliersAction) to keep the modal generic across types.
   */
  onApply?: (rows: ParsedRow[]) => Promise<CsvApplyResult>;
}

export function CsvImportModal({ importType, open, onClose, onSuccess, onApply }: CsvImportModalProps) {
  const config = CONFIGS[importType];
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappedRows, setMappedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [applying, setApplying] = useState(false);

  function reset() {
    setStep(0);
    setFileName("");
    setCsvHeaders([]);
    setRawRows([]);
    setMapping({});
    setMappedRows([]);
    setErrors([]);
    setApplying(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
      reset();
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large — max 5 MB.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCsv(ev.target?.result as string);
      setCsvHeaders(headers);
      setRawRows(rows);
      setMapping(autoMap(headers, config.columns));
      setStep(1);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large — max 5 MB."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows } = parseCsv(ev.target?.result as string);
      setCsvHeaders(headers);
      setRawRows(rows);
      setMapping(autoMap(headers, config.columns));
      setStep(1);
    };
    reader.readAsText(file);
  }

  function handleMap() {
    const mapped = applyMapping(rawRows, mapping);
    const errs = validate(mapped, importType);
    setMappedRows(mapped);
    setErrors(errs);
    setStep(2);
  }

  async function handleApply() {
    setApplying(true);
    setStep(3);

    // Domain-specific wiring path: caller provided a real apply handler
    // (e.g. supplier page passes bulkCreateSuppliersAction).
    if (onApply) {
      try {
        const result = await onApply(validRows);
        if (result.created > 0) {
          toast.success(
            `Imported ${result.created} ${config.displayName.toLowerCase()}.`,
          );
        }
        if (result.failed.length > 0) {
          // Surface per-row failures as validation errors so the user can
          // fix their CSV and re-upload. Row numbers are +2 to match the
          // existing validate-step display (header row + 1-based index).
          const newErrors: ValidationError[] = result.failed.map(f => ({
            row: f.row + 2,
            errors: [f.message],
          }));
          setErrors(newErrors);
          setStep(2);
          setApplying(false);
          toast.error(
            `${result.failed.length} row${result.failed.length === 1 ? "" : "s"} failed — see errors`,
          );
          return;
        }
        setApplying(false);
        onSuccess?.();
        onClose();
        reset();
      } catch (e) {
        setApplying(false);
        setStep(2);
        toast.error(e instanceof Error ? e.message : "Import failed.");
      }
      return;
    }

    // Fallback stub for import types that haven't been wired up yet (products
    // and customers still go through this path). See GH #160-adjacent
    // follow-ups for those.
    setTimeout(() => {
      setApplying(false);
      toast.success(`Imported ${validRows.length} ${config.displayName.toLowerCase()}`);
      onSuccess?.();
      onClose();
      reset();
    }, 800);
  }

  function downloadTemplate() {
    const header = config.columns.map(c => c.key).join(",");
    const rows = config.templateRows.map(row => config.columns.map(c => row[c.key] ?? "").join(","));
    downloadCsv([header, ...rows].join("\n"), `${importType}_template.csv`);
  }

  function downloadErrors() {
    const errorRowNums = new Set(errors.map(e => e.row - 2));
    const errorRows = mappedRows.filter((_, i) => errorRowNums.has(i));
    if (!errorRows.length) return;
    const keys = config.columns.map(c => c.key);
    const csv = [
      [...keys, "_errors"].join(","),
      ...errorRows.map((row, i) => {
        const origIdx = mappedRows.indexOf(row);
        const err = errors.find(e => e.row === origIdx + 2);
        return [...keys.map(k => row[k] ?? ""), err?.errors.join("; ") ?? ""].join(",");
      }),
    ].join("\n");
    downloadCsv(csv, "import_errors.csv");
  }

  const validRows = mappedRows.filter((_, i) => !errors.some(e => e.row === i + 2));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <DialogHeader>
          <DialogTitle>Import {config.displayName}</DialogTitle>
        </DialogHeader>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
          <Stepper current={step} />

          {/* Step 0: Upload */}
          {step === 0 && (
            <div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${c.borderStrong}`, borderRadius: 10,
                  padding: "40px 24px", textAlign: "center", cursor: "pointer",
                  background: "var(--color-page)", marginBottom: 16,
                  transition: "border-color 0.15s",
                }}
              >
                <Upload size={28} style={{ margin: "0 auto 10px", color: c.text3 }} />
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop a CSV here or click to browse</div>
                <div style={{ fontSize: 12, color: c.text3 }}>Accepts .csv · max 5 MB</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv" onChange={handleFile} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: c.text2 }}>
                <span>Required columns: {config.columns.filter(c => c.required).map(c => c.label).join(", ")}</span>
                <button onClick={downloadTemplate} style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  border: `1px solid ${c.borderStrong}`, borderRadius: 6, background: "var(--color-card)",
                  cursor: "pointer", fontSize: 12, color: c.text2, fontFamily: "inherit",
                }}>
                  <Download size={12} /> Download template
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Map columns */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, color: c.text2, marginBottom: 16 }}>
                File: <strong>{fileName}</strong> · {rawRows.length} rows detected.
                Match each expected column to your CSV header.
              </div>

              {/* Preview of first 3 rows */}
              <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "8px 12px", background: "var(--color-divider)", fontSize: 11, fontWeight: 600, color: c.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  CSV preview (first 3 rows)
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {csvHeaders.slice(0, 5).map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", background: "var(--color-page)", borderBottom: `1px solid ${c.border}`, fontWeight: 600, color: c.text2, whiteSpace: "nowrap" }}>
                            {h}
                          </th>
                        ))}
                        {csvHeaders.length > 5 && <th style={{ padding: "6px 10px", color: c.text3, borderBottom: `1px solid ${c.border}` }}>+{csvHeaders.length - 5} more</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 3).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
                          {csvHeaders.slice(0, 5).map(h => (
                            <td key={h} style={{ padding: "5px 10px", color: c.text2 }}>{row[h] ?? "—"}</td>
                          ))}
                          {csvHeaders.length > 5 && <td />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mapping rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {config.columns.map(col => (
                  <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 160, fontSize: 13, fontWeight: 500, color: c.text, flexShrink: 0 }}>
                      {col.label}
                      {col.required && <span style={{ color: c.red, marginLeft: 2 }}>*</span>}
                    </div>
                    <ArrowRight size={14} style={{ color: c.text3, flexShrink: 0 }} />
                    <Select
                      value={mapping[col.key] ?? ""}
                      onValueChange={val => setMapping(prev => ({ ...prev, [col.key]: val === "__none__" ? "" : val }))}
                    >
                      <SelectTrigger style={{ flex: 1, height: 32, fontSize: 13 }}>
                        <SelectValue placeholder="— not mapped —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not mapped —</SelectItem>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setStep(0)} style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 13, background: "var(--color-card)",
                  color: c.text2, border: `1px solid ${c.borderStrong}`, cursor: "pointer", fontFamily: "inherit",
                }}>Back</button>
                <button onClick={handleMap} style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: c.text, color: "var(--color-card)", border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>Validate →</button>
              </div>
            </div>
          )}

          {/* Step 2: Validate */}
          {step === 2 && (
            <div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: c.green, fontWeight: 500 }}>
                  <CheckCircle2 size={15} /> {validRows.length} rows OK
                </div>
                {errors.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: c.red, fontWeight: 500 }}>
                    <XCircle size={15} /> {errors.length} rows with errors
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div style={{ border: `1px solid ${c.redBorder}`, borderRadius: 8, overflow: "hidden", marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                  <div style={{ padding: "8px 12px", background: c.redBg, fontSize: 11, fontWeight: 600, color: c.red, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${c.redBorder}` }}>
                    Errors
                  </div>
                  {errors.map(e => (
                    <div key={e.row} style={{ padding: "7px 12px", borderBottom: `1px solid ${c.border}`, fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600, color: c.text }}>Row {e.row}:</span>{" "}
                      <span style={{ color: c.red }}>{e.errors.join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}

              {validRows.length === 0 && (
                <div style={{ padding: "16px", background: "var(--color-page)", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13, color: c.text2, marginBottom: 16 }}>
                  No valid rows to import. Fix errors or check your column mapping.
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setStep(1)} style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 13, background: "var(--color-card)",
                  color: c.text2, border: `1px solid ${c.borderStrong}`, cursor: "pointer", fontFamily: "inherit",
                }}>Back</button>
                {errors.length > 0 && (
                  <button onClick={downloadErrors} style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px",
                    borderRadius: 7, fontSize: 12.5, background: "var(--color-card)", color: c.red,
                    border: `1px solid ${c.redBorder}`, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Download size={13} /> Download errors
                  </button>
                )}
                {validRows.length > 0 && (
                  <button onClick={() => setStep(3)} style={{
                    padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                    background: c.text, color: "var(--color-card)", border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>Continue →</button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Apply */}
          {step === 3 && (
            <div>
              {applying ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: c.text2, fontSize: 14 }}>
                  Importing…
                </div>
              ) : (
                <div>
                  <div style={{ padding: "20px", background: "var(--color-page)", border: `1px solid ${c.border}`, borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                      Import {validRows.length} {config.displayName.toLowerCase()}
                    </div>
                    {errors.length > 0 && (
                      <div style={{ fontSize: 13, color: c.text2 }}>
                        {errors.length} row{errors.length !== 1 ? "s" : ""} with errors will be skipped.
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setStep(2)} style={{
                      padding: "7px 14px", borderRadius: 7, fontSize: 13, background: "var(--color-card)",
                      color: c.text2, border: `1px solid ${c.borderStrong}`, cursor: "pointer", fontFamily: "inherit",
                    }}>Back</button>
                    <button onClick={handleApply} style={{
                      padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                      background: c.green, color: "var(--color-card)", border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Import {validRows.length} rows →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── URL-aware wrapper that auto-opens on ?import=true ─────────────────────────

export function useCsvImportModal(importType: ImportType) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "true") {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return { open, openModal, closeModal };
}
