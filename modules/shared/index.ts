// Shared utilities, UI primitives, and generic types used across modules.
// Only promote code here when it is clearly domain-agnostic and reused by 2+
// modules.
//
// IMPORTANT: this barrel re-exports SERVER-ONLY services. Client components
// must NOT import from "@/modules/shared" — the auth + portal-users
// services pull in next/headers + the DB driver, and the bundler can't
// tree-shake those out reliably (the dev server will fail with "Can't
// resolve 'tls' / 'node:async_hooks'" from pg + posthog-node).
//
// Client-safe helpers live under ./utils/* and must be imported from their
// deep path, e.g. `@/modules/shared/utils/payment-methods`.
export * from "./services/auth";
export * from "./services/portal-users";
export * from "./services/signup-profile";
