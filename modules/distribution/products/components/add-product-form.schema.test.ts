import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addProductFormSchema,
  type AddProductFormValues,
} from "./add-product-form.schema";

// Real v4 UUIDs (zod's `.uuid()` enforces RFC 4122 v4 layout). The
// schema only validates shape, not existence — the action layer
// enforces tenant ownership separately.
const UNIT_LB = "8c5e1a73-9c4f-4a2e-9c1f-c8f0aa11c7a1";
const UNIT_EA = "5d7c0a91-6b4f-4d2a-a5fb-d3f1bb22d8b2";
const UNIT_CS = "2a3b4c5d-7e8f-4a1b-9c0d-e4f56677c8c3";
const CAT_BEEF = "f1e2d3c4-b5a6-4978-8b6c-1a2b3c4d5e6f";

function baseValues(
  overrides: Partial<AddProductFormValues> = {},
): AddProductFormValues {
  return {
    sku: "BEEF-CHK-001",
    name: "Beef Chuck Roast",
    categoryIds: [CAT_BEEF],
    baseUnitId: UNIT_LB,
    defaultPrice: "8.99",
    salesUnits: [
      {
        unitId: UNIT_LB,
        conversionToBase: "1",
        isDefault: true,
        allowsFractional: true,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test("addProductFormSchema: accepts a weight-based product", () => {
  const result = addProductFormSchema.safeParse(baseValues());
  assert.ok(result.success, JSON.stringify(result));
});

test("addProductFormSchema: accepts an each-based beverage with case sales row", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({
      baseUnitId: UNIT_EA,
      salesUnits: [
        {
          unitId: UNIT_EA,
          conversionToBase: "1",
          isDefault: true,
          allowsFractional: false,
        },
        {
          unitId: UNIT_CS,
          conversionToBase: "12",
          isDefault: false,
          allowsFractional: false,
        },
      ],
    }),
  );
  assert.ok(result.success, JSON.stringify(result));
});

// ---------------------------------------------------------------------------
// Failure modes
// ---------------------------------------------------------------------------

test("addProductFormSchema: rejects empty name", () => {
  const result = addProductFormSchema.safeParse(baseValues({ name: "  " }));
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects empty category list", () => {
  const result = addProductFormSchema.safeParse(baseValues({ categoryIds: [] }));
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects missing base unit", () => {
  const result = addProductFormSchema.safeParse(baseValues({ baseUnitId: "" }));
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects empty sales-unit list", () => {
  const result = addProductFormSchema.safeParse(baseValues({ salesUnits: [] }));
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects no default sales unit", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({
      salesUnits: [
        {
          unitId: UNIT_LB,
          conversionToBase: "1",
          isDefault: false,
          allowsFractional: true,
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects two default sales units", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({
      salesUnits: [
        {
          unitId: UNIT_LB,
          conversionToBase: "1",
          isDefault: true,
          allowsFractional: true,
        },
        {
          unitId: UNIT_CS,
          conversionToBase: "40",
          isDefault: true,
          allowsFractional: false,
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects duplicate UOM in sales units", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({
      salesUnits: [
        {
          unitId: UNIT_LB,
          conversionToBase: "1",
          isDefault: true,
          allowsFractional: true,
        },
        {
          unitId: UNIT_LB,
          conversionToBase: "40",
          isDefault: false,
          allowsFractional: false,
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("addProductFormSchema: rejects zero / negative conversionToBase", () => {
  const zero = addProductFormSchema.safeParse(
    baseValues({
      salesUnits: [
        {
          unitId: UNIT_LB,
          conversionToBase: "0",
          isDefault: true,
          allowsFractional: true,
        },
      ],
    }),
  );
  assert.equal(zero.success, false);

  const negative = addProductFormSchema.safeParse(
    baseValues({
      salesUnits: [
        {
          unitId: UNIT_LB,
          conversionToBase: "-1",
          isDefault: true,
          allowsFractional: true,
        },
      ],
    }),
  );
  assert.equal(negative.success, false);
});

test("addProductFormSchema: defaultPrice tolerates empty string (treated as 0 downstream)", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({ defaultPrice: "" }),
  );
  assert.ok(result.success);
});

test("addProductFormSchema: rejects garbage defaultPrice", () => {
  const result = addProductFormSchema.safeParse(
    baseValues({ defaultPrice: "abc" }),
  );
  assert.equal(result.success, false);
});
