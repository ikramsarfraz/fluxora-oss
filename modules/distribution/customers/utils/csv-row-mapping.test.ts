import { test } from "node:test";
import assert from "node:assert/strict";

import { csvRowToCustomerInput } from "./csv-row-mapping";

test("maps a full row with name + contact + address", () => {
  const out = csvRowToCustomerInput({
    name: "Acme Meats",
    abbreviation: "ACME",
    email: "ap@acme.com",
    phone: "(555) 123-4567",
    tax_id: "12-3456789",
    net_days: "30",
    fuel_surcharge: "15.00",
    address_line1: "123 Main St",
    address_city: "San Francisco",
    address_state: "CA",
    address_zip: "94103",
  });
  assert.equal(out.name, "Acme Meats");
  assert.equal(out.abbreviation, "ACME");
  assert.equal(out.email, "ap@acme.com");
  assert.equal(out.phoneNumber, "(555) 123-4567"); // normalized server-side
  assert.equal(out.taxId, "12-3456789");
  assert.equal(out.netDays, 30);
  assert.equal(out.fuelSurchargeAmount, "15.00");
  assert.equal(out.addresses!.length, 1);
  assert.equal(out.addresses![0]!.street, "123 Main St");
  assert.equal(out.addresses![0]!.city, "San Francisco");
  assert.equal(out.addresses![0]!.state, "CA");
  assert.equal(out.addresses![0]!.zip, "94103");
  assert.equal(out.addresses![0]!.isDefault, true);
  assert.equal(out.addresses![0]!.addressType, "shipping");
});

test("collapses empty optional fields to null", () => {
  const out = csvRowToCustomerInput({
    name: "Bare Bones LLC",
    abbreviation: "",
    email: "",
    phone: "",
    tax_id: "",
    net_days: "",
    fuel_surcharge: "",
    address_line1: "",
  });
  assert.equal(out.abbreviation, null);
  assert.equal(out.email, null);
  assert.equal(out.phoneNumber, null);
  assert.equal(out.taxId, null);
  assert.equal(out.netDays, null);
  assert.equal(out.fuelSurchargeAmount, null);
  assert.equal(out.addresses, undefined);
});

test("lower-cases the email", () => {
  const out = csvRowToCustomerInput({
    name: "X",
    email: "AP@Acme.Com",
  });
  assert.equal(out.email, "ap@acme.com");
});

test("omits the address block when address_line1 is missing", () => {
  // The customer_addresses table requires `street` NOT NULL. If the
  // user provides city/state/zip but no street, we shouldn't try to
  // insert an address — it would crash the row.
  const out = csvRowToCustomerInput({
    name: "X",
    address_city: "San Francisco",
    address_state: "CA",
    address_zip: "94103",
  });
  assert.equal(out.addresses, undefined);
});

test("trims whitespace on all fields", () => {
  const out = csvRowToCustomerInput({
    name: "  Acme  ",
    abbreviation: "  acme  ",
    email: "  ap@acme.com  ",
    phone: "  (555) 123-4567  ",
    tax_id: "  12-3456789  ",
    address_line1: "  123 Main St  ",
  });
  assert.equal(out.name, "Acme");
  assert.equal(out.abbreviation, "acme");
  assert.equal(out.email, "ap@acme.com");
  assert.equal(out.phoneNumber, "(555) 123-4567");
  assert.equal(out.taxId, "12-3456789");
  assert.equal(out.addresses![0]!.street, "123 Main St");
});

test("parses net_days as integer; non-numeric → null", () => {
  assert.equal(csvRowToCustomerInput({ name: "x", net_days: "60" }).netDays, 60);
  assert.equal(csvRowToCustomerInput({ name: "x", net_days: "0" }).netDays, 0);
  assert.equal(csvRowToCustomerInput({ name: "x", net_days: "abc" }).netDays, null);
  assert.equal(csvRowToCustomerInput({ name: "x", net_days: "" }).netDays, null);
});

test("treats a missing name as empty string (caught by Zod / unique constraint downstream)", () => {
  const out = csvRowToCustomerInput({});
  assert.equal(out.name, "");
});

test("preserves international phone digits for the server to normalize", () => {
  // Phone normalization happens server-side. The mapper just trims.
  const out = csvRowToCustomerInput({ name: "x", phone: "+44 20 7946 0958" });
  assert.equal(out.phoneNumber, "+44 20 7946 0958");
});
