import "server-only";

// pdfjs-dist's legacy build evaluates `const SCALE_MATRIX = new DOMMatrix();`
// at module top level. Its own polyfill tries to source DOMMatrix from
// `@napi-rs/canvas` via a runtime `createRequire`, which Next.js's file
// tracer can't see — so `@napi-rs/canvas` isn't included in the Vercel
// lambda bundle, the require fails, and the top-level `new DOMMatrix()`
// throws `ReferenceError: DOMMatrix is not defined`, taking the whole
// supplier-invoices route down with it.
//
// We only use pdfjs-dist for text extraction (no canvas rendering), so a
// no-op stub is enough to satisfy the constructor. Import this module
// *before* any pdfjs-dist import in the same file.
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  class DOMMatrixStub {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(_init?: unknown) {}
    multiplySelf() {
      return this;
    }
    preMultiplySelf() {
      return this;
    }
    translate() {
      return this;
    }
    scale() {
      return this;
    }
    invertSelf() {
      return this;
    }
  }
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixStub;
}

export {};
