/**
 * Client-safe parser for the Zod-validation errors thrown by the
 * supplier-invoice server actions. The server action throws
 * `SupplierInvoiceValidationError` with a marker + JSON-serialized
 * issues embedded in `Error.message`; Next.js strips custom error
 * classes at the RSC boundary so the only thing the client gets is a
 * generic `Error` with the same string. We extract the JSON back out
 * here so the review screen can render per-line / per-field error
 * banners instead of just a flat toast.
 *
 * Marker is duplicated (not imported) because the server-side schema
 * file is `"server-only"` and would refuse to load in the client
 * bundle. Keep both copies in sync.
 */

const SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER =
  "__SUPPLIER_INVOICE_VALIDATION_ISSUES__:";

export type SupplierInvoiceValidationIssue = {
  path: (string | number)[];
  message: string;
};

export function parseSupplierInvoiceValidationIssues(
  err: unknown,
): SupplierInvoiceValidationIssue[] | null {
  if (!(err instanceof Error)) return null;
  const idx = err.message.indexOf(SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER);
  if (idx < 0) return null;
  try {
    const json = err.message.slice(
      idx + SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER.length,
    );
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (entry): entry is SupplierInvoiceValidationIssue =>
        entry != null &&
        typeof entry === "object" &&
        "message" in entry &&
        typeof (entry as { message: unknown }).message === "string" &&
        "path" in entry &&
        Array.isArray((entry as { path: unknown }).path),
    );
  } catch {
    return null;
  }
}

/**
 * Bucket per-issue messages by where they belong in the review UI.
 * Caller supplies a `linePayloadIndexToLineId` map so we can resolve
 * the issue path `["lines", N, "weightLbs"]` back to the user-facing
 * `line.id` rather than the post-filter array index that means
 * nothing to the renderer.
 */
export type GroupedSupplierInvoiceErrors = {
  /** Keyed on `line.id` (NOT the submit array index). */
  perLine: Record<number, string[]>;
  /** Keyed on the position in the submitted `charges[]` array. */
  perCharge: Record<number, string[]>;
  /** Header / top-level fields (supplierId, invoiceDate, etc.). */
  perField: Record<string, string[]>;
  /** Anything that didn't fit the above — concat for a fallback toast. */
  unbucketed: string[];
};

export function groupSupplierInvoiceErrorsByLocation(
  issues: SupplierInvoiceValidationIssue[],
  linePayloadIndexToLineId: Record<number, number>,
): GroupedSupplierInvoiceErrors {
  const perLine: Record<number, string[]> = {};
  const perCharge: Record<number, string[]> = {};
  const perField: Record<string, string[]> = {};
  const unbucketed: string[] = [];

  for (const issue of issues) {
    const [section, idxRaw, field] = issue.path;
    const message =
      typeof field === "string" ? `${field}: ${issue.message}` : issue.message;

    if (section === "lines" && typeof idxRaw === "number") {
      const lineId = linePayloadIndexToLineId[idxRaw];
      if (lineId != null) {
        (perLine[lineId] ??= []).push(message);
        continue;
      }
      // Server pointed at a line index the client doesn't know about
      // — typically a server bug or a race condition we can't act on
      // per-row. Surface in unbucketed so the toast still tells the
      // user something went wrong without painting a banner on an
      // unrelated row.
      unbucketed.push(message);
      continue;
    }
    if (section === "charges" && typeof idxRaw === "number") {
      (perCharge[idxRaw] ??= []).push(message);
      continue;
    }
    if (typeof section === "string") {
      (perField[section] ??= []).push(issue.message);
      continue;
    }
    unbucketed.push(issue.message);
  }

  return { perLine, perCharge, perField, unbucketed };
}

/**
 * One-line summary string for the toast that fires alongside the
 * field-level banners. Pulls the first issue's path + message and
 * surfaces a count of any others.
 */
export function summarizeSupplierInvoiceValidationIssues(
  issues: SupplierInvoiceValidationIssue[],
): string {
  if (issues.length === 0) return "Invalid input.";
  const first = issues[0];
  const path = first.path.join(".") || "request";
  const rest = issues.length - 1;
  return `${path}: ${first.message}${rest > 0 ? ` (+${rest} more)` : ""}`;
}
