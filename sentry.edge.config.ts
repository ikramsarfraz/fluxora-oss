import * as Sentry from "@sentry/nextjs";

import { filterSensitiveData } from "@/lib/sentry-filter";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment:
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: filterSensitiveData,
});
