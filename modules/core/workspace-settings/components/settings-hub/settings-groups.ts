export type SettingsGroupKey = "workspace" | "team" | "integrations" | "security" | "billing";

export type SettingsIconKey =
  | "home"
  | "layout-grid"
  | "ruler"
  | "users"
  | "shield"
  | "landmark"
  | "key"
  | "webhook"
  | "scroll-text"
  | "credit-card";

export type SettingsLeaf = {
  /** Sub-nav label. */
  label: string;
  /** Full URL. */
  href: string;
  /** Icon identifier — resolved to a component inside the client sub-nav. */
  icon: SettingsIconKey;
  /** Right-side badge — number (e.g. "1") or the literal "soon". */
  badge?: string;
  /** Reserved/coming-soon items still render as a link but the page itself is a stub. */
  soon?: boolean;
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
        { label: "API keys", href: "/settings/integrations/api-keys", icon: "key", badge: "soon", soon: true },
        { label: "Webhooks", href: "/settings/integrations/webhooks", icon: "webhook", badge: "soon", soon: true },
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
      visible: opts.canManageWorkspace,
      items: [
        {
          label: "Plan & usage",
          href: "/settings/billing/plan-and-usage",
          icon: "credit-card",
          badge: "soon",
          soon: true,
        },
      ],
    },
  ];
}
