/**
 * Placeholder body for reserved settings pages (API keys, Webhooks, Plan & usage).
 * Their presence in the sub-nav is intentional — it signals where these capabilities
 * will live once they ship. The card just makes the timing honest.
 */
export function ComingSoonCard({ description }: { description: string }) {
  return (
    <div className="rounded-[10px] border border-stone-line bg-stone-surface p-6 text-[13px] text-stone-ink2">
      <div className="mb-2 inline-flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-primary">
          Coming soon
        </span>
      </div>
      <p className="text-stone-muted">{description}</p>
    </div>
  );
}
