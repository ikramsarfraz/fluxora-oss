import { headers } from "next/headers";

export type RequestTenantHostContext = {
  host: string;
  hostname: string;
  port: string | null;
  protocol: "http" | "https";
  rootDomain: string;
  hostType: "root" | "tenant" | "platform-admin";
  tenantSlug: string | null;
  isRootHost: boolean;
  isTenantHost: boolean;
  isPlatformAdminHost: boolean;
};

export const PLATFORM_ADMIN_SLUG = "admin";

const RESERVED_TENANT_SLUGS = new Set([
  PLATFORM_ADMIN_SLUG,
  "www",
  "localhost",
]);

function normalizeHostname(host: string) {
  return host.trim().toLowerCase();
}

function splitHostAndPort(rawHost: string) {
  const trimmed = rawHost.split(",")[0]?.trim() ?? "";
  const lastColon = trimmed.lastIndexOf(":");

  if (lastColon <= 0 || trimmed.includes("]")) {
    return { hostname: normalizeHostname(trimmed), port: null };
  }

  const hostname = trimmed.slice(0, lastColon);
  const port = trimmed.slice(lastColon + 1);

  if (!/^\d+$/.test(port)) {
    return { hostname: normalizeHostname(trimmed), port: null };
  }

  return { hostname: normalizeHostname(hostname), port };
}

export function slugifyTenantName(input: string) {
  const slug = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "tenant";
}

export function isReservedTenantSlug(slug: string) {
  return RESERVED_TENANT_SLUGS.has(slug.trim().toLowerCase());
}

export function getRootDomain() {
  const raw = process.env.ROOT_DOMAIN?.trim().toLowerCase();
  if (!raw) {
    throw new Error("ROOT_DOMAIN is not set.");
  }
  // Strip any accidental protocol prefix (e.g. "https://uat.app.example.com" → "uat.app.example.com")
  const rootDomain = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!rootDomain) {
    throw new Error(
      "ROOT_DOMAIN resolved to an empty string after stripping protocol.",
    );
  }
  return rootDomain;
}

export function parseTenantSlugFromHostname(
  hostname: string,
  rootDomain = getRootDomain(),
) {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = normalizeHostname(rootDomain);

  if (normalizedHost === `${PLATFORM_ADMIN_SLUG}.${normalizedRoot}`) {
    return null;
  }

  if (
    normalizedHost === normalizedRoot ||
    normalizedHost === `www.${normalizedRoot}`
  ) {
    return null;
  }

  if (normalizedHost === "localhost" || normalizedHost === "127.0.0.1") {
    return null;
  }

  if (normalizedHost.endsWith(".localhost")) {
    const slug = normalizedHost.slice(0, -".localhost".length);
    return slug || null;
  }

  if (normalizedHost.endsWith(".127.0.0.1")) {
    const slug = normalizedHost.slice(0, -".127.0.0.1".length);
    return slug || null;
  }

  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) {
    return null;
  }

  const slug = normalizedHost.slice(0, -1 * `.${normalizedRoot}`.length);
  return slug || null;
}

export function isPlatformAdminHostname(
  hostname: string,
  rootDomain = getRootDomain(),
) {
  return (
    normalizeHostname(hostname) ===
    `${PLATFORM_ADMIN_SLUG}.${normalizeHostname(rootDomain)}`
  );
}

export function getProtocolFromHeaders(headersLike: Headers) {
  const forwardedProto = headersLike
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  if (forwardedProto === "http" || forwardedProto === "https") {
    return forwardedProto;
  }

  const rawHost =
    headersLike.get("host") ?? headersLike.get("x-forwarded-host") ?? "";
  const { hostname } = splitHostAndPort(rawHost);

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".127.0.0.1") ||
    hostname.endsWith(".localtest.me")
  ) {
    return "http";
  }

  return "https";
}

