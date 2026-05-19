import type { ReactNode } from "react";

/**
 * Per-page header used inside the settings hub panel.
 * - Title 22px / 600 / letter-spacing -0.02em.
 * - Subtitle 13px muted, max-width 520px.
 * - Bottom rule: 1px line + 20px padding + 24px margin (matches the design tokens).
 */
export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border-default pb-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[520px] text-[13px] text-subtle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
