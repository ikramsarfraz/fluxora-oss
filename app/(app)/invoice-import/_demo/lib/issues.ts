import type {
  HeaderIssue,
  ImportedInvoice,
  LineIssue,
  LineItem,
  Product,
  Supplier,
} from "../types";
import { lineSubtotal } from "../mock-data";

export type InvoiceIssueSummary = {
  errors: number;
  warnings: number;
  headerIssues: HeaderIssue[];
  byLineId: Map<string, LineIssue[]>;
};

const COST_SPIKE_THRESHOLD = 0.18; // 18% jump

export function computeInvoiceIssues(
  invoice: ImportedInvoice,
  products: Product[],
  suppliers: Supplier[],
  allInvoices: ImportedInvoice[],
): InvoiceIssueSummary {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const supplier = suppliers.find((s) => s.id === invoice.supplierId);

  const byLineId = new Map<string, LineIssue[]>();
  for (const line of invoice.lines) {
    const issues: LineIssue[] = [];

    if (line.kind === "inventory" && line.matchState !== "non-inventory") {
      if (line.unitCost == null || line.unitCost === 0) {
        issues.push({
          type: "error",
          code: "missing-cost",
          message: "Unit cost is missing",
        });
      }
      if (line.qty <= 0) {
        issues.push({
          type: "error",
          code: "qty-zero",
          message: "Quantity must be greater than zero",
        });
      }
      const matched = line.matchedProductId ? productMap.get(line.matchedProductId) : null;
      if (matched && line.unitCost != null && matched.lastCost > 0) {
        const delta = (line.unitCost - matched.lastCost) / matched.lastCost;
        if (delta >= COST_SPIKE_THRESHOLD) {
          issues.push({
            type: "warning",
            code: "cost-spike",
            message: `Cost up ${(delta * 100).toFixed(0)}% from last`,
            detail: `${formatMoney(matched.lastCost)} → ${formatMoney(line.unitCost)}`,
          });
        }
      }
      if (line.matchState === "suggested" || (line.confidence > 0 && line.confidence < 0.65 && line.matchState !== "created")) {
        issues.push({
          type: "warning",
          code: "low-confidence",
          message: "Low-confidence match",
          detail: `${Math.round(line.confidence * 100)}% confident`,
        });
      }
    } else if (line.kind === "non-inventory") {
      if (line.unitCost == null || line.unitCost <= 0) {
        issues.push({
          type: "error",
          code: "missing-cost",
          message: "Charge amount is missing",
        });
      }
    }

    if (issues.length > 0) byLineId.set(line.id, issues);
  }

  const headerIssues: HeaderIssue[] = [];
  if (!invoice.supplierId) {
    headerIssues.push({
      type: "error",
      code: "no-supplier",
      message: "Select a supplier",
    });
  }
  const sumOfLines = invoice.lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const delta = Number((invoice.declaredTotal - sumOfLines).toFixed(2));
  if (Math.abs(delta) > 0.05) {
    headerIssues.push({
      type: "error",
      code: "total-mismatch",
      message: "Invoice total doesn't match line items",
      detail: `${formatMoney(sumOfLines)} of ${formatMoney(invoice.declaredTotal)} (off by ${formatMoney(Math.abs(delta))})`,
    });
  }
  const duplicate = allInvoices.find(
    (i) =>
      i.id !== invoice.id &&
      i.invoiceNumber === invoice.invoiceNumber &&
      i.supplierId &&
      i.supplierId === invoice.supplierId,
  );
  if (duplicate) {
    headerIssues.push({
      type: "warning",
      code: "duplicate-invoice",
      message: "Duplicate invoice # for this supplier",
      detail: `Matches ${duplicate.filename}`,
    });
  }
  if (supplier && supplier.defaultCurrency !== invoice.currency) {
    headerIssues.push({
      type: "warning",
      code: "currency-mismatch",
      message: `${invoice.currency} differs from supplier default (${supplier.defaultCurrency})`,
    });
  }

  let errors = headerIssues.filter((i) => i.type === "error").length;
  let warnings = headerIssues.filter((i) => i.type === "warning").length;
  for (const list of byLineId.values()) {
    errors += list.filter((i) => i.type === "error").length;
    warnings += list.filter((i) => i.type === "warning").length;
  }

  return { errors, warnings, headerIssues, byLineId };
}

export function lineHasIssue(
  issues: InvoiceIssueSummary,
  lineId: string,
  type: "error" | "warning",
): boolean {
  return issues.byLineId.get(lineId)?.some((i) => i.type === type) ?? false;
}

export function lineCriticality(
  issues: InvoiceIssueSummary,
  lineId: string,
): "error" | "warning" | null {
  const list = issues.byLineId.get(lineId);
  if (!list || list.length === 0) return null;
  if (list.some((i) => i.type === "error")) return "error";
  return "warning";
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function getLineIssues(summary: InvoiceIssueSummary, line: LineItem): LineIssue[] {
  return summary.byLineId.get(line.id) ?? [];
}
