import Link from "next/link";

/**
 * Shared chrome for admin detail pages — back link, eyebrow tag, title,
 * subtitle row, and an optional actions slot in the top-right. Keeps the
 * spacing + typography consistent across tenant detail, support detail,
 * and AI-usage drilldown so they read as siblings rather than separately
 * authored pages.
 */
export function AdminDetailHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Link
          href={backHref}
          className="text-sm font-medium text-forest hover:underline"
        >
          ← {backLabel}
        </Link>
        {eyebrow ? (
          <p className="text-sm font-medium text-forest">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
