import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

// App-wide 404. Next.js falls back to its default unstyled page when this
// file doesn't exist, which renders with hard-coded colors that didn't
// survive the workspace's cream theme (white text on cream → unreadable).
// This file replaces it with a themed page that uses the same tokens as
// the rest of the app.
//
// `notFound()` calls from anywhere in the route tree resolve to the
// nearest not-found.tsx going up the tree — placing this at the root
// catches every miss. A future per-segment `not-found.tsx` (e.g. inside
// `app/(app)/`) could provide layout-aware variants if needed.

export default function NotFound() {
  return (
    <main
      role="main"
      className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-8 text-muted-foreground" aria-hidden />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist, was moved, or you
          might not have access to it. Check the URL or head back to the
          dashboard.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/support">Contact support</Link>
        </Button>
      </div>
    </main>
  );
}
