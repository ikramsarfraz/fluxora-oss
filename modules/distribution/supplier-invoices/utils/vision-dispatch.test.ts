import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldSpeculativelyDispatchVision } from "./vision-dispatch";

// ---------------------------------------------------------------------------
// Hard gate: no PDF bytes → never dispatch
// ---------------------------------------------------------------------------

test("shouldSpeculativelyDispatchVision: returns false when no PDF bytes are available", () => {
  // Even a super-lossy text shouldn't trigger speculation if vision can't run.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 10,
      pdfPageCount: 5,
      deterministicLineCount: 0,
      hasPdfBytes: false,
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Very sparse text per page → always dispatch
// ---------------------------------------------------------------------------

test("shouldSpeculativelyDispatchVision: triggers when chars/page is under 100", () => {
  // 200 chars over 3 pages = ~66 chars/page → strong signal text is lossy.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 200,
      pdfPageCount: 3,
      deterministicLineCount: 5,
      hasPdfBytes: true,
    }),
    true,
  );
});

test("shouldSpeculativelyDispatchVision: very-sparse trigger overrides healthy deterministic count", () => {
  // Even if det found 10 lines, 30 chars/page means the rest of the table was lost.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 60,
      pdfPageCount: 2,
      deterministicLineCount: 10,
      hasPdfBytes: true,
    }),
    true,
  );
});

// ---------------------------------------------------------------------------
// Empty deterministic result + low density → dispatch
// ---------------------------------------------------------------------------

test("shouldSpeculativelyDispatchVision: triggers when det found 0 lines and density is low", () => {
  // 500 chars / 2 pages = 250 chars/page, under the 300 threshold.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 500,
      pdfPageCount: 2,
      deterministicLineCount: 0,
      hasPdfBytes: true,
    }),
    true,
  );
});

test("shouldSpeculativelyDispatchVision: does NOT trigger when det found 0 lines but density is high", () => {
  // 5000 chars / 1 page = lots of text but the regex parser couldn't find lines.
  // Could be a quirky format the text-AI can handle — don't speculate.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 5000,
      pdfPageCount: 1,
      deterministicLineCount: 0,
      hasPdfBytes: true,
    }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Healthy text → never dispatch (don't waste a vision call)
// ---------------------------------------------------------------------------

test("shouldSpeculativelyDispatchVision: returns false on a normal text-extractable invoice", () => {
  // 2000 chars / 1 page, deterministic found 8 lines → text-AI will handle it.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 2000,
      pdfPageCount: 1,
      deterministicLineCount: 8,
      hasPdfBytes: true,
    }),
    false,
  );
});

test("shouldSpeculativelyDispatchVision: handles zero-page invoices without dividing by zero", () => {
  // pdfPageCount=0 is degenerate but shouldn't crash. We treat it as 1 page.
  // 50 chars / 1 page = 50, under the 100 threshold → trigger.
  assert.equal(
    shouldSpeculativelyDispatchVision({
      extractedTextLength: 50,
      pdfPageCount: 0,
      deterministicLineCount: 0,
      hasPdfBytes: true,
    }),
    true,
  );
});
