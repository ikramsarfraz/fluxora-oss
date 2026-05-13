import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const PLAID_TOKEN_PATTERN =
  /access-(sandbox|development|production)-[a-z0-9-]{8,}/gi;
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "state",
  "access_token",
  "refresh_token",
  "secret",
  "session",
  "magic_link",
]);

function redactQueryString(query: string | undefined): string | undefined {
  if (!query) return query;
  const trimmed = query.startsWith("?") ? query.slice(1) : query;
  const params = new URLSearchParams(trimmed);
  let mutated = false;
  for (const key of Array.from(params.keys())) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, "[redacted]");
      mutated = true;
    }
  }
  if (!mutated) return query;
  return `${query.startsWith("?") ? "?" : ""}${params.toString()}`;
}

function redactString(input: string | undefined | null): string | undefined {
  if (input == null) return undefined;
  return input.replace(PLAID_TOKEN_PATTERN, "[redacted-plaid-token]");
}

/**
 * Strips request bodies, auth headers, cookies, sensitive query params, and
 * Plaid access tokens from a Sentry event. Returning `null` drops the event
 * entirely.
 */
export function filterSensitiveData(
  event: ErrorEvent,
  _hint: EventHint,
): ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (
          lower === "authorization" ||
          lower === "cookie" ||
          lower === "x-vercel-id" ||
          lower.startsWith("x-better-auth")
        ) {
          headers[key] = "[redacted]";
        }
      }
    }
    if (event.request.query_string) {
      event.request.query_string = redactQueryString(
        typeof event.request.query_string === "string"
          ? event.request.query_string
          : undefined,
      ) as typeof event.request.query_string;
    }
    if (event.request.url) {
      try {
        const url = new URL(event.request.url);
        for (const key of Array.from(url.searchParams.keys())) {
          if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
            url.searchParams.set(key, "[redacted]");
          }
        }
        event.request.url = url.toString();
      } catch {
        // non-URL value — leave as-is
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      value.value = redactString(value.value) ?? value.value;
    }
  }

  if (event.message) {
    if (typeof event.message === "string") {
      event.message = redactString(event.message) ?? event.message;
    } else if (event.message && typeof event.message === "object") {
      const obj = event.message as { message?: string; formatted?: string };
      if (obj.message) obj.message = redactString(obj.message) ?? obj.message;
      if (obj.formatted)
        obj.formatted = redactString(obj.formatted) ?? obj.formatted;
    }
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.message)
        crumb.message = redactString(crumb.message) ?? crumb.message;
      if (crumb.data) {
        delete crumb.data["authorization"];
        delete crumb.data["cookie"];
      }
    }
  }

  return event;
}
