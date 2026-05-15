// Decides whether to kick off the OpenAI vision call concurrently with the
// text-AI call, instead of waiting for the text-AI to fail first. The wall
// clock difference matters: a serial text → fail → vision waterfall on a
// hard invoice costs ~8s (text) + ~12s (vision) ≈ 20s; running them in
// parallel cuts that to max(8s, 12s) ≈ 12s.
//
// Cost trade-off: speculative dispatch can pay for a vision call that turns
// out to be unnecessary (text-AI alone was sufficient). The heuristics below
// only fire when there's strong evidence text alone won't recover the line
// items, so the wasted-call rate stays low.
//
// Pure module — no server-only imports, safe for tests.

export type ShouldSpeculativelyDispatchVisionInput = {
  extractedTextLength: number;
  pdfPageCount: number;
  /** Lines the deterministic regex parser was able to read out of the text. */
  deterministicLineCount: number;
  /** False when the caller can't run vision (e.g. PDF bytes weren't kept). */
  hasPdfBytes: boolean;
};

/**
 * Returns true when the extracted text looks insufficient for AI text parsing
 * to succeed — strong signal that vision will be the path that produces the
 * final result, so dispatching it in parallel with text-AI is a net win.
 */
export function shouldSpeculativelyDispatchVision(
  args: ShouldSpeculativelyDispatchVisionInput,
): boolean {
  if (!args.hasPdfBytes) return false;

  const charsPerPage =
    args.extractedTextLength / Math.max(args.pdfPageCount, 1);

  // Very sparse text per page — likely image-heavy or scanned-with-OCR PDF
  // where text-AI will hallucinate or return nothing.
  if (charsPerPage < 100) return true;

  // Deterministic parser found no lines AND the text density is low. Even
  // if there's some text, the table structure was lost in extraction; vision
  // is almost always the path that recovers it.
  if (args.deterministicLineCount === 0 && charsPerPage < 300) return true;

  return false;
}
