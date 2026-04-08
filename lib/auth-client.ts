import { createAuthClient } from "better-auth/react";

/** Same origin as the app in dev, e.g. http://localhost:3000 — see .env.local.example */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "",
});
