import assert from "node:assert/strict";
import { test } from "node:test";

import {
  groupSupplierInvoiceErrorsByLocation,
  parseSupplierInvoiceValidationIssues,
  summarizeSupplierInvoiceValidationIssues,
  type SupplierInvoiceValidationIssue,
} from "./parse-validation-error";

const MARKER = "__SUPPLIER_INVOICE_VALIDATION_ISSUES__:";

// ---------------------------------------------------------------------------
// parseSupplierInvoiceValidationIssues
// ---------------------------------------------------------------------------

test("returns null for non-Error inputs", () => {
  assert.equal(parseSupplierInvoiceValidationIssues(null), null);
  assert.equal(parseSupplierInvoiceValidationIssues(undefined), null);
  assert.equal(parseSupplierInvoiceValidationIssues("a string"), null);
  assert.equal(parseSupplierInvoiceValidationIssues({}), null);
});

test("returns null when the marker isn't present in the message", () => {
  const err = new Error("Database connection lost.");
  assert.equal(parseSupplierInvoiceValidationIssues(err), null);
});

test("returns null when the JSON after the marker is malformed", () => {
  const err = new Error(`Summary line\n${MARKER}not-json`);
  assert.equal(parseSupplierInvoiceValidationIssues(err), null);
});

test("returns null when the parsed value isn't an array", () => {
  const err = new Error(`Summary line\n${MARKER}{"path":["lines"]}`);
  assert.equal(parseSupplierInvoiceValidationIssues(err), null);
});

test("parses a single issue out of the marker block", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["lines", 0, "weightLbs"], message: "Must be > 0." },
  ];
  const err = new Error(`Summary\n${MARKER}${JSON.stringify(issues)}`);
  const parsed = parseSupplierInvoiceValidationIssues(err);
  assert.deepEqual(parsed, issues);
});

test("filters out entries that don't match the issue shape", () => {
  const mixed = [
    { path: ["lines", 0, "weightLbs"], message: "Must be > 0." },
    { path: ["lines"] }, // missing message
    "string entry",
    null,
    { path: "lines", message: "wrong path type" }, // path isn't an array
    { path: ["supplierId"], message: "Required." },
  ];
  const err = new Error(`Summary\n${MARKER}${JSON.stringify(mixed)}`);
  const parsed = parseSupplierInvoiceValidationIssues(err);
  assert.equal(parsed?.length, 2);
  assert.deepEqual(parsed?.[0].path, ["lines", 0, "weightLbs"]);
  assert.deepEqual(parsed?.[1].path, ["supplierId"]);
});

// ---------------------------------------------------------------------------
// groupSupplierInvoiceErrorsByLocation
// ---------------------------------------------------------------------------

test("groups line issues by user-facing line.id via the index map", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["lines", 0, "weightLbs"], message: "Must be > 0." },
    { path: ["lines", 2, "unitPrice"], message: "Required." },
  ];
  const grouped = groupSupplierInvoiceErrorsByLocation(issues, {
    0: 5,
    1: 6,
    2: 11,
  });
  assert.deepEqual(grouped.perLine[5], ["weightLbs: Must be > 0."]);
  assert.deepEqual(grouped.perLine[11], ["unitPrice: Required."]);
  assert.deepEqual(grouped.perCharge, {});
  assert.deepEqual(grouped.perField, {});
  assert.deepEqual(grouped.unbucketed, []);
});

test("falls into unbucketed when the line index isn't in the map", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["lines", 99, "weightLbs"], message: "Stranded issue." },
  ];
  const grouped = groupSupplierInvoiceErrorsByLocation(issues, { 0: 1 });
  assert.deepEqual(grouped.perLine, {});
  // The field-prefix formatting still applies — the indicator is that
  // unmapped lines bypass `perLine` entirely.
  assert.deepEqual(grouped.unbucketed, ["weightLbs: Stranded issue."]);
});

test("buckets charge issues by submit-array index", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["charges", 0, "amount"], message: "Required." },
    { path: ["charges", 2, "description"], message: "Required." },
  ];
  const grouped = groupSupplierInvoiceErrorsByLocation(issues, {});
  assert.deepEqual(grouped.perCharge[0], ["amount: Required."]);
  assert.deepEqual(grouped.perCharge[2], ["description: Required."]);
});

test("buckets header / top-level issues by section name", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["supplierId"], message: "Must be a valid UUID." },
    { path: ["invoiceDate"], message: "Must be YYYY-MM-DD." },
    { path: ["invoiceDate"], message: "Calendar date invalid." },
  ];
  const grouped = groupSupplierInvoiceErrorsByLocation(issues, {});
  assert.deepEqual(grouped.perField.supplierId, ["Must be a valid UUID."]);
  assert.equal(grouped.perField.invoiceDate?.length, 2);
});

test("treats missing field segment as no prefix on the message", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["lines", 0], message: "Line is corrupt." },
  ];
  const grouped = groupSupplierInvoiceErrorsByLocation(issues, { 0: 7 });
  assert.deepEqual(grouped.perLine[7], ["Line is corrupt."]);
});

// ---------------------------------------------------------------------------
// summarizeSupplierInvoiceValidationIssues
// ---------------------------------------------------------------------------

test("summary surfaces first issue path + count", () => {
  const issues: SupplierInvoiceValidationIssue[] = [
    { path: ["lines", 0, "weightLbs"], message: "Must be > 0." },
    { path: ["lines", 2, "unitPrice"], message: "Required." },
    { path: ["supplierId"], message: "Must be a UUID." },
  ];
  assert.equal(
    summarizeSupplierInvoiceValidationIssues(issues),
    "lines.0.weightLbs: Must be > 0. (+2 more)",
  );
});

test("summary omits '+N more' when there's only one issue", () => {
  assert.equal(
    summarizeSupplierInvoiceValidationIssues([
      { path: ["supplierId"], message: "Required." },
    ]),
    "supplierId: Required.",
  );
});

test("summary falls back to 'request' when path is empty", () => {
  assert.equal(
    summarizeSupplierInvoiceValidationIssues([
      { path: [], message: "Bad request." },
    ]),
    "request: Bad request.",
  );
});
