import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeFilename, validatePdfUpload } from "./file-validation";

function makePdfHeader(extra: number = 0): Uint8Array {
  // %PDF- + variable trailing bytes
  const head = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return new Uint8Array([...head, ...new Array(extra).fill(0x20)]);
}

function makeNonPdf(): Uint8Array {
  // "Hello PDF" — passes the .pdf rename trick but fails magic check
  return new TextEncoder().encode("Hello PDF, this is text");
}

function fakeFile(bytes: Uint8Array, name: string, type = "application/pdf") {
  const blob = new Blob([bytes as BlobPart], { type });
  return new File([blob], name, { type });
}

test("sanitizeFilename strips slashes and backslashes", () => {
  assert.equal(sanitizeFilename("../../etc/passwd.pdf"), ".etcpasswd.pdf");
});

test("sanitizeFilename strips null bytes and control chars", () => {
  assert.equal(sanitizeFilename("invoice\x00\x01.pdf"), "invoice.pdf");
});

test("sanitizeFilename collapses double-dot sequences", () => {
  assert.equal(sanitizeFilename("a..b...c.pdf"), "a.b.c.pdf");
});

test("sanitizeFilename truncates at 255 characters", () => {
  const out = sanitizeFilename("a".repeat(300) + ".pdf");
  assert.equal(out.length, 255);
});

test("sanitizeFilename normalizes Unicode to NFC", () => {
  // "café" composed (é) vs decomposed (e + ́)
  const decomposed = "café.pdf";
  const composed = "café.pdf";
  assert.equal(sanitizeFilename(decomposed), composed);
});

test("sanitizeFilename returns empty when nothing usable remains", () => {
  assert.equal(sanitizeFilename("///\\\\"), "");
});

test("validatePdfUpload accepts a valid PDF", async () => {
  const file = fakeFile(makePdfHeader(1024), "invoice.pdf");
  const result = await validatePdfUpload(file);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.safeName, "invoice.pdf");
    assert.equal(result.originalName, "invoice.pdf");
  }
});

test("validatePdfUpload rejects files over 10MB", async () => {
  // Build a file larger than 10 MB
  const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
  bytes[0] = 0x25;
  bytes[1] = 0x50;
  bytes[2] = 0x44;
  bytes[3] = 0x46;
  bytes[4] = 0x2d;
  const file = fakeFile(bytes, "huge.pdf");
  const result = await validatePdfUpload(file);
  assert.equal(result.ok, false);
});

test("validatePdfUpload rejects non-PDF content even with .pdf extension", async () => {
  const file = fakeFile(makeNonPdf(), "actually-text.pdf");
  const result = await validatePdfUpload(file);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "File must be PDF, max 10MB");
  }
});

test("validatePdfUpload sanitizes path-traversal filenames", async () => {
  const file = fakeFile(makePdfHeader(1024), "../../etc/passwd.pdf");
  const result = await validatePdfUpload(file);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.safeName.includes("/"), false);
    assert.equal(result.safeName.includes("\\"), false);
    assert.equal(result.safeName.includes(".."), false);
  }
});

test("validatePdfUpload rejects a file whose name is only path separators", async () => {
  const file = fakeFile(makePdfHeader(1024), "//\\\\");
  const result = await validatePdfUpload(file);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "Filename contains invalid characters");
  }
});
