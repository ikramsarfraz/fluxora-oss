export type SettingsGroupKey =
  | "account"
  | "workspace"
  | "team"
  | "integrations"
  | "security"
  | "billing";

export type SettingsIconKey =
  | "home"
  | "layout-grid"
  | "ruler"
  | "users"
  | "shield"
  | "landmark"
  | "scroll-text"
  | "user"
  | "credit-card";

export type SettingsLeaf = {
  /** Sub-nav label. */
  label: string;
  /** Full URL. */
  href: string;
  /** Icon identifier — resolved to a component inside the client sub-nav. */
  icon: SettingsIconKey;
  /** Right-side badge — e.g. a count like "3". */
  badge?: string;
};

export type SettingsGroup = {
  key: SettingsGroupKey;
  label: string;
  /** When false (member role), the group is hidden + each leaf renders a 403. */
  visible: boolean;
  items: SettingsLeaf[];
};

export function buildSettingsGroups(opts: {
  /** Owner+admin gets every group; everyone else sees Workspace only. */
  canManageWorkspace: boolean;
  pendingInviteCount?: number;
  connectedBankCount?: number;
}): SettingsGroup[] {
  return [
    {
      key: "account",
      label: "Account",
      // Every user can manage their own profile; gating is per-page.
      visible: true,
      items: [
        { label: "Profile", href: "/settings/account/profile", icon: "user" },
      ],
    },
    {
      key: "workspace",
      label: "Workspace",
      visible: true,
      items: [
        { label: "General", href: "/settings/workspace/general", icon: "home" },
        { label: "Categories", href: "/settings/workspace/categories", icon: "layout-grid" },
        { label: "Units of Measure", href: "/settings/workspace/units-of-measure", icon: "ruler" },
      ],
    },
    {
      key: "team",
      label: "Team",
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Members",
          href: "/settings/team/members",
          icon: "users",
          badge:
            opts.pendingInviteCount && opts.pendingInviteCount > 0
              ? String(opts.pendingInviteCount)
              : undefined,
        },
        { label: "Roles & Permissions", href: "/settings/team/roles", icon: "shield" },
        { label: "Single Sign-On", href: "/settings/team/sso", icon: "shield" },
      ],
    },
    {
      key: "integrations",
      label: "Integrations",
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Banks",
          href: "/settings/integrations/banks",
          icon: "landmark",
          badge:
            opts.connectedBankCount && opts.connectedBankCount > 0
              ? String(opts.connectedBankCount)
              : undefined,
        },
      ],
    },
    {
      key: "security",
      label: "Security",
      visible: opts.canManageWorkspace,
      items: [
        { label: "Activity log", href: "/settings/security/activity-log", icon: "scroll-text" },
      ],
    },
    {
      key: "billing",
      label: "Billing",
      // Billing pages render for any signed-in user; management actions
      // (subscribe / customer portal) are gated to owner/admin inside the
      // page itself. Blocked tenants reach this via the exempt list in
      // lib/tenant-subscription-health.ts.
      visible: true,
      items: [
        {
          label: "Plan & usage",
          href: "/settings/billing/plan-and-usage",
          icon: "credit-card",
        },
      ],
    },
  ];
}
