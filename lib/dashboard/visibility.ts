/**
 * Role-aware visibility for the dashboard sections and top KPI cards.
 *
 * Pure functions with no runtime deps — safe to import from both server and
 * client code. See `docs/rules/permissions.md` for the broader permission
 * matrix; this file only governs what a user *sees*, not what they can do.
 */

import type { PortalUserRole } from "@/lib/auth/permissions";

export const DASHBOARD_SECTIONS = [
  "sales",
  "arAging",
  "purchasing",
  "apAging",
  "inventory",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export const DASHBOARD_METRIC_CARDS = [
  "sales7d",
  "sales30d",
  "purchases30d",
  "unpaidCustomerBalance",
  "unpaidSupplierBalance",
  "inventoryValue",
  "expiringLots",
  "expiredLots",
] as const;

export type DashboardMetricCard = (typeof DASHBOARD_METRIC_CARDS)[number];

type Visibility = {
  sections: ReadonlySet<DashboardSection>;
  cards: ReadonlySet<DashboardMetricCard>;
};

const ALL_SECTIONS: ReadonlySet<DashboardSection> = new Set(DASHBOARD_SECTIONS);
const ALL_CARDS: ReadonlySet<DashboardMetricCard> = new Set(
  DASHBOARD_METRIC_CARDS,
);

const ROLE_VISIBILITY: Record<PortalUserRole, Visibility> = {
  owner: { sections: ALL_SECTIONS, cards: ALL_CARDS },
  admin: { sections: ALL_SECTIONS, cards: ALL_CARDS },
  sales: {
    sections: new Set(["sales", "arAging", "inventory"]),
    cards: new Set([
      "sales7d",
      "sales30d",
      "unpaidCustomerBalance",
      "inventoryValue",
      "expiringLots",
      "expiredLots",
    ]),
  },
  warehouse: {
    sections: new Set(["purchasing", "inventory"]),
    cards: new Set([
      "purchases30d",
      "inventoryValue",
      "expiringLots",
      "expiredLots",
    ]),
  },
  accounting: {
    sections: new Set(["sales", "arAging", "purchasing", "apAging"]),
    cards: new Set([
      "sales30d",
      "purchases30d",
      "unpaidCustomerBalance",
      "unpaidSupplierBalance",
    ]),
  },
};

/**
 * Unknown / missing roles fall back to the smallest non-empty view: the
 * metric strip only. Sections stay hidden until an explicit role is known.
 */
const FALLBACK: Visibility = {
  sections: new Set<DashboardSection>(),
  cards: ALL_CARDS,
};

export function getDashboardVisibility(
  role: PortalUserRole | null | undefined,
): Visibility {
  if (!role) return FALLBACK;
  return ROLE_VISIBILITY[role] ?? FALLBACK;
}

export function isSectionVisible(
  role: PortalUserRole | null | undefined,
  section: DashboardSection,
): boolean {
  return getDashboardVisibility(role).sections.has(section);
}

export function isMetricVisible(
  role: PortalUserRole | null | undefined,
  card: DashboardMetricCard,
): boolean {
  return getDashboardVisibility(role).cards.has(card);
}
