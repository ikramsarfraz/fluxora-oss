/**
 * Extracts the client IP from forwarding headers set by the platform
 * (Vercel, Cloudflare, generic reverse proxies). Falls back to "unknown"
 * — never throws. Rate-limit identifiers must always resolve to something.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnecting = headers.get("cf-connecting-ip");
  if (cfConnecting) return cfConnecting.trim();
  return "unknown";
}
