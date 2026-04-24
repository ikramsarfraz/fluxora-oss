import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildRootAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";

function isSharedAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/google/complete") ||
    pathname.startsWith("/google/select-tenant") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invitations")
  );
}

function isRootOnlyPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/features") || pathname.startsWith("/pricing");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const hostContext = getRequestTenantHostContextFromHeaders(request.headers);
  const tenantSlug = hostContext.tenantSlug;
  const isTenantHost = hostContext.isTenantHost;
  const isPlatformAdminHost = hostContext.isPlatformAdminHost;
  const sessionCookie = getSessionCookie(request);

  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  } else {
    requestHeaders.delete("x-tenant-slug");
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

  if (pathname === "/signup" || pathname === "/sign-up") {
    return NextResponse.redirect(
      buildRootAppUrl({
        pathname: "/signup",
        context: hostContext,
      }),
    );
  }

  if (pathname === "/features" || pathname === "/pricing") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
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
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
