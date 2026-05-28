"use client";

import { useEffect } from "react";

import { PageError } from "@/components/page-error";

/**
 * Route error boundary for everything under `/admin/*`. Catches server
 * action / loader / render failures and shows a recoverable card with a
 * Try-again handler that re-runs the failed segment. Without this, a
 * thrown error in any platform-admin page would bubble to Next's
 * default 500 screen and lose the surrounding sidebar.
 */
export default function PlatformAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] segment error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="px-4 py-8">
      <PageError
        title="Couldn't load this page"
        message={
          error.message ||
          "An unexpected error happened while loading this admin page. Try again, or refresh the browser."
        }
        onRetry={reset}
      />
    </div>
  );
}
