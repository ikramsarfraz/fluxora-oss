import { PageHeaderSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton that matches the actual add/edit supplier form layout —
 * 5 sections of varying field counts on the left, "Why we ask" side panel
 * on the right. Replaces the generic FormPageSkeleton which rendered 2
 * identical sections in a single full-width column, causing a noticeable
 * layout jump when the form loaded in.
 */
export function SupplierFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <FormCardSkeleton />
        <SidePanelSkeleton />
      </div>
    </div>
  );
}

function FormCardSkeleton() {
  return (
    <Card className="w-full shadow-none">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-7">
          {/* Identity — name (full), then account # / website (2-col @md) */}
          <FormSectionShell title="Identity">
            <FieldStub />
            <div className="grid gap-6 @md/section:grid-cols-2">
              <FieldStub />
              <FieldStub />
            </div>
          </FormSectionShell>

          {/* Primary contact — name (full), then email / phone (2-col @md) */}
          <FormSectionShell title="Primary contact">
            <FieldStub />
            <div className="grid gap-6 @md/section:grid-cols-2">
              <FieldStub />
              <FieldStub />
            </div>
          </FormSectionShell>

          {/* Address — line1, line2, then city/state/zip (3-col @md) */}
          <FormSectionShell title="Remit-to address">
            <FieldStub />
            <FieldStub />
            <div className="grid gap-6 @md/section:grid-cols-[2fr_1fr_1fr]">
              <FieldStub />
              <FieldStub />
              <FieldStub />
            </div>
          </FormSectionShell>

          {/* Payment & accounting — net days w/ inline legend, then tax id */}
          <FormSectionShell title="Payment & accounting">
            <div className="flex flex-col gap-2">
              <FieldStub />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
            <FieldStub />
          </FormSectionShell>

          {/* Notes — textarea */}
          <FormSectionShell title="Notes">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 sr-only" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-3 w-64" />
            </div>
          </FormSectionShell>
        </div>
      </CardContent>
      {/* FormActionFooter footprint */}
      <div className="flex items-center justify-end gap-2 border-t border-border-default px-6 py-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-32" />
      </div>
    </Card>
  );
}

function FormSectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="@container/section flex flex-col gap-4">
      <header>
        <Skeleton className="h-3 w-24" aria-label={title} />
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function FieldStub() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function SidePanelSkeleton() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:h-fit">
      <Card className="p-5 shadow-none">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-56" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-7 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5 shadow-none">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-11/12" />
      </Card>
    </aside>
  );
}
