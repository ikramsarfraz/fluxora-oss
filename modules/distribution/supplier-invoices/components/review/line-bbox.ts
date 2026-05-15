/**
 * Bounding-box coordinates for a parsed line, expressed in PDF user-space
 * points (origin top-left, same as PDF.js viewports with `flipY` applied).
 * Phase 5 will source these from the OCR provider; until then the demo
 * supplies hand-tuned boxes positioned over the placeholder canvas so the
 * highlight wiring is verifiable today.
 */
export type LineBbox = {
  lineId: number;
  /** x of top-left corner. */
  x: number;
  /** y of top-left corner. */
  y: number;
  width: number;
  height: number;
  /** Optional page index (1-based). Defaults to 1 when omitted. */
  page?: number;
};
