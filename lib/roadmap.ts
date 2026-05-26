/**
 * Roadmap teaser shown at the bottom of the public changelog.
 * Not a promise — order and dates may shift. Keep dates as quarter/version labels.
 */

export type RoadmapStatus = "in review" | "drafted" | "planned";

export type RoadmapItem = {
  /** Quarter or target version label, e.g. "2026.5" */
  quarter: string;
  description: string;
  status: RoadmapStatus;
};

export const roadmapItems: readonly RoadmapItem[] = [
  {
    quarter: "2026.5",
    description:
      "Catch-weight invoicing variance reports and per-customer rounding policy.",
    status: "in review",
  },
  {
    quarter: "2026.5",
    description:
      "PDF supplier-bill import: bulk approve and rejection reasons surfaced inline.",
    status: "in review",
  },
  {
    quarter: "2026.6",
    description:
      "QuickBooks Online & Xero general-ledger sync (Growth and Scale plans).",
    status: "drafted",
  },
  {
    quarter: "2026.6",
    description: "Custom workspace domains: orders.your-company.com.",
    status: "drafted",
  },
] satisfies readonly RoadmapItem[];
