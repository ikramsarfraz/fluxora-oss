/**
 * Maps each role's flat permission list (see `permissions.ts`) onto the
 * 4-state level model the v2 Roles & Permissions UI uses.
 *
 * Levels: None < View < Edit < Full.
 *
 * Today's data model is a fixed 5-role enum with hand-coded flat permission
 * arrays. The redesign envisions per-tenant custom roles with arbitrary
 * (resource → level) mappings. This file is the bridge: it derives the new
 * shape from the existing data so the new UI can render without a schema
 * change. When the proper schema lands, callers swap to reading directly
 * from `role_permissions` and this file becomes the seed for migrating
 * the five system roles into the new table.
 *
 * Safe to import from server and client code — pure data, no runtime deps.
 */

import {
  ROLE_DESCRIPTIONS,
  ROLE_ORDER,
  permissionsForRole,
  type PortalUserRole,
} from "./permissions";

export type PermissionLevel = "none" | "view" | "edit" | "full";

export const PERMISSION_LEVEL_ORDER: readonly PermissionLevel[] = [
  "none",
  "view",
  "edit",
  "full",
];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "None",
  view: "View",
  edit: "Edit",
  full: "Full",
};

export const PERMISSION_LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  none: "Can't see it",
  view: "Read-only",
  edit: "Create & update",
  full: "Includes delete & destructive actions",
};

/** Stable identifiers for each resource in the new UI. */
export type ResourceKey =
  | "orders"
  | "customers"
  | "invoices"
  | "prices"
  | "bills"
  | "suppliers"
  | "supplier_payments"
  | "bank_feed"
  | "expenses"
  | "catalog";

export type WorkspaceFlag =
  | "manage_members_roles"
  | "manage_workspace_settings"
  | "view_activity_log"
  | "manage_integrations"
  | "export_data"
  | "permanent_delete";

export type PermissionGroupKey = "sales" | "purchasing" | "finance" | "catalog" | "workspace";

