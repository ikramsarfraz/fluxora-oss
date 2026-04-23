import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  ],
  /**
   * Proxy FastAPI for `/api/*` only when Next has no matching route.
   * Default array rewrites run in `afterFiles` (before dynamic routes), so they stole
   * `/api/auth/*` from `app/api/auth/[...all]` and FastAPI returned 405. `fallback` runs
   * after filesystem + dynamic routes, so Better Auth keeps `/api/auth/*`.
   */
  async rewrites() {
    const backend = process.env.ERP_API_ORIGIN ?? "http://127.0.0.1:8000";
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backend.replace(/\/$/, "")}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
