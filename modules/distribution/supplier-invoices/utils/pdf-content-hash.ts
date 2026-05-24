import { createHash } from "node:crypto";

/**
 * SHA-256 of the PDF bytes, hex-encoded. Stable across re-uploads of the
 * exact same file; changes if even one byte differs (so a re-export from
 * the supplier portal that includes a new timestamp will miss — that's
 * the correct behavior, since the content might differ subtly).
 *
 * Used as the cache key for `ai_extraction_cache`, scoped per tenant.
 * Lives in `utils/` (not the cache service) so callers and tests can
 * import it without pulling in `server-only` and the DB driver.
 *
 * Throws on empty input. Empty bytes would all hash to the same value
 * (the canonical SHA-256-of-empty `e3b0c442…`) and collide every cache
 * key onto one bucket — exactly the failure mode that bit the bulk
 * importer when pdfjs-dist detached the source ArrayBuffer mid-parse.
 * Failing fast here surfaces the upstream bug instead of silently
 * poisoning the cache.
 */
export function hashPdfBytes(bytes: Buffer | Uint8Array): string {
  if (bytes.byteLength === 0) {
    throw new Error(
      "hashPdfBytes: refusing to hash empty input — caller likely passed a Buffer whose underlying ArrayBuffer was detached upstream.",
    );
  }
  return createHash("sha256").update(bytes).digest("hex");
}
