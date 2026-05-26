import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPdfBytes } from "./pdf-content-hash";

test("hashPdfBytes produces a stable 64-char hex digest", () => {
  // Stable across runs — a regression here would silently break every
  // existing cache row.
  const hex = hashPdfBytes(Buffer.from("hello world", "utf8"));
  assert.equal(
    hex,
    "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  );
  assert.equal(hex.length, 64);
  assert.match(hex, /^[0-9a-f]{64}$/);
});

test("hashPdfBytes is deterministic across calls", () => {
  const a = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF header
  const h1 = hashPdfBytes(a);
  const h2 = hashPdfBytes(a);
  assert.equal(h1, h2);
});

test("hashPdfBytes accepts both Buffer and Uint8Array", () => {
  const buf = Buffer.from("invoice bytes");
  const arr = new Uint8Array(buf);
  assert.equal(hashPdfBytes(buf), hashPdfBytes(arr));
});

test("hashPdfBytes diverges on a one-byte content change", () => {
  // The cache key MUST flip when the PDF content differs even by a single
  // byte — a supplier re-export with a new timestamp should miss the cache,
  // not return a stale parse for slightly different content.
  const a = hashPdfBytes(Buffer.from("AAAA"));
  const b = hashPdfBytes(Buffer.from("AAAB"));
  assert.notEqual(a, b);
});

test("hashPdfBytes throws on empty input to catch detached ArrayBuffers", () => {
  // Empty bytes would all collide on the canonical SHA-256-of-empty value
  // and poison the cache. The throw surfaces the upstream detach bug
  // instead of silently bucketing every PDF onto one cache row.
  assert.throws(
    () => hashPdfBytes(Buffer.alloc(0)),
    /refusing to hash empty input/,
  );
});