export const PERMISSION_GROUPS: readonly {
  key: PermissionGroupKey;
  label: string;
  resources: readonly { key: ResourceKey; label: string; description: string }[];
}[] = [
  {
    key: "sales",
    label: "Sales",
    resources: [
      { key: "orders", label: "Orders", description: "Sales orders, quotes, fulfillments." },
      { key: "customers", label: "Customers", description: "Customer records and contacts." },
      { key: "invoices", label: "Invoices", description: "Issue, edit, and void customer invoices." },
      { key: "prices", label: "Prices", description: "Per-customer and per-supplier pricing." },
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    resources: [
      { key: "bills", label: "Bills", description: "Supplier bills; AP entries." },
      { key: "suppliers", label: "Suppliers", description: "Vendor records and contacts." },
      { key: "supplier_payments", label: "Payments", description: "Record outgoing payments against bills." },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    resources: [
      { key: "bank_feed", label: "Bank feed", description: "Transactions from connected banks." },
      { key: "expenses", label: "Expenses", description: "Categorise spend, attach receipts." },
    ],
  },
  {
    key: "catalog",
    label: "Catalog",
    resources: [
      {
        key: "catalog",
        label: "Products, Inventory, Lots",
        description: "Catalog records and warehouse stock state.",
      },
    ],
  },
];

export const WORKSPACE_FLAG_LABELS: Record<WorkspaceFlag, { label: string; description: string }> = {
  manage_members_roles: {
    label: "Manage members & roles",
    description: "Invite, remove, change role assignments.",
  },
  manage_workspace_settings: {
    label: "Manage workspace settings",
    description: "Branding, categories, units of measure.",
  },
  view_activity_log: {
    label: "View activity log",
    description: "Forensic event history.",
  },
  manage_integrations: {
    label: "Manage integrations",
    description: "Connect / disconnect banks & APIs.",
  },
  export_data: {
    label: "Export data",
    description: "CSV export from any list view.",
  },
  permanent_delete: {
    label: "Permanent delete",
    description: "Bypass soft-delete on destructive actions.",
  },
};

export const WORKSPACE_FLAG_ORDER: readonly WorkspaceFlag[] = [
  "manage_members_roles",
  "manage_workspace_settings",
  "view_activity_log",
  "manage_integrations",
  "export_data",
  "permanent_delete",
];

export type RoleLevels = {
  resources: Record<ResourceKey, PermissionLevel>;
  flags: Record<WorkspaceFlag, boolean>;
};

const ADMIN_FULL: RoleLevels = {
  resources: {
    orders: "full",
    customers: "full",
    invoices: "full",
    prices: "full",
    bills: "full",
    suppliers: "full",
    supplier_payments: "full",
    bank_feed: "view",
    expenses: "full",
    catalog: "full",
  },
  flags: {
    manage_members_roles: true,
    manage_workspace_settings: true,
    view_activity_log: true,
    manage_integrations: true,
    export_data: true,
    permanent_delete: true,
  },
};

/**
 * Derive the 4-state level matrix from the role's flat permission list.
 *
 * The mapping is intentionally generous: when a resource has no
 * corresponding flat permission today (e.g. "Customers" — there's no
 * `edit_customer` permission), we infer the level from the role's overall
 * scope rather than collapsing to `none`. This keeps the new UI honest:
 * the levels shown reflect what users actually experience today, not the
 * narrow set of flat permission strings that happen to exist.
 */
export function deriveRoleLevels(role: PortalUserRole): RoleLevels {
  if (role === "owner" || role === "admin") return ADMIN_FULL;

  const flat = new Set(permissionsForRole(role));

  // Sales — orders maps to the 5 order verbs.
  let orders: PermissionLevel = "none";
  const hasFulfillment =
    flat.has("fulfill_order") ||
    flat.has("short_ship_order") ||
    flat.has("reverse_fulfillment");
  if (flat.has("edit_order") && flat.has("confirm_order") && hasFulfillment) {
    orders = "full";
  } else if (flat.has("edit_order") || flat.has("confirm_order") || hasFulfillment) {
    orders = "edit";
  }

  // Bills — view/edit/full from supplier-invoice perms.
  let bills: PermissionLevel = "none";
  const hasDestructiveSi =
    flat.has("complete_supplier_invoice") ||
    flat.has("reverse_supplier_receipt") ||
    flat.has("delete_supplier_invoice");
  if (flat.has("edit_supplier_invoice") && hasDestructiveSi) {
    bills = "full";
  } else if (flat.has("edit_supplier_invoice")) {
    bills = "edit";
  } else if (flat.has("view_supplier_invoice")) {
    bills = "view";
  }

  // Invoices — single perm: generate_invoice.
  const invoices: PermissionLevel = flat.has("generate_invoice") ? "edit" : "none";

  // Customer payments → invoices group; supplier payments → purchasing group.
  const supplierPayments: PermissionLevel = flat.has("record_supplier_payment") ? "edit" : "none";

  // The remaining resources have no flat permission today. Derive from role identity.
  const isSales = role === "sales";
  const isWarehouse = role === "warehouse";
  const isAccounting = role === "accounting";

  const customers: PermissionLevel = isSales ? "edit" : isAccounting ? "view" : isWarehouse ? "view" : "none";
  const prices: PermissionLevel = isSales || isAccounting ? "view" : "none";
  const suppliers: PermissionLevel = isWarehouse || isAccounting ? "view" : "none";
  const bankFeed: PermissionLevel = isAccounting ? "view" : "none";
  const expenses: PermissionLevel = isAccounting ? "edit" : "none";
  const catalog: PermissionLevel = "view"; // everyone today can read the catalog

  return {
    resources: {
      orders,
      customers,
      invoices,
      prices,
      bills,
      suppliers,
      supplier_payments: supplierPayments,
      bank_feed: bankFeed,
      expenses,
      catalog,
    },
    flags: {
      // Today's `requireAdminPortalUser` gates these for non-owner/admin.
      manage_members_roles: false,
      manage_workspace_settings: false,
      view_activity_log: false,
      manage_integrations: false,
      // Export from list views is unrestricted today.
      export_data: true,
      permanent_delete: false,
    },
  };
}

/**
 * Short one-line summary of what a role can do, derived from its levels.
 * Used as the secondary line under each role in the list rail.
 */
export function summariseRole(role: PortalUserRole, levels: RoleLevels): string {
  if (role === "owner" || role === "admin") return "Full access";
  const fullCount = Object.values(levels.resources).filter(l => l === "full").length;
  const editCount = Object.values(levels.resources).filter(l => l === "edit").length;
  if (fullCount > 0) return `Full on ${fullCount}, edit on ${editCount}`;
  if (editCount > 0) return `Edit on ${editCount}`;
  return "Read-only";
}

export { ROLE_ORDER, ROLE_DESCRIPTIONS };
