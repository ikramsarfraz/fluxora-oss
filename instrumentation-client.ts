import * as Sentry from "@sentry/nextjs";

import { filterSensitiveData } from "@/lib/sentry-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  // Session Replay is opt-in via env; off by default to keep payload small.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: filterSensitiveData,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
