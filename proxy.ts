import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import {
  applyRateLimit,
  rateLimiters,
  rateLimitResponseHeaders,
} from "@/lib/rate-limit";
import { TENANT_ROUTE_PATH_HEADER } from "@/lib/subscription-guard-constants";
import { getRequestTenantHostContextFromHeaders } from "@/lib/tenant-host";

const MAGIC_LINK_PATH = "/api/auth/sign-in/magic-link";

/** Paths the generic API rate limiter should NOT apply to. */
function isRateLimitExempt(pathname: string): boolean {
  return (
    pathname === "/api/plaid/webhook" ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/")
  );
}

async function rateLimitApiRequest(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return null;

  if (pathname === MAGIC_LINK_PATH && request.method === "POST") {
    let email: string | null = null;
    try {
      const body = (await request.clone().json()) as { email?: unknown };
      if (typeof body.email === "string") {
        email = body.email.trim().toLowerCase();
      }
    } catch {
      // non-JSON body or unreadable — fall through to deny with generic IP limit
    }
    if (email) {
      const result = await applyRateLimit(
        rateLimiters.magicLink,
        `email:${email}`,
      );
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: rateLimitResponseHeaders(result) },
        );
      }
    }
    // intentionally fall through — magic link is in /api/auth/, also exempt
    // from the generic limiter, so no double-limit.
    return null;
  }

  if (isRateLimitExempt(pathname)) return null;

  const ip = getClientIp(request.headers);
  const result = await applyRateLimit(rateLimiters.genericApi, `ip:${ip}`);
  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitResponseHeaders(result) },
    );
  }
  return null;
}

function isSharedAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/google/complete") ||
    pathname.startsWith("/google/select-tenant") ||
    pathname.startsWith("/select-destination") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/invite") ||
    pathname === "/changelog" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invitations") ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/api/cron/")
  );
}

function isRootOnlyPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/reel") ||
    pathname.startsWith("/marketing")
  );
}

function isTenantAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname === "/admin/roles" ||
    pathname === "/admin/branding" ||
    pathname === "/admin/billing"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rateLimitResponse = await rateLimitApiRequest(request);
  if (rateLimitResponse) return rateLimitResponse;

  const requestHeaders = new Headers(request.headers);
  // Prevent clients from forging tenant identity — slug is derived
  // exclusively from the hostname and re-set below.
  requestHeaders.delete("x-tenant-slug");
  /** Passed to tenant RSC layout for subscription guards (see `app/(app)/layout.tsx`). */
  requestHeaders.set(TENANT_ROUTE_PATH_HEADER, pathname);
  const hostContext = getRequestTenantHostContextFromHeaders(requestHeaders);
  const tenantSlug = hostContext.tenantSlug;
  const isTenantHost = hostContext.isTenantHost;
  const isPlatformAdminHost = hostContext.isPlatformAdminHost;
  const sessionCookie = getSessionCookie(request);

  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }

  if (isPlatformAdminHost) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if ((pathname === "/login" || pathname === "/sign-in") && sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (isSharedAuthPath(pathname) || pathname === "/admin" || pathname.startsWith("/admin/")) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isTenantHost) {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (isRootOnlyPath(pathname) || isSharedAuthPath(pathname)) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    pathname === "/features" ||
    pathname === "/pricing" ||
    pathname.startsWith("/marketing")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/roles";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    pathname === "/admin/roles" ||
    pathname === "/admin/branding" ||
    pathname === "/admin/billing"
  ) {
    const rewrittenUrl = request.nextUrl.clone();
    if (pathname === "/admin/roles") {
      rewrittenUrl.pathname = "/tenant-admin/roles";
    } else if (pathname === "/admin/branding") {
      rewrittenUrl.pathname = "/tenant-admin/branding";
    } else {
      rewrittenUrl.pathname = "/settings/billing/plan-and-usage";
    }
    return NextResponse.rewrite(rewrittenUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname.startsWith("/admin/") && !isTenantAdminPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && sessionCookie) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = "/dashboard";
    return NextResponse.rewrite(rewrittenUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", "/");
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/sign-in") && sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isSharedAuthPath(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "callbackUrl",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  /**
   * Runs on navigations + API/`trpc` (not hashed static bundles under `_next`).
   * Static assets/extensions and most images are skipped; subscription guard header is still pushed
   * on every forwarded request that hits this middleware.
   * `/api/stripe/webhook`, `/api/auth/*`, and `/api/invitations/*` routes pass through logic above and
   * carry `pathname` (/api/stripe/webhook resolves to Stripe only — no tenant app layout).
   */
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
