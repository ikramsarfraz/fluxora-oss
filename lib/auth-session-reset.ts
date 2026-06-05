/**
 * Path of the session-reset route handler (`app/api/auth/session-reset`). The
 * tenant `app/(app)` layout redirects here instead of straight to `/login`
 * when it detects a session cookie that is present but unusable for the current
 * host — the handler clears the phantom cookie so `proxy.ts` stops bouncing the
 * request back (see the handler's doc comment for the full loop).
 */
export const SESSION_RESET_PATH = "/api/auth/session-reset";

/**
 * Builds a redirect target that clears the stale Better Auth session cookie and
 * then lands the user on `/login`. `callbackUrl` is preserved through the reset
 * so the user returns to where they were headed after signing in again.
 */
export function buildSessionResetPath(callbackUrl?: string | null): string {
  const params = new URLSearchParams();
  if (callbackUrl && callbackUrl.startsWith("/")) {
    params.set("callbackUrl", callbackUrl);
  }
  const query = params.toString();
  return query ? `${SESSION_RESET_PATH}?${query}` : SESSION_RESET_PATH;
}
