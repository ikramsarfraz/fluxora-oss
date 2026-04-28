import "server-only";

import {
  TENANT_ROUTE_PATH_HEADER,
} from "@/lib/subscription-guard-constants";

/**
 * Fallback keys some hosts/frameworks expose; used only when the canonical header (`TENANT_ROUTE_PATH_HEADER`) is absent.
 */
const PATHNAME_FALLBACK_HEADERS = ["x-invoke-path", "x-original-pathname"] as const;

/** Normalizes a URL path fragment to a leading-slash form matching `NextRequest.nextUrl.pathname`. */
function normalizePath(p: string): string {
  const t = p.trim();
  if (t === "" || t === ".") return "/";
  return t.startsWith("/") ? t : `/${t}`;
}

/** Best-effort: extract pathname from absolute HTTP URLs occasionally seen in forwarded headers. */
function pathnameFromLikelyAbsoluteUrl(headerValue: string): string | null {
  const trimmed = headerValue.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    try {
      return normalizePath(trimmed.split("?", 2)[0] ?? trimmed);
    } catch {
      return null;
    }
  }
  try {
    return normalizePath(new URL(trimmed).pathname);
  } catch {
    return null;
  }
}

/**
 * Resolved browser path for subscription guard decisions. Empty string means unresolved — treat as
 * missing (see subscriber layout redirect policy).
 */
export function resolveTenantAppPathname(headers: Headers): string {
  const canonical = headers.get(TENANT_ROUTE_PATH_HEADER)?.trim();
  if (canonical) {
    return normalizePath(canonical);
  }

  for (const name of PATHNAME_FALLBACK_HEADERS) {
    const raw = headers.get(name)?.trim();
    if (!raw) continue;
    const decoded = pathnameFromLikelyAbsoluteUrl(raw);
    if (decoded) return decoded;
  }

  const nextUrlHint = headers.get("x-forwarded-uri") ?? headers.get("x-forwarded-path");
  if (nextUrlHint?.trim()) {
    const decoded = pathnameFromLikelyAbsoluteUrl(nextUrlHint.trim());
    if (decoded) return decoded;
  }

  return "";
}

export function logSubscriptionGuardMissingPathname(details: {
  nodeEnv: string | undefined;
}): void {
  const payload = {
    feature: "subscription-access-guard",
    message:
      "Missing request pathname headers after resolveTenantAppPathname(). " +
      "Ensure root proxy/middleware forwards the browser URL (proxy.ts sets x-internal-pathname on every forwarded request). Blocked subscriptions fail closed to /billing-blocked.",
  };
  const line = `[${payload.feature}] ${payload.message}`;
  if (details.nodeEnv !== "production") {
    console.error(line);
    return;
  }
  console.warn(line);
}
