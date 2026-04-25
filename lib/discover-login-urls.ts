import type { RequestTenantHostContext } from "@/lib/tenant-host";
import {
  buildPlatformAdminAppUrl,
  buildRootAppUrl,
  buildTenantAppUrl,
} from "@/lib/tenant-host";

function rootAppOrigin(context: RequestTenantHostContext) {
  return new URL(
    buildRootAppUrl({ pathname: "/", context }),
  ).origin;
}

/**
 * Rebuilds a tenant sign-in link when it is root-relative (resolves to the
 * wrong host) or was accidentally built for the root origin.
 */
export function ensureMemberTenantLoginUrl(
  args: {
    loginUrl: string;
    tenantSlug: string;
    email: string;
    callbackUrl: string;
    context: RequestTenantHostContext;
  },
) {
  const { loginUrl, tenantSlug, email, callbackUrl, context } = args;
  const rootOrigin = rootAppOrigin(context);

  const rebuild = () =>
    buildTenantAppUrl({
      slug: tenantSlug,
      pathname: "/login",
      searchParams: { email, callbackUrl },
      context,
    });

  if (!loginUrl || !/^\s*https?:\/\//i.test(loginUrl)) {
    return rebuild();
  }

  let origin: string;
  try {
    origin = new URL(loginUrl).origin;
  } catch {
    return rebuild();
  }

  if (origin === rootOrigin) {
    return rebuild();
  }

  return loginUrl;
}

/**
 * Rebuilds platform admin sign-in when the URL is not on the admin host
 * (e.g. root-relative to the public root).
 */
export function ensurePlatformAdminMemberLoginUrl(args: {
  loginUrl: string;
  email: string;
  context: RequestTenantHostContext;
}) {
  const { loginUrl, email, context } = args;
  const rootOrigin = rootAppOrigin(context);
  const adminOrigin = new URL(
    buildPlatformAdminAppUrl({ pathname: "/", context }),
  ).origin;

  const rebuild = () =>
    buildPlatformAdminAppUrl({
      pathname: "/login",
      searchParams: { email, callbackUrl: "/admin" },
      context,
    });

  if (!loginUrl || !/^\s*https?:\/\//i.test(loginUrl)) {
    return rebuild();
  }

  let origin: string;
  try {
    origin = new URL(loginUrl).origin;
  } catch {
    return rebuild();
  }

  if (origin === rootOrigin || origin !== adminOrigin) {
    return rebuild();
  }

  return loginUrl;
}
