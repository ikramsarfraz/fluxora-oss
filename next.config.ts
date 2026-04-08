import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
