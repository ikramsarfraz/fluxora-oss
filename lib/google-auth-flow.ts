import { createHmac, timingSafeEqual } from "node:crypto";

export type GoogleAuthMode = "login" | "signup";
export type GoogleAuthSignupType = "solo" | "business";

export type GoogleAuthFlowPayload = {
  mode: GoogleAuthMode;
  returnTo: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  signupType?: GoogleAuthSignupType | null;
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
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signValue(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest();
}

export function normalizeGoogleReturnTo(input?: string | null) {
  if (!input || !input.startsWith("/")) {
    return "/";
  }

  return input;
}

export function createGoogleAuthFlowToken(
  payload: Omit<GoogleAuthFlowPayload, "exp"> & { exp?: number },
) {
  const normalized: GoogleAuthFlowPayload = {
    ...payload,
    returnTo: normalizeGoogleReturnTo(payload.returnTo),
    exp: payload.exp ?? Date.now() + 10 * 60 * 1000,
  };

  const body = base64UrlEncode(JSON.stringify(normalized));
  const signature = base64UrlEncode(signValue(body));

  return `${body}.${signature}`;
}

export function parseGoogleAuthFlowToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new Error("Invalid Google auth flow token.");
  }

  const expectedSignature = signValue(body);
  const providedSignature = base64UrlDecode(signature);

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new Error("Invalid Google auth flow signature.");
  }

  const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as GoogleAuthFlowPayload;

  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error("Google auth flow has expired. Please try again.");
  }

  return payload;
}

export function isGoogleAuthEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}
