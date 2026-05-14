import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { countBlockingUnresolved } from "./parsing-pipeline-logic";

// ── Static source checks ───────────────────────────────────────────────────
//
// These tests verify the abstraction contract for ai-vision.ts: it must no
// longer import OpenAI directly or read OPENAI_API_KEY. All provider config
// is delegated to the provider factory layer.

const VISION_SRC = readFileSync(
  resolve(__dirname, "../services/ai-vision.ts"),
  "utf8",
);

describe("ai-vision.ts abstraction — static source checks", () => {
  it("does not import OpenAI directly", () => {
    assert.ok(
      !VISION_SRC.includes("import OpenAI"),
      "ai-vision.ts must not contain 'import OpenAI' — use createAiProvider() instead",
    );
  });

  it("does not read OPENAI_API_KEY from process.env directly", () => {
    assert.ok(
      !VISION_SRC.includes("process.env.OPENAI_API_KEY") &&
        !VISION_SRC.includes('process.env["OPENAI_API_KEY"]'),
      "ai-vision.ts must not read process.env.OPENAI_API_KEY — provider handles credentials",
    );
  });

  it("does not instantiate a client directly", () => {
    assert.ok(
      !VISION_SRC.includes("new OpenAI("),
      "ai-vision.ts must not construct an OpenAI client — delegate to provider",
    );
  });

  it("delegates to createAiProvider()", () => {
    assert.ok(
      VISION_SRC.includes("createAiProvider"),
      "ai-vision.ts must call createAiProvider() to obtain the configured provider",
    );
  });

  it("checks isVisionCapable() before proceeding", () => {
    assert.ok(
      VISION_SRC.includes("isVisionCapable"),
      "ai-vision.ts must guard on provider.isVisionCapable() before calling extractInvoiceFromPdf",
    );
  });
});

// ── Option B semantics ─────────────────────────────────────────────────────
//
// Ignored rows must not reduce the blocking count. The user must still address
// them via the line editor or by removing the line — simply dismissing the
// alias review panel row is not sufficient to unblock submission.

describe("countBlockingUnresolved — Option B: ignored rows still block", () => {
  it("returns actionable - resolved when ignoredCount is 0", () => {
    assert.equal(countBlockingUnresolved(5, 2, 0), 3);
  });

  it("returns 0 when all are resolved", () => {
    assert.equal(countBlockingUnresolved(4, 4, 0), 0);
  });

  it("never goes negative", () => {
    assert.equal(countBlockingUnresolved(2, 5, 0), 0);
  });

  it("ignored count of 0 means ignored rows are not subtracted", () => {
    // With Option A (ignoredCount > 0 passed): countBlockingUnresolved(5, 2, 2) = 1
    // With Option B (ignoredCount always 0):  countBlockingUnresolved(5, 2, 0) = 3
    // The panel must always pass 0 for ignoredCount.
    const optionB = countBlockingUnresolved(5, 2, 0);
    const optionA = countBlockingUnresolved(5, 2, 2);
    assert.equal(optionB, 3);
    assert.equal(optionA, 1);
    assert.ok(optionB > optionA, "Option B keeps more rows blocking than Option A");
  });

  it("ignored rows being present does not change the result when correctly passing 0", () => {
    // Simulate: 3 actionable, 1 resolved via alias, 2 ignored — but we pass 0
    assert.equal(countBlockingUnresolved(3, 1, 0), 2);
  });
});
