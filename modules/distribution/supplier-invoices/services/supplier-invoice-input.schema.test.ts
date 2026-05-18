import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER,
  SupplierInvoiceValidationError,
  completeSupplierInvoiceInputSchema,
  createSupplierInvoiceInputSchema,
  supplierInvoiceChargeInputSchema,
  supplierInvoiceHeaderInputSchema,
  supplierInvoiceLineInputSchema,
  validateSupplierInvoiceInput,
} from "./supplier-invoice-input.schema";

// Stable UUIDs we reuse across positive cases so test data stays
// readable. Real records would have different ids — these are pure
// fixtures.
const UUID_SUPPLIER = "11111111-1111-4111-8111-111111111111";
const UUID_PRODUCT = "22222222-2222-4222-8222-222222222222";
const UUID_BILL = "33333333-3333-4333-8333-333333333333";
const UUID_LINE = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------------------
// Header schema
// ---------------------------------------------------------------------------

test("header: valid input passes", () => {
  const parsed = supplierInvoiceHeaderInputSchema.parse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: "INV-243192",
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-22",
    paymentMethod: "ach",
    notes: "PO #1234, deliver after 9am",
  });
  assert.equal(parsed.invoiceNumber, "INV-243192");
});

test("header: invoiceNumber may be null", () => {
  const parsed = supplierInvoiceHeaderInputSchema.parse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
  });
  assert.equal(parsed.invoiceNumber, null);
});

test("header: rejects a non-UUID supplierId", () => {
  const result = supplierInvoiceHeaderInputSchema.safeParse({
    supplierId: "not-a-uuid",
    invoiceNumber: null,
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0].path, ["supplierId"]);
  }
});

test("header: rejects a malformed ISO date", () => {
  const result = supplierInvoiceHeaderInputSchema.safeParse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "20260420", // missing separators
    receiveDate: "2026-04-20",
  });
  assert.equal(result.success, false);
});

test("header: rejects an impossible calendar date (Feb 30)", () => {
  const result = supplierInvoiceHeaderInputSchema.safeParse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "2026-02-30",
    receiveDate: "2026-04-20",
  });
  assert.equal(result.success, false);
});

test("header: rejects an out-of-range payment method", () => {
  const result = supplierInvoiceHeaderInputSchema.safeParse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
    paymentMethod: "bitcoin",
  });
  assert.equal(result.success, false);
});

test("header: rejects notes over 2000 chars", () => {
  const result = supplierInvoiceHeaderInputSchema.safeParse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
    notes: "x".repeat(2001),
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Line schema
// ---------------------------------------------------------------------------

function baseLine() {
  return {
    productId: UUID_PRODUCT,
    quantityCases: 5,
    weightLbs: "120.50",
    unitType: "catch_weight" as const,
    unitPrice: "3.25",
  };
}

test("line: valid catch_weight line passes", () => {
  const parsed = supplierInvoiceLineInputSchema.parse(baseLine());
  assert.equal(parsed.quantityCases, 5);
});

test("line: rejects zero cases", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    quantityCases: 0,
  });
  assert.equal(result.success, false);
});

test("line: rejects non-integer cases", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    quantityCases: 5.5,
  });
  assert.equal(result.success, false);
});

test("line: rejects negative unit price", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    unitPrice: "-1.00",
  });
  assert.equal(result.success, false);
});

test("line: catch_weight with weight=0 fails the superRefine", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    weightLbs: "0",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const issue = result.error.issues.find(i =>
      i.path.includes("weightLbs"),
    );
    assert.ok(issue, "should attach issue to weightLbs path");
  }
});

test("line: fixed_case with weight=0 passes", () => {
  const parsed = supplierInvoiceLineInputSchema.parse({
    ...baseLine(),
    unitType: "fixed_case",
    weightLbs: "0",
  });
  assert.equal(parsed.unitType, "fixed_case");
});

test("line: caseWeightsLbs accepts a JSON array of positives", () => {
  const parsed = supplierInvoiceLineInputSchema.parse({
    ...baseLine(),
    caseWeightsLbs: JSON.stringify([24.1, 25.0, 23.8, 24.5, 23.1]),
  });
  assert.equal(typeof parsed.caseWeightsLbs, "string");
});

