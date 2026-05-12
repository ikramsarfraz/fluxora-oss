import { createHash, timingSafeEqual } from "node:crypto";
import {
  decodeProtectedHeader,
  errors as joseErrors,
  importJWK,
  jwtVerify,
  type CryptoKey,
} from "jose";

const JWK_TTL_MS = 24 * 60 * 60 * 1000;
const REPLAY_WINDOW_SECONDS = 5 * 60;

type CachedKey = { key: CryptoKey; cachedAt: number };
const keyCache = new Map<string, CachedKey>();

export type PlaidWebhookVerificationErrorCode =
  | "missing_header"
  | "malformed_header"
  | "unsupported_alg"
  | "key_fetch_failed"
  | "key_expired"
  | "signature_invalid"
  | "stale_jwt"
  | "body_hash_mismatch";

export class PlaidWebhookVerificationError extends Error {
  constructor(
    message: string,
    readonly code: PlaidWebhookVerificationErrorCode,
  ) {
    super(message);
    this.name = "PlaidWebhookVerificationError";
  }
}

async function fetchKey(kid: string): Promise<CryptoKey> {
  const { getPlaidClient } = await import("./plaid-client");
  const plaid = getPlaidClient();
  let response;
  try {
    response = await plaid.webhookVerificationKeyGet({ key_id: kid });
  } catch (err) {
    throw new PlaidWebhookVerificationError(
      `Failed to fetch verification key for kid=${kid}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      "key_fetch_failed",
    );
  }
  const jwk = response.data.key;
  // Plaid's JWKPublicKey carries `expired_at: number | null`; a non-null value
  // means the key has been rotated and must not be used.
  if (jwk.expired_at != null) {
    throw new PlaidWebhookVerificationError(
      `Verification key kid=${kid} is expired (expired_at=${jwk.expired_at})`,
      "key_expired",
    );
  }
  const key = (await importJWK(jwk, jwk.alg)) as CryptoKey;
  return key;
}

async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const cached = keyCache.get(kid);
  if (cached && Date.now() - cached.cachedAt < JWK_TTL_MS) {
    return cached.key;
  }
  const key = await fetchKey(kid);
  keyCache.set(kid, { key, cachedAt: Date.now() });
  return key;
}

export function _resetKeyCacheForTests() {
  keyCache.clear();
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

type VerifyOptions = {
  rawBody: string;
  jwtHeaderValue: string | null | undefined;
  /** Override key resolution (for tests). */
  resolveKey?: (kid: string) => Promise<CryptoKey>;
  /** Override clock (for tests). Returns seconds since epoch. */
  now?: () => number;
};

export async function verifyPlaidWebhook(options: VerifyOptions): Promise<void> {
  const { rawBody, jwtHeaderValue, resolveKey, now } = options;

  if (!jwtHeaderValue) {
    throw new PlaidWebhookVerificationError(
      "Missing Plaid-Verification header",
      "missing_header",
    );
  }

  let header;
  try {
    header = decodeProtectedHeader(jwtHeaderValue);
  } catch {
    throw new PlaidWebhookVerificationError(
      "Plaid-Verification header is not a valid JWT",
      "malformed_header",
    );
  }
  if (header.alg !== "ES256") {
    throw new PlaidWebhookVerificationError(
      `Unsupported JWT alg: ${header.alg ?? "<missing>"}`,
      "unsupported_alg",
    );
  }
  if (typeof header.kid !== "string" || header.kid.length === 0) {
    throw new PlaidWebhookVerificationError(
      "JWT header missing kid",
      "malformed_header",
    );
  }

  const key = await (resolveKey ?? getVerificationKey)(header.kid);

  let payload;
  try {
    ({ payload } = await jwtVerify(jwtHeaderValue, key, {
      algorithms: ["ES256"],
    }));
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) {
      throw new PlaidWebhookVerificationError(
        `JWT signature verification failed: ${err.code}`,
        "signature_invalid",
      );
    }
    throw err;
  }

  const nowSeconds = (now ?? (() => Math.floor(Date.now() / 1000)))();
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  if (iat == null || nowSeconds - iat > REPLAY_WINDOW_SECONDS) {
    throw new PlaidWebhookVerificationError(
      `JWT iat outside replay window (iat=${iat ?? "<missing>"}, now=${nowSeconds})`,
      "stale_jwt",
    );
  }

  const claimedHash = (payload as Record<string, unknown>).request_body_sha256;
  if (typeof claimedHash !== "string" || claimedHash.length !== 64) {
    throw new PlaidWebhookVerificationError(
      "JWT missing request_body_sha256 claim",
      "body_hash_mismatch",
    );
  }
  const actualHash = sha256Hex(rawBody);
  if (!constantTimeHexEqual(claimedHash, actualHash)) {
    throw new PlaidWebhookVerificationError(
      "Request body hash does not match JWT claim",
      "body_hash_mismatch",
    );
  }
}
