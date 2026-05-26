/**
 * Public product changelog. Maintain by appending releases at the **top**
 * of `changelogReleases` (newest first).
 */

export type ChangelogSectionKind = "added" | "improved" | "fixed" | "security";

export type ChangelogSections = Partial<
  Record<ChangelogSectionKind, readonly string[]>
>;

export type ChangelogRelease = {
  /** Semantic version label (shown in UI). */
  version: string;
  /** Human-readable date window (e.g. month + year). */
  dateLabel: string;
  /** ISO date when the release was posted — drives "Apr 25" short labels. */
  postedAt: string;
  title: string;
  summary: string;
  sections: ChangelogSections;
};

/** Convert "2026.4.3" → "v2026-4-3" for safe anchor / CSS id use. */
export function changelogAnchorId(version: string): string {
  return `v${version.replace(/\./g, "-")}`;
}

/** Newest-first list of changelog entries. */
export const changelogReleases: readonly ChangelogRelease[] = [
  {
    version: "2026.4.3",
    dateLabel: "Apr 2026",
    postedAt: "2026-04-25",
    title: "Plan limits & usage visibility",
    summary:
      "Surface subscription allowances and workspace usage side by side—so admins can see entitlement at a glance and plan capacity before hitting hard limits.",
    sections: {
      added: [
        "Usage summaries that reflect plan limits across key workspaces capabilities where metering applies.",
        "Clear labeling when tenants approach or exceed configured quotas for gated features.",
      ],
      improved: [
        "Account and billing surfaces that tie Stripe subscription status to what users see inside the ERP shell.",
      ],
    },
  },
  {
    version: "2026.4.2",
    dateLabel: "Apr 2026",
    postedAt: "2026-04-10",
    title: "Billing UI redesign",
    summary:
      "Refined tenant billing surfaces for Stripe-backed subscriptions: clearer plan context, tighter layout, and a more approachable path to subscription management.",
    sections: {
      improved: [
        "Billing dashboard cards and typography aligned with Fluxora shell patterns.",
        "Smoother handoff cues toward Stripe-hosted Customer Portal flows where checkout is wired.",
      ],
      fixed: [
        "Visual inconsistencies between subscription status badges and Stripe-driven lifecycle transitions.",
      ],
    },
  },
  {
    version: "2026.3.5",
    dateLabel: "Mar 2026",
    postedAt: "2026-03-22",
    title: "CRUD & edit workflows",
    summary:
      "Broadened parity across core ERP objects—create, read, update patterns on detail screens with disciplined validation schemas behind the scenes.",
    sections: {
      added: [
        "Dedicated edit entry points across major modules (customers, products, purchases, ops) where rollout is complete.",
        "Guardrails on form submission that match server actions and shared Zod contracts.",
      ],
      improved: [
        "Detail-to-edit navigation patterns for faster day-to-day corrections without leaving context.",
      ],
    },
  },
  {
    version: "2026.3.1",
    dateLabel: "Mar 2026",
    postedAt: "2026-03-05",
    title: "Email-only auth & onboarding",
    summary:
      "Passwordless sign-up and sign-in with magic links, optional Google SSO, and a post-authentication path to collect profile and first workspace details.",
    sections: {
      added: [
        "Root sign-up that requests email only; profile and workspace creation land on guided onboarding after verification.",
        "Self-serve workspace bootstrap with tenant slug selection and owner portal provisioning.",
      ],
      improved: [
        "Destination routing for accounts with multiple memberships vs. net-new tenant flows.",
      ],
      security: [
        "Session-scoped tenant selection and magic-link expiration aligned with hosted auth best practices.",
      ],
    },
  },
  {
    version: "2026.2.2",
    dateLabel: "Feb 2026",
    postedAt: "2026-02-14",
    title: "Billing & subscription system",
    summary:
      "Stripe-powered subscriptions for tenant plans: customer records, webhook-driven status, and subscription blocking surfaces when invoices fail.",
    sections: {
      added: [
        "Stripe Customer and Subscription linkage stored per tenant for ERP billing reconciliation.",
        "Webhook ingestion path for Stripe events powering subscription lifecycle in-app.",
      ],
      fixed: [
        "Edge cases during trial-to-paid transitions that could briefly desync entitlement flags.",
      ],
      security: [
        "Idempotent Stripe webhook handling and audit-friendly persistence for billing reliability.",
      ],
    },
  },
  {
    version: "2026.1.0",
    dateLabel: "Jan 2026",
    postedAt: "2026-01-20",
    title: "V1 launch preparation",
    summary:
      "Foundational Fluxora SaaS scaffolding: tenant routing, ERP modules for distributors, and hardened patterns for CRUD lists, dashboards, and support touchpoints.",
    sections: {
      added: [
        "Multi-tenant host resolution (root vs. workspace subdomains) with shared Better Auth plumbing.",
        "Core ERP areas: dashboard metrics, CRM-style customers, products & inventory primitives, purchasing and AR/AP flows as modules mature.",
      ],
      improved: [
        "Application shell navigation, breadcrumbs, and design tokens aligned across tenant experiences.",
      ],
    },
  },
] satisfies readonly ChangelogRelease[];
