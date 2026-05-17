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
 */
export function hashPdfBytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
