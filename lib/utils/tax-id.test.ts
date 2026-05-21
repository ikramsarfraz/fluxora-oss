import { test } from "node:test";
import assert from "node:assert/strict";

import { formatEinInput } from "./tax-id";

test("formatEinInput progressively formats EIN digits as the user types", () => {
  assert.equal(formatEinInput(""), "");
  assert.equal(formatEinInput("1"), "1");
  assert.equal(formatEinInput("12"), "12");
  assert.equal(formatEinInput("123"), "12-3");
  assert.equal(formatEinInput("1234"), "12-34");
  assert.equal(formatEinInput("12345"), "12-345");
  assert.equal(formatEinInput("123456789"), "12-3456789");
});

test("formatEinInput strips non-digits and re-formats", () => {
  assert.equal(formatEinInput("12-3456789"), "12-3456789");
  assert.equal(formatEinInput("12 345 6789"), "12-3456789");
  assert.equal(formatEinInput("abc12def345"), "12-345");
});

test("formatEinInput caps at 9 digits", () => {
  assert.equal(formatEinInput("12345678901234"), "12-3456789");
});

test("formatEinInput handles deletes (re-formatted shorter)", () => {
  // User types "12-3456789", then backspaces — input becomes "12-345678",
  // mask re-applies cleanly.
  assert.equal(formatEinInput("12-345678"), "12-345678");
  assert.equal(formatEinInput("12-345"), "12-345");
  assert.equal(formatEinInput("12-"), "12");
});
