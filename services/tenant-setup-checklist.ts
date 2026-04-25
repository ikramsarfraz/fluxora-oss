import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  customers,
  portalUsers,
  products,
  salesOrders,
  supplierInvoices,
  suppliers,
  tenantBranding,
  tenants,
  userInvitations,
} from "@/db/schema";
import { getCurrentTenant } from "@/services/tenants";
import { getCurrentPortalUser } from "@/services/portal-users";

export const SETUP_CHECKLIST_ITEM_IDS = [
  "branding",
  "invite_team",
  "catalog",
  "suppliers",
  "customers",
  "supplier_invoice",
  "sales_order",
] as const;

export type SetupChecklistItemId = (typeof SETUP_CHECKLIST_ITEM_IDS)[number];

export const SETUP_CHECKLIST_STATIC: ReadonlyArray<{
  id: SetupChecklistItemId;
  label: string;
  href: string;
}> = [
  { id: "branding", label: "Add company branding", href: "/tenant-admin/branding" },
  { id: "invite_team", label: "Invite team members", href: "/users/new" },
  { id: "catalog", label: "Create products or categories", href: "/categories" },
  { id: "suppliers", label: "Add suppliers", href: "/suppliers/new" },
  { id: "customers", label: "Add customers", href: "/customers/new" },
  {
    id: "supplier_invoice",
    label: "Create a supplier invoice",
    href: "/supplier-invoices/new",
  },
  { id: "sales_order", label: "Create a sales order", href: "/orders/new" },
];

type ProgressFlags = Record<SetupChecklistItemId, boolean>;

function isBrandingSatisfied(brand: typeof tenantBranding.$inferSelect | null) {
  if (!brand) {
    return false;
  }
  if (brand.logoFileId) {
    return true;
  }
  if (brand.displayName?.trim()) {
    return true;
  }
  if (brand.companyLegalName?.trim()) {
    return true;
  }
  return false;
}

export async function computeSetupChecklistProgress(
  tenantId: string,
): Promise<ProgressFlags> {
  const [
    brandingRow,
    memberCount,
    pendingOrAcceptedInvites,
    categoryCount,
    productCount,
    supplierCount,
    customerCount,
    supplierInvoiceCount,
    salesOrderCount,
  ] = await Promise.all([
    db.query.tenantBranding.findFirst({
      where: eq(tenantBranding.tenantId, tenantId),
    }),
    db
      .select({ c: count() })
      .from(portalUsers)
      .where(
        and(
          eq(portalUsers.tenantId, tenantId),
          eq(portalUsers.isActive, true),
        ),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.tenantId, tenantId),
          inArray(userInvitations.status, ["pending", "accepted"]),
        ),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(categories)
      .where(
        and(
          eq(categories.tenantId, tenantId),
          eq(categories.isActive, true),
          isNull(categories.archivedAt),
        ),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(products)
      .where(
        and(eq(products.tenantId, tenantId), isNull(products.archivedAt)),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(suppliers)
      .where(
        and(eq(suppliers.tenantId, tenantId), isNull(suppliers.archivedAt)),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(customers)
      .where(
        and(eq(customers.tenantId, tenantId), isNull(customers.archivedAt)),
      )
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.tenantId, tenantId))
      .then(r => r[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(salesOrders)
      .where(eq(salesOrders.tenantId, tenantId))
      .then(r => r[0]?.c ?? 0),
  ]);

  const inviteTeamDone =
    memberCount >= 2 || pendingOrAcceptedInvites > 0;
  const catalogDone = (categoryCount > 0 || productCount > 0);

  return {
    branding: isBrandingSatisfied(brandingRow ?? null),
    invite_team: inviteTeamDone,
    catalog: catalogDone,
    suppliers: supplierCount > 0,
    customers: customerCount > 0,
    supplier_invoice: supplierInvoiceCount > 0,
    sales_order: salesOrderCount > 0,
  };
}

export type TenantSetupChecklistView =
  | { visible: false; reason: "not_privileged" | "dismissed" | "complete" }
  | {
      visible: true;
      completedCount: number;
      total: number;
      items: Array<{
        id: SetupChecklistItemId;
        label: string;
        href: string;
        done: boolean;
      }>;
    };

const MANAGER_ROLES = new Set(["admin", "owner", "sales"]);

/**
 * Data for the dashboard progress card. Non-managers, dismissed tenants, or
 * fully complete checklists return `visible: false`.
 */
export async function getTenantSetupChecklistView(): Promise<TenantSetupChecklistView> {
  const current = await getCurrentPortalUser();
  if (!MANAGER_ROLES.has(current.role)) {
    return { visible: false, reason: "not_privileged" };
  }

  const tenant = await getCurrentTenant();
  if (tenant.setupChecklistDismissedAt) {
    return { visible: false, reason: "dismissed" };
  }

  const progress = await computeSetupChecklistProgress(tenant.id);
  const items = SETUP_CHECKLIST_STATIC.map(def => ({
    id: def.id,
    label: def.label,
    href: def.href,
    done: progress[def.id],
  }));
  const completedCount = items.filter(i => i.done).length;
  const total = items.length;

  if (completedCount === total) {
    return { visible: false, reason: "complete" };
  }

  return { visible: true, completedCount, total, items };
}

export async function dismissTenantSetupChecklist(): Promise<void> {
  const current = await getCurrentPortalUser();
  if (current.role !== "admin" && current.role !== "owner") {
    throw new Error("Only admins can update the setup checklist.");
  }
  const tenant = await getCurrentTenant();
  await db
    .update(tenants)
    .set({ setupChecklistDismissedAt: new Date() })
    .where(eq(tenants.id, tenant.id));
}