export function getRequestTenantHostContextFromHeaders(
  requestHeaders: Headers,
): RequestTenantHostContext {
  const host =
    requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host") ?? "";
  const { hostname, port } = splitHostAndPort(host);
  const rootDomain = getRootDomain();
  const xTenantSlugHeader = requestHeaders.get("x-tenant-slug");
  const isPlatformAdminHost = isPlatformAdminHostname(hostname, rootDomain);
  const tenantSlug = isPlatformAdminHost
    ? null
    : (xTenantSlugHeader ?? parseTenantSlugFromHostname(hostname, rootDomain));
  const protocol = getProtocolFromHeaders(requestHeaders);
  const hostType = isPlatformAdminHost
    ? "platform-admin"
    : tenantSlug
      ? "tenant"
      : "root";

  const isRootHost =
    hostType === "root" &&
    (hostname === rootDomain ||
      hostname === `www.${rootDomain}` ||
      hostname === "localhost" ||
      hostname === "127.0.0.1");
  const isTenantHost = hostType === "tenant";

  return {
    host,
    hostname,
    port,
    protocol,
    rootDomain,
    hostType,
    tenantSlug,
    isRootHost,
    isTenantHost,
    isPlatformAdminHost,
  };
}

export async function getRequestTenantHostContext() {
  return getRequestTenantHostContextFromHeaders(await headers());
}

function buildHostForTenant(slug: string, context: RequestTenantHostContext) {
  const normalizedSlug = slugifyTenantName(slug);

  const localBaseHost =
    context.hostname === "localhost" ||
    context.hostname === "127.0.0.1" ||
    context.hostname.endsWith(".localhost") ||
    context.hostname.endsWith(".127.0.0.1");

  if (localBaseHost) {
    const localRoot =
      context.hostname === "localhost" ||
      context.hostname.endsWith(".localhost")
        ? "localhost"
        : "127.0.0.1";
    return `${normalizedSlug}.${localRoot}${context.port ? `:${context.port}` : ""}`;
  }

  // e.g. tenant at acme.app.localtest.me when the browser is on app.localtest.me
  if (
    context.hostname.endsWith(".localtest.me") &&
    !context.isPlatformAdminHost &&
    (context.isRootHost || !context.tenantSlug)
  ) {
    return `${normalizedSlug}.${context.hostname}${context.port ? `:${context.port}` : ""}`;
  }

  return `${normalizedSlug}.${context.rootDomain}${context.port ? `:${context.port}` : ""}`;
}

export function buildTenantAppUrl(args: {
  slug: string;
  pathname: string;
  searchParams?: URLSearchParams | Record<string, string | null | undefined>;
  context: RequestTenantHostContext;
}) {
  const url = new URL(
    `${args.context.protocol}://${buildHostForTenant(args.slug, args.context)}`,
  );
  url.pathname = args.pathname;

  if (args.searchParams instanceof URLSearchParams) {
    url.search = args.searchParams.toString();
  } else if (args.searchParams) {
    for (const [key, value] of Object.entries(args.searchParams)) {
      if (value != null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export function buildPlatformAdminAppUrl(args: {
  pathname: string;
  searchParams?: URLSearchParams | Record<string, string | null | undefined>;
  context: RequestTenantHostContext;
}) {
  const host = `${PLATFORM_ADMIN_SLUG}.${args.context.rootDomain}${
    args.context.port ? `:${args.context.port}` : ""
  }`;

  const url = new URL(`${args.context.protocol}://${host}`);
  url.pathname = args.pathname;

  if (args.searchParams instanceof URLSearchParams) {
    url.search = args.searchParams.toString();
  } else if (args.searchParams) {
    for (const [key, value] of Object.entries(args.searchParams)) {
      if (value != null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export function buildRootAppUrl(args: {
  pathname: string;
  searchParams?: URLSearchParams | Record<string, string | null | undefined>;
  context: RequestTenantHostContext;
}) {
  const localBaseHost =
    args.context.hostname === "localhost" ||
    args.context.hostname === "127.0.0.1" ||
    args.context.hostname.endsWith(".localhost") ||
    args.context.hostname.endsWith(".127.0.0.1");

  const host = localBaseHost
    ? `${args.context.hostname.endsWith(".127.0.0.1") ? "127.0.0.1" : "localhost"}${
        args.context.port ? `:${args.context.port}` : ""
      }`
    : `${args.context.rootDomain}${args.context.port ? `:${args.context.port}` : ""}`;

  const url = new URL(`${args.context.protocol}://${host}`);
  url.pathname = args.pathname;

  if (args.searchParams instanceof URLSearchParams) {
    url.search = args.searchParams.toString();
  } else if (args.searchParams) {
    for (const [key, value] of Object.entries(args.searchParams)) {
      if (value != null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}
