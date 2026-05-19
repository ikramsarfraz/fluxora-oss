import { Skeleton } from "@/components/ui/skeleton";

/**
 * Settings hub loading skeleton.
 *
 * Renders INSIDE the settings layout (the px-9 / pt-8 / bg-page wrapper),
 * so it only needs to skeleton the right-pane content — the sub-nav rail
 * on the left is already provided by the layout itself.
 *
 * The shape mirrors what a typical settings sub-page renders:
 *   <SettingsPageHeader title=… description=… />   ← title bar + helper +
 *                                                    bottom border-b
 *   <Card>                                          ← either a settings
 *     …                                                form or a table
 *   </Card>
 *
 * Tuned to the same dimensions as settings-page-header.tsx
 * (22px / 600 / -0.02em title; 13px subtle description; border-b pb-5; mb-6).
 */
export default function Loading() {
  return (
    <div>
      {/* SettingsPageHeader replica */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border-default pb-5">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-[22px] w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0" />
      </div>

      {/* Content card — settings pages are usually tables or stacked forms;
         a table-shaped skeleton fits the majority case (Members, Activity
         log, Categories, UoM, Roles, API keys, Webhooks, Banks, Audit log)
         and looks acceptable on the rarer form-shaped pages (Branding,
         General, Plan & Usage) for the brief moment it shows. */}
      <div className="overflow-hidden rounded-lg border border-border-default bg-card">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_0.6fr] gap-4 border-b border-border-default bg-surface px-3 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="divide-y divide-divider">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.5fr_1fr_1fr_0.6fr] items-center gap-4 px-3 py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
