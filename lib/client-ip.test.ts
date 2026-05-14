import assert from "node:assert/strict";
import test from "node:test";

import { getClientIp } from "./client-ip";

function h(entries: Record<string, string>) {
  return new Headers(entries);
}

test("getClientIp prefers x-forwarded-for first entry", () => {
  assert.equal(
    getClientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })),
    "1.2.3.4",
  );
});

test("getClientIp trims whitespace from x-forwarded-for", () => {
  assert.equal(
    getClientIp(h({ "x-forwarded-for": "  9.9.9.9  ,  10.0.0.1  " })),
    "9.9.9.9",
  );
});

test("getClientIp falls back to x-real-ip when x-forwarded-for is missing", () => {
  assert.equal(getClientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
});

test("getClientIp falls back to cf-connecting-ip last", () => {
  assert.equal(
    getClientIp(h({ "cf-connecting-ip": "8.8.8.8" })),
    "8.8.8.8",
  );
});

test("getClientIp returns 'unknown' when no headers present", () => {
  assert.equal(getClientIp(h({})), "unknown");
});

test("getClientIp does not break on empty x-forwarded-for", () => {
  assert.equal(getClientIp(h({ "x-forwarded-for": "" })), "unknown");
});
