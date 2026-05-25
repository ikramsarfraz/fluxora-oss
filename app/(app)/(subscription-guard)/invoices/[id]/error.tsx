"use client";

import { useEffect } from "react";
import { PageError } from "@/components/page-error";

/**
 * Next.js route error boundary for the invoice detail page. Catches
 * any error thrown server-side (loader failures, tenant guard failures,
 * etc.) or in the rendered tree, and surfaces it via the shared
 * PageError component with a Try again handler that re-runs the
 * segment.
 *
 * This is the first error.tsx in the codebase — extend the pattern to
 * other detail routes that load heavyweight data when they prove flaky
 * for users.
 */
export default function InvoiceDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in dev consoles + Sentry breadcrumb stream. Sentry's
    // global handler will already capture the error; the digest helps
    // correlate browser logs with the server-side trace.
    console.error("[invoices/[id]] segment error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="px-4 py-8">
      <PageError
        title="Couldn't load this invoice"
        message={
          error.message ||
          "An unexpected error happened while loading this invoice. Try again, or refresh the page."
        }
        onRetry={reset}
      />
    </div>
  );
}
