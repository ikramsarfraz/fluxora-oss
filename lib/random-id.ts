// Browsers only expose `crypto.randomUUID` in secure contexts — HTTPS or
// `localhost`. A tenant subdomain like `acme.localtest.me` resolves to
// 127.0.0.1 but is NOT a secure context, so `crypto.randomUUID()` throws
// `is not a function` in local dev. `crypto.getRandomValues` is available
// regardless, so we build a v4 UUID from it as the fallback. On the server,
// the native path is always taken.
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