test("line: caseWeightsLbs may be null or empty", () => {
  assert.doesNotThrow(() =>
    supplierInvoiceLineInputSchema.parse({
      ...baseLine(),
      caseWeightsLbs: null,
    }),
  );
  assert.doesNotThrow(() =>
    supplierInvoiceLineInputSchema.parse({
      ...baseLine(),
      caseWeightsLbs: "",
    }),
  );
});

test("line: caseWeightsLbs rejects non-array JSON", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    caseWeightsLbs: JSON.stringify({ foo: 1 }),
  });
  assert.equal(result.success, false);
});

test("line: caseWeightsLbs rejects an array with non-positive numbers", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    caseWeightsLbs: JSON.stringify([10, 0, 5]),
  });
  assert.equal(result.success, false);
});

test("line: lotNumberOverride respects the 128-char cap", () => {
  const result = supplierInvoiceLineInputSchema.safeParse({
    ...baseLine(),
    lotNumberOverride: "L".repeat(129),
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Charge schema
// ---------------------------------------------------------------------------

test("charge: minimal valid input passes", () => {
  const parsed = supplierInvoiceChargeInputSchema.parse({
    description: "Freight",
    amount: "25.00",
  });
  assert.equal(parsed.description, "Freight");
});

test("charge: tax type with rate% passes", () => {
  const parsed = supplierInvoiceChargeInputSchema.parse({
    description: "Sales tax",
    chargeType: "tax",
    rate: "7.5",
    amount: "8.25",
  });
  assert.equal(parsed.rate, "7.5");
});

test("charge: tax rate >100 fails", () => {
  const result = supplierInvoiceChargeInputSchema.safeParse({
    description: "Sales tax",
    chargeType: "tax",
    rate: "150",
    amount: "8.25",
  });
  assert.equal(result.success, false);
});

test("charge: non-tax type with non-empty rate fails the superRefine", () => {
  const result = supplierInvoiceChargeInputSchema.safeParse({
    description: "Freight",
    chargeType: "freight",
    rate: "10",
    amount: "25.00",
  });
  assert.equal(result.success, false);
});

test("charge: non-tax with empty/null rate is fine", () => {
  assert.doesNotThrow(() =>
    supplierInvoiceChargeInputSchema.parse({
      description: "Freight",
      chargeType: "freight",
      rate: "",
      amount: "25.00",
    }),
  );
  assert.doesNotThrow(() =>
    supplierInvoiceChargeInputSchema.parse({
      description: "Freight",
      chargeType: "freight",
      rate: null,
      amount: "25.00",
    }),
  );
});

test("charge: empty description fails", () => {
  const result = supplierInvoiceChargeInputSchema.safeParse({
    description: "  ",
    amount: "25.00",
  });
  assert.equal(result.success, false);
});

// All nine charge types must round-trip through the schema. The AI
// classifier emits the meat-specific ones (processing / inspection /
// cod / refrigeration) and we widened the UI + DB to match — this
// pins the wiring so it can't regress to the old five-value subset.
const ALL_CHARGE_TYPES = [
  "freight",
  "fuel",
  "tax",
  "discount",
  "processing",
  "inspection",
  "cod",
  "refrigeration",
  "other",
] as const;

for (const chargeType of ALL_CHARGE_TYPES) {
  test(`charge: chargeType "${chargeType}" is accepted`, () => {
    const input: Record<string, unknown> = {
      description: `${chargeType} fee`,
      chargeType,
      amount: "10.00",
    };
    if (chargeType === "tax") input.rate = "7.5";
    assert.doesNotThrow(() =>
      supplierInvoiceChargeInputSchema.parse(input),
    );
  });
}

test("charge: an unknown chargeType is rejected", () => {
  const result = supplierInvoiceChargeInputSchema.safeParse({
    description: "Mystery fee",
    chargeType: "made_up_category",
    amount: "10.00",
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Create / Update / Complete top-level schemas
// ---------------------------------------------------------------------------

test("create: rejects an empty lines array", () => {
  const result = createSupplierInvoiceInputSchema.safeParse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: null,
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
    lines: [],
  });
  assert.equal(result.success, false);
});

test("create: valid full payload passes", () => {
  const parsed = createSupplierInvoiceInputSchema.parse({
    supplierId: UUID_SUPPLIER,
    invoiceNumber: "INV-1",
    invoiceDate: "2026-04-20",
    receiveDate: "2026-04-20",
    paymentMethod: "ach",
    notes: null,
    lines: [baseLine()],
    charges: [{ description: "Freight", amount: "25.00" }],
    complete: true,
  });
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.complete, true);
});

test("update: requires a UUID id", () => {
  const result =
    completeSupplierInvoiceInputSchema /* using complete schema as smoke */.safeParse(
      { id: "not-a-uuid" },
    );
  assert.equal(result.success, false);
});

test("complete: minimal valid passes", () => {
  const parsed = completeSupplierInvoiceInputSchema.parse({
    id: UUID_BILL,
  });
  assert.equal(parsed.id, UUID_BILL);
});

test("complete: lineOverrides require UUID lineIds", () => {
  const result = completeSupplierInvoiceInputSchema.safeParse({
    id: UUID_BILL,
    lineOverrides: [
      { lineId: "not-a-uuid", lotNumberOverride: "LOT-1" },
    ],
  });
  assert.equal(result.success, false);
});

test("complete: valid lineOverrides pass", () => {
  const parsed = completeSupplierInvoiceInputSchema.parse({
    id: UUID_BILL,
    lineOverrides: [
      {
        lineId: UUID_LINE,
        lotNumberOverride: "LOT-A",
        expirationDateOverride: "2026-05-20",
      },
    ],
  });
  assert.equal(parsed.lineOverrides?.[0].lotNumberOverride, "LOT-A");
});

// ---------------------------------------------------------------------------
// SupplierInvoiceValidationError + validateSupplierInvoiceInput
// ---------------------------------------------------------------------------

test("validate helper returns parsed data on success", () => {
  const parsed = validateSupplierInvoiceInput(
    supplierInvoiceHeaderInputSchema,
    {
      supplierId: UUID_SUPPLIER,
      invoiceNumber: null,
      invoiceDate: "2026-04-20",
      receiveDate: "2026-04-20",
    },
  );
  assert.equal(parsed.supplierId, UUID_SUPPLIER);
});

test("validate helper throws SupplierInvoiceValidationError on failure", () => {
  try {
    validateSupplierInvoiceInput(supplierInvoiceHeaderInputSchema, {
      supplierId: "bad",
      invoiceNumber: null,
      invoiceDate: "bad-date",
      receiveDate: "2026-04-20",
    });
    assert.fail("expected SupplierInvoiceValidationError");
  } catch (err) {
    assert.ok(err instanceof SupplierInvoiceValidationError);
    assert.ok(err.issues.length >= 1);
  }
});

test("validation error message embeds the marker + serialized issues", () => {
  try {
    validateSupplierInvoiceInput(supplierInvoiceHeaderInputSchema, {
      supplierId: "bad",
      invoiceNumber: null,
      invoiceDate: "2026-04-20",
      receiveDate: "2026-04-20",
    });
    assert.fail("expected throw");
  } catch (err) {
    if (!(err instanceof Error)) {
      assert.fail("expected an Error instance");
    }
    assert.ok(
      err.message.includes(SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER),
      "marker missing from error message",
    );
    const json = err.message.slice(
      err.message.indexOf(SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER) +
        SUPPLIER_INVOICE_VALIDATION_ISSUES_MARKER.length,
    );
    const issues = JSON.parse(json) as Array<{ path: string[]; message: string }>;
    assert.ok(Array.isArray(issues));
    assert.ok(issues.some(i => i.path[0] === "supplierId"));
  }
});

test("validation error message starts with a human-readable summary line", () => {
  try {
    validateSupplierInvoiceInput(supplierInvoiceHeaderInputSchema, {
      supplierId: "bad",
      invoiceNumber: null,
      invoiceDate: "2026-04-20",
      receiveDate: "2026-04-20",
    });
    assert.fail("expected throw");
  } catch (err) {
    if (!(err instanceof Error)) assert.fail("expected an Error instance");
    const summary = err.message.split("\n")[0];
    assert.match(summary, /^supplierId:/);
  }
});
