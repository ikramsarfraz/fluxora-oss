import { getCookies } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

function normalizeSameSite(
  value: string | undefined,
): "lax" | "strict" | "none" | undefined {
  if (!value) return undefined;
  const lowered = value.toLowerCase();
  if (lowered === "lax" || lowered === "strict" || lowered === "none") {
    return lowered;
  }
  return undefined;
}

/**
 * Clears the Better Auth session cookie(s) and redirects to `/login` on the
 * same host.
 *
 * Why this exists: `proxy.ts` decides "are you signed in?" from cheap cookie
 * *presence* (`getSessionCookie`), while the tenant app layout decides it from
 * a real `auth.api.getSession()` + tenant-membership check. When a session
 * cookie outlives its validity for a host (cross-tenant cookie reuse, a deleted
 * session row, or a missing/inactive tenant), those two checks disagree
 * permanently: the layout bounces `/ → /login`, the proxy bounces
 * `/login → /`, and the browser shows "too many redirects". An RSC render
 * cannot emit `Set-Cookie`, so the layout routes through this handler to
 * actually delete the phantom cookie and break the loop.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const loginUrl = new URL("/login", request.nextUrl.origin);
  if (callbackUrl && callbackUrl.startsWith("/")) {
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  const response = NextResponse.redirect(loginUrl);

  const cookies = getCookies(auth.options);
  // Expire the session token (what the proxy reads) plus the cached session
  // data cookie. Names already carry the resolved prefix (`__Secure-` in prod);
  // attributes carry the cross-subdomain `domain`, so this matches what was set.
  for (const cookie of [cookies.sessionToken, cookies.sessionData]) {
    response.cookies.set(cookie.name, "", {
      maxAge: 0,
      path: cookie.attributes.path,
      domain: cookie.attributes.domain,
      httpOnly: cookie.attributes.httpOnly,
      secure: cookie.attributes.secure,
      sameSite: normalizeSameSite(cookie.attributes.sameSite),
    });
  }

  return response;
}
