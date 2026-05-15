import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localtest.me", "*.localtest.me"],
  experimental: {
    serverActions: {
      // Bulk import accepts up to 10 PDFs at ~25 MB each. Default 1 MB body
      // limit on server actions would reject the request before it reaches
      // any validation. 50 MB matches the practical upper bound here while
      // staying well below platform limits.
      bodySizeLimit: "50mb",
    },
  },
  /**
   * `@react-pdf/renderer` and its transitive packages rely on the client-side
   * React build (they read `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`).
   * When bundled through the App Router's server/RSC pipeline, `react` gets
   * resolved to `react.react-server.js`, which does NOT expose that symbol,
   * so `renderToBuffer` crashes with "Cannot read properties of undefined
   * (reading 'S')".
   *
   * Marking them as server-external packages keeps them out of the RSC
   * bundler and forces plain Node module resolution on the server, which
   * resolves `react` to the regular client build that has the internals.
   */
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/reconciler",
    "@react-pdf/font",
    "@react-pdf/pdfkit",
    "@react-pdf/image",
    "@react-pdf/layout",
    "@react-pdf/primitives",
    "@react-pdf/render",
    "@react-pdf/stylesheet",
    "@react-pdf/svg",
    "@react-pdf/textkit",
    "@react-pdf/fns",
    "@react-pdf/types",
    "fontkit",
    "pdf-parse",
    "pdfjs-dist",
  ],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  // Source maps only when we have an upload token (CI / Vercel build with secret).
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Tunnel browser SDK requests through our origin to bypass ad-blockers.
  // Keep disabled for now — adds a route + bandwidth cost; flip when needed.
  tunnelRoute: undefined,
});
