import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import { generateKeyPair, SignJWT, type CryptoKey } from "jose";

import {
  PlaidWebhookVerificationError,
  verifyPlaidWebhook,
} from "./webhook-verification";

const KID = "test-kid-1";

type Keypair = { publicKey: CryptoKey; privateKey: CryptoKey };

let keypair: Keypair | null = null;
async function getKeypair(): Promise<Keypair> {
  if (!keypair) {
    keypair = (await generateKeyPair("ES256", { extractable: true })) as Keypair;
  }
  return keypair;
}

function sha256Hex(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function sign(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  options: { iat?: number; kid?: string; alg?: string } = {},
) {
  const jwt = new SignJWT(payload).setProtectedHeader({
    alg: options.alg ?? "ES256",
    kid: options.kid ?? KID,
    typ: "JWT",
  });
  if (options.iat != null) jwt.setIssuedAt(options.iat);
  else jwt.setIssuedAt();
  return jwt.sign(privateKey);
}

test("verifyPlaidWebhook accepts a fresh, correctly-signed webhook", async () => {
  const { publicKey, privateKey } = await getKeypair();
  const rawBody = JSON.stringify({ webhook_type: "ITEM", item_id: "abc" });
  const token = await sign(
    { request_body_sha256: sha256Hex(rawBody) },
    privateKey,
  );

  await verifyPlaidWebhook({
    rawBody,
    jwtHeaderValue: token,
    resolveKey: async () => publicKey,
  });
});

test("verifyPlaidWebhook rejects missing header", async () => {
  await assert.rejects(
    verifyPlaidWebhook({ rawBody: "{}", jwtHeaderValue: null }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError && err.code === "missing_header",
  );
});

test("verifyPlaidWebhook rejects malformed JWT", async () => {
  await assert.rejects(
    verifyPlaidWebhook({ rawBody: "{}", jwtHeaderValue: "not-a-jwt" }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError && err.code === "malformed_header",
  );
});

test("verifyPlaidWebhook rejects unsupported alg (e.g. HS256)", async () => {
  const { publicKey } = await getKeypair();
  const hsKey = randomBytes(32);
  const token = await new SignJWT({
    request_body_sha256: sha256Hex("{}"),
  })
    .setProtectedHeader({ alg: "HS256", kid: KID, typ: "JWT" })
    .setIssuedAt()
    .sign(hsKey);

  await assert.rejects(
    verifyPlaidWebhook({
      rawBody: "{}",
      jwtHeaderValue: token,
      resolveKey: async () => publicKey,
    }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError &&
      err.code === "unsupported_alg",
  );
});

test("verifyPlaidWebhook rejects bad signature (wrong key)", async () => {
  const { privateKey } = await getKeypair();
  const other = (await generateKeyPair("ES256", { extractable: true })) as Keypair;
  const rawBody = "{}";
  const token = await sign(
    { request_body_sha256: sha256Hex(rawBody) },
    privateKey,
  );

  await assert.rejects(
    verifyPlaidWebhook({
      rawBody,
      jwtHeaderValue: token,
      resolveKey: async () => other.publicKey,
    }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError &&
      err.code === "signature_invalid",
  );
});

test("verifyPlaidWebhook rejects stale JWT (iat > 5 min ago)", async () => {
  const { publicKey, privateKey } = await getKeypair();
  const rawBody = "{}";
  const sixMinAgo = Math.floor(Date.now() / 1000) - 6 * 60;
  const token = await sign(
    { request_body_sha256: sha256Hex(rawBody) },
    privateKey,
    { iat: sixMinAgo },
  );

  await assert.rejects(
    verifyPlaidWebhook({
      rawBody,
      jwtHeaderValue: token,
      resolveKey: async () => publicKey,
    }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError && err.code === "stale_jwt",
  );
});

test("verifyPlaidWebhook accepts JWT at edge of replay window (just under 5 min)", async () => {
  const { publicKey, privateKey } = await getKeypair();
  const rawBody = "{}";
  const fourMin50sAgo = Math.floor(Date.now() / 1000) - (5 * 60 - 10);
  const token = await sign(
    { request_body_sha256: sha256Hex(rawBody) },
    privateKey,
    { iat: fourMin50sAgo },
  );

  await verifyPlaidWebhook({
    rawBody,
    jwtHeaderValue: token,
    resolveKey: async () => publicKey,
  });
});

test("verifyPlaidWebhook rejects body whose hash does not match the JWT claim", async () => {
  const { publicKey, privateKey } = await getKeypair();
  const signedBody = JSON.stringify({ webhook_type: "ITEM" });
  const tamperedBody = JSON.stringify({ webhook_type: "TRANSACTIONS" });
  const token = await sign(
    { request_body_sha256: sha256Hex(signedBody) },
    privateKey,
  );

  await assert.rejects(
    verifyPlaidWebhook({
      rawBody: tamperedBody,
      jwtHeaderValue: token,
      resolveKey: async () => publicKey,
    }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError &&
      err.code === "body_hash_mismatch",
  );
});

test("verifyPlaidWebhook rejects JWT missing request_body_sha256 claim", async () => {
  const { publicKey, privateKey } = await getKeypair();
  const rawBody = "{}";
  const token = await sign({}, privateKey);

  await assert.rejects(
    verifyPlaidWebhook({
      rawBody,
      jwtHeaderValue: token,
      resolveKey: async () => publicKey,
    }),
    (err: unknown) =>
      err instanceof PlaidWebhookVerificationError &&
      err.code === "body_hash_mismatch",
  );
});
