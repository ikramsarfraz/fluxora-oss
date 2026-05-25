import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPhone, formatPhoneInput, normalizePhone } from "./phone";

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

// ── formatPhoneInput (live mask) ──────────────────────────────────────────────

test("formatPhoneInput progressively formats US digits as the user types", () => {
  assert.equal(formatPhoneInput(""), "");
  assert.equal(formatPhoneInput("5"), "(5");
  assert.equal(formatPhoneInput("55"), "(55");
  assert.equal(formatPhoneInput("555"), "(555");
  assert.equal(formatPhoneInput("5551"), "(555) 1");
  assert.equal(formatPhoneInput("555123"), "(555) 123");
  assert.equal(formatPhoneInput("5551234"), "(555) 123-4");
  assert.equal(formatPhoneInput("5551234567"), "(555) 123-4567");
});

test("formatPhoneInput strips existing formatting before re-applying", () => {
  // User pastes a formatted number — we restrip and reformat so the
  // canonical mask wins.
  assert.equal(formatPhoneInput("(555) 123-4567"), "(555) 123-4567");
  assert.equal(formatPhoneInput("555-123-4567"), "(555) 123-4567");
  assert.equal(formatPhoneInput("555 123 4567"), "(555) 123-4567");
});

test("formatPhoneInput adds country code shape when leading 1 + 10 digits", () => {
  assert.equal(formatPhoneInput("15551234567"), "+1 (555) 123-4567");
});

test("formatPhoneInput leaves international + numbers alone (digits only)", () => {
  assert.equal(formatPhoneInput("+44 20 7946 0958"), "+442079460958");
});

test("formatPhoneInput caps US input at 11 digits", () => {
  // Past 11 digits, extra typing is ignored (clamped). Maintains the
  // canonical US/+1 shape rather than producing a half-formatted blob.
  assert.equal(formatPhoneInput("155512345678901234"), "+1 (555) 123-4567");
});
