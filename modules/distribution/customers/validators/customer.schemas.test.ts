import { test } from "node:test";
import assert from "node:assert/strict";

import { createCustomerInputSchema } from "./customer.schemas";

// ── name + abbreviation (required) ────────────────────────────────────────────

test("rejects empty name", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "",
    abbreviation: "ACME",
  });
  assert.equal(result.success, false);
  assert.match(result.error!.issues[0]!.message, /name is required/i);
});

test("rejects empty abbreviation", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "",
  });
  assert.equal(result.success, false);
});

test("uppercases the abbreviation", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "acme",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.abbreviation, "ACME");
});

test("rejects abbreviation over 32 chars", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "A".repeat(33),
  });
  assert.equal(result.success, false);
});

// ── email (optional, validated when present) ──────────────────────────────────

test("accepts a missing email", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.email, null);
});

test("coerces empty-string email to null", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    email: "",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.email, null);
});

test("lowercases a valid email", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    email: "AP@Acme.Com",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.email, "ap@acme.com");
});

test("rejects a malformed email", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    email: "not-an-email",
  });
  assert.equal(result.success, false);
});

// ── phoneNumber (optional, normalized) ────────────────────────────────────────

test("normalizes US phone number to canonical digit form", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    phoneNumber: "(555) 123-4567",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.phoneNumber, "5551234567");
});

test("drops country code 1 on 11-digit phone number", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    phoneNumber: "+1 (555) 123-4567",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.phoneNumber, "5551234567");
});

test("accepts a missing phone number", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.phoneNumber, null);
});

test("rejects a too-short phone number", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    phoneNumber: "123",
  });
  assert.equal(result.success, false);
});

// ── taxId (optional, US EIN-shaped) ───────────────────────────────────────────

test("accepts a hyphenated EIN", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    taxId: "12-3456789",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.taxId, "12-3456789");
});

test("accepts a bare 9-digit EIN", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    taxId: "123456789",
  });
  assert.equal(result.success, true);
});

test("rejects a tax ID that's not 9 digits", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    taxId: "12345",
  });
  assert.equal(result.success, false);
});

// ── netDays (optional integer 0-365) ──────────────────────────────────────────

test("coerces numeric netDays string to number", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    netDays: "30",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.netDays, 30);
});

test("accepts netDays as a plain number", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    netDays: 60,
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.netDays, 60);
});

test("coerces empty-string netDays to null", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    netDays: "",
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.netDays, null);
});

test("rejects negative netDays", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    netDays: -1,
  });
  assert.equal(result.success, false);
});

test("rejects netDays over 365", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    netDays: 400,
  });
  assert.equal(result.success, false);
});

// ── addresses (nested) ────────────────────────────────────────────────────────

test("accepts a valid address", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    addresses: [
      {
        addressType: "shipping",
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
      },
    ],
  });
  assert.equal(result.success, true);
  assert.equal(result.data!.addresses![0]!.state, "CA");
});

test("rejects non-US state codes", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    addresses: [
      {
        addressType: "shipping",
        street: "123",
        city: "Toronto",
        state: "ON",
        zip: "94103",
      },
    ],
  });
  assert.equal(result.success, false);
});

test("rejects non-5-digit ZIP", () => {
  const result = createCustomerInputSchema.safeParse({
    name: "Acme",
    abbreviation: "ACME",
    addresses: [
      {
        addressType: "shipping",
        street: "123",
        city: "SF",
        state: "CA",
        zip: "9410",
      },
    ],
  });
  assert.equal(result.success, false);
});
