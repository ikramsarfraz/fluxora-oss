// Pure helpers that evaluate the FINAL state of an import preview and surface
// only the warnings that are still applicable. Run after every merge /
// enrichment stage so stale "Supplier was not matched" or "Some product lines
// were not matched" messages don't leak through when AI or alias matching has
// actually filled the field in.

import type { SupplierInvoicePdfPrefillResult } from "./pdf-prefill";

export type FormStateWarningResult = {
  warnings: string[];
  /**
   * The invoice date to land in the form. Equal to the result's date when the
   * pipeline extracted one, or today's ISO date as a fallback so the form
   * schema (which requires a valid ISO date) still accepts the prefill.
   */
  resolvedInvoiceDate: string;
  invoiceDateUsedFallback: boolean;
};

export function buildFormStateWarnings(
  result: SupplierInvoicePdfPrefillResult,
): FormStateWarningResult {
  const warnings: string[] = [];

  const invoiceDateFound = Boolean(result.values.invoiceDate);
  const resolvedInvoiceDate = invoiceDateFound
    ? result.values.invoiceDate
    : new Date().toISOString().slice(0, 10);

  if (!result.values.supplierId) {
    warnings.push("Supplier was not matched. Choose a supplier before saving.");
  }
  if (!result.values.supplierInvoiceNumber) {
    warnings.push(
      "Supplier invoice number was not found. Add it before saving if the bill has one.",
    );
  }
  if (!invoiceDateFound) {
    warnings.push("Invoice date was not found. Today was used as a placeholder.");
  } else {
    warnings.push(
      "Receive date defaulted to the invoice date. Adjust it if the shipment arrived later.",
    );
  }
  if (result.unmatchedLineDescriptions.length > 0) {
    warnings.push("Some product lines were not matched. Choose products before saving.");
  }
  if (result.values.lines.length === 0) {
    warnings.push("No invoice line items could be read from this PDF.");
  }
  if (result.totalComparison.matches === false) {
    warnings.push(
      "Parsed line totals do not match the PDF balance due. Review amounts before saving.",
    );
  }

  return {
    warnings,
    resolvedInvoiceDate,
    invoiceDateUsedFallback: !invoiceDateFound,
  };
}
