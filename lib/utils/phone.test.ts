import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPhone, normalizePhone } from "./phone";

// ── normalizePhone ────────────────────────────────────────────────────────────

test("normalizePhone treats null/empty/whitespace as 'not given'", () => {
  assert.deepEqual(normalizePhone(null), { value: null, isValid: true });
  assert.deepEqual(normalizePhone(undefined), { value: null, isValid: true });
  assert.deepEqual(normalizePhone(""), { value: null, isValid: true });
  assert.deepEqual(normalizePhone("   "), { value: null, isValid: true });
});

test("normalizePhone canonicalizes US 10-digit input", () => {
  assert.equal(normalizePhone("5551234567").value, "5551234567");
  assert.equal(normalizePhone("(555) 123-4567").value, "5551234567");
  assert.equal(normalizePhone("555-123-4567").value, "5551234567");
  assert.equal(normalizePhone("555.123.4567").value, "5551234567");
  assert.equal(normalizePhone("  555 123 4567  ").value, "5551234567");
});

test("normalizePhone drops leading 1 country code on 11-digit input", () => {
  assert.equal(normalizePhone("15551234567").value, "5551234567");
  assert.equal(normalizePhone("+1 (555) 123-4567").value, "5551234567");
  assert.equal(normalizePhone("1-555-123-4567").value, "5551234567");
});

test("normalizePhone preserves leading + for non-US international", () => {
  assert.equal(normalizePhone("+44 20 7946 0958").value, "+442079460958");
  assert.equal(normalizePhone("+91 98765 43210").value, "+919876543210");
});

test("normalizePhone flags too-short input as invalid", () => {
  // Six digits — too short to be a real US or international number.
  const out = normalizePhone("123456");
  assert.equal(out.value, "123456");
  assert.equal(out.isValid, false);
});

test("normalizePhone flags too-long input as invalid (>15 digits)", () => {
  const out = normalizePhone("123456789012345678");
  assert.equal(out.isValid, false);
});

test("normalizePhone strips letters and symbols", () => {
  assert.equal(normalizePhone("call 555-CALL-NOW please").value, "555");
  // 555 is < 7 digits → invalid
  assert.equal(normalizePhone("call 555-CALL-NOW please").isValid, false);
});

test("normalizePhone returns null+invalid for digit-free strings", () => {
  assert.deepEqual(normalizePhone("hello"), { value: null, isValid: false });
});

// ── formatPhone ───────────────────────────────────────────────────────────────

test("formatPhone formats canonicalized 10-digit storage value", () => {
  assert.equal(formatPhone("5551234567"), "(555) 123-4567");
});

test("formatPhone still handles legacy 11-digit values", () => {
  assert.equal(formatPhone("15551234567"), "+1 (555) 123-4567");
});

test("formatPhone shows em dash for empty input", () => {
  assert.equal(formatPhone(null), "—");
  assert.equal(formatPhone(""), "—");
});
