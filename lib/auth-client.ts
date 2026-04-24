import { createAuthClient } from "better-auth/react";

/**
 * Use same-origin auth endpoints so tenant subdomains post back to their own
 * host while Better Auth still uses the configured root-domain callback URL.
 */
export const authClient = createAuthClient({
  baseURL: "",
});
