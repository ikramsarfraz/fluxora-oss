import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailDestinationSelectPayload = {
  email: string;
  callbackUrl: string | null;
  exp: number;
};

function getSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set.");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signValue(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest();
}

export function normalizeEmailForDestinationSelect(email: string) {
  return email.trim().toLowerCase();
}

export function createEmailDestinationSelectToken(
  payload: Omit<EmailDestinationSelectPayload, "exp"> & { exp?: number },
) {
  const normalized: EmailDestinationSelectPayload = {
    email: normalizeEmailForDestinationSelect(payload.email),
    callbackUrl: payload.callbackUrl?.trim() || null,
    exp: payload.exp ?? Date.now() + 10 * 60 * 1000,
  };

  const body = base64UrlEncode(JSON.stringify(normalized));
  const signature = base64UrlEncode(signValue(body));

  return `${body}.${signature}`;
}

export function parseEmailDestinationSelectToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new Error("Invalid email destination select token.");
  }

  const expectedSignature = signValue(body);
  const providedSignature = base64UrlDecode(signature);

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new Error("Invalid email destination select token signature.");
  }

  const payload = JSON.parse(
    base64UrlDecode(body).toString("utf8"),
  ) as EmailDestinationSelectPayload;

  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error("This link has expired. Go back to sign in and try again.");
  }

  if (!payload.email) {
    throw new Error("Invalid email destination select payload.");
  }

  return {
    email: payload.email,
    callbackUrl: payload.callbackUrl,
  };
}
