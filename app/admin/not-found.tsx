import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Branded 404 for everything under `/admin/*`. Tenant detail, support
 * detail, and AI usage drilldown all call `notFound()` when the id
 * doesn't resolve — without this segment-level not-found.tsx they'd
 * fall back to the root `app/not-found.tsx`, which links to "/" (the
 * tenant app) and is wrong for platform admins on `admin.<host>`.
 */
export default function PlatformAdminNotFound() {
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
          That admin record doesn&rsquo;t exist
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The tenant, ticket, or user you&rsquo;re looking for may have been
          removed, or the id in the URL is wrong. Use the sidebar to navigate
          back into a list view.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/admin">Platform dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/tenants">Tenants</Link>
        </Button>
      </div>
    </main>
  );
}
