/**
 * Role-based permission matrix for the sales order + supplier invoice flows.
 *
 * Permissions layer on top of workflow-state gating (see
 * `order-action-rules.ts` for sales and the ad-hoc `isDraft` / `canReverse` /
 * `canRecordPayment` derivations in `supplier-invoice-detail-page.tsx`). An
 * action is allowed only when BOTH the workflow state and the user role
 * allow it.
 *
 * Human-readable matrix + enforcement map: `docs/rules/permissions.md`.
 *
 * Safe to import from both server and client code — pure functions, no runtime deps.
 */

/**
 * Portal role union. Mirrors the `user_role` enum in `db/schema.ts` and the
 * `PortalUserRole` type exported from `services/portal-users.ts`.
 */
export type PortalUserRole =
  | "owner"
  | "admin"
  | "sales"
  | "warehouse"
  | "accounting";

export const ORDER_PERMISSIONS = [
  "edit_order",
  "confirm_order",
  "fulfill_order",
  "short_ship_order",
  "reverse_fulfillment",
  "generate_invoice",
  "record_payment",
] as const;

export type OrderPermission = (typeof ORDER_PERMISSIONS)[number];

export const SUPPLIER_PERMISSIONS = [
  "view_supplier_invoice",
  "edit_supplier_invoice",
  "complete_supplier_invoice",
  "reverse_supplier_receipt",
  "record_supplier_payment",
  "delete_supplier_invoice",
] as const;

export type SupplierPermission = (typeof SUPPLIER_PERMISSIONS)[number];

export type Permission = OrderPermission | SupplierPermission;

/**
 * Role → permission matrix. Owner/admin get everything; the other roles
 * get a scoped subset matching the common ERP function-split:
 *
 * Sales order flow:
 * - sales: quote + confirm an order
 * - warehouse: fulfillment + short-ship + reverse fulfillment
 * - accounting: invoicing + payments
 *
 * Supplier invoice / receiving flow:
 * - warehouse: view, edit drafts, complete receipts, reverse receipts, delete drafts
 * - accounting: view, edit drafts, delete drafts, record supplier payments
 * - sales: no supplier invoice access (no view)
 */
const ROLE_PERMISSIONS: Record<PortalUserRole, readonly Permission[]> = {
  owner: [...ORDER_PERMISSIONS, ...SUPPLIER_PERMISSIONS],
  admin: [...ORDER_PERMISSIONS, ...SUPPLIER_PERMISSIONS],
  sales: ["edit_order", "confirm_order"],
  warehouse: [
    "fulfill_order",
    "short_ship_order",
    "reverse_fulfillment",
    "view_supplier_invoice",
    "edit_supplier_invoice",
    "complete_supplier_invoice",
    "reverse_supplier_receipt",
    "delete_supplier_invoice",
  ],
  accounting: [
    "generate_invoice",
    "record_payment",
    "view_supplier_invoice",
    "edit_supplier_invoice",
    "delete_supplier_invoice",
    "record_supplier_payment",
  ],
};

const PERMISSION_DENIED_REASONS: Record<Permission, string> = {
  edit_order: "Your role does not allow editing sales orders.",
  confirm_order: "Your role does not allow confirming sales orders.",
  fulfill_order: "Your role does not allow recording fulfillment.",
  short_ship_order: "Your role does not allow closing lines short.",
  reverse_fulfillment: "Your role does not allow reversing fulfillment.",
  generate_invoice: "Your role does not allow generating invoices.",
  record_payment: "Your role does not allow recording payments.",
  view_supplier_invoice:
    "Your role does not allow viewing supplier invoices.",
  edit_supplier_invoice:
    "Your role does not allow editing supplier invoices.",
  complete_supplier_invoice:
    "Your role does not allow completing supplier receipts.",
  reverse_supplier_receipt:
    "Your role does not allow reversing supplier receipts.",
  record_supplier_payment:
    "Your role does not allow recording supplier payments.",
  delete_supplier_invoice:
    "Your role does not allow deleting supplier invoices.",
};

/**
 * Returns `true` if the given role is allowed to perform the permission.
 * Missing role → always denied (fail closed).
 */
export function can(
  role: PortalUserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Human-readable reason string suitable for UI `title`/helper text when a
 * user is blocked by role (not workflow state).
 */
export function getPermissionDeniedReason(permission: Permission): string {
  return PERMISSION_DENIED_REASONS[permission];
}

/**
 * Server-side guard. Throws a `Forbidden` error when the role is missing
 * the permission. Call early in mutating service functions to provide a
 * defense-in-depth check that matches the client-side gating.
 */
export function requirePermission(
  role: PortalUserRole | null | undefined,
  permission: Permission,
): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: ${getPermissionDeniedReason(permission)}`);
  }
}

/* -------------------------------------------------------------------------- */
/* UI-facing metadata for the role / permission matrix                         */
/* -------------------------------------------------------------------------- */

export const PERMISSION_LABELS: Record<Permission, string> = {
  edit_order: "Edit sales orders",
  confirm_order: "Confirm sales orders",
  fulfill_order: "Record fulfillment",
  short_ship_order: "Close lines short",
  reverse_fulfillment: "Reverse fulfillment",
  generate_invoice: "Generate invoices",
  record_payment: "Record customer payments",
  view_supplier_invoice: "View supplier invoices",
  edit_supplier_invoice: "Edit draft supplier invoices",
  complete_supplier_invoice: "Complete supplier receipts",
  reverse_supplier_receipt: "Reverse supplier receipts",
  record_supplier_payment: "Record supplier payments",
  delete_supplier_invoice: "Delete draft supplier invoices",
};

export const ROLE_DESCRIPTIONS: Record<PortalUserRole, string> = {
  owner: "Full access to every area of the ERP.",
  admin: "Full access to every area of the ERP.",
  sales:
    "Sells to customers: quote, create, and confirm sales orders.",
  warehouse:
    "Runs the warehouse: fulfillment, short-ships, and receiving.",
  accounting:
    "Handles the books: invoicing, payments, and supplier invoices.",
};

export const ROLE_ORDER: readonly PortalUserRole[] = [
  "owner",
  "admin",
  "sales",
  "warehouse",
  "accounting",
];

/** All permissions in display order. */
export const ALL_PERMISSIONS: readonly Permission[] = [
  ...ORDER_PERMISSIONS,
  ...SUPPLIER_PERMISSIONS,
];

/** Returns the full permission list for a role, or `[]` if role is unknown. */
export function permissionsForRole(
  role: PortalUserRole | null | undefined,
): readonly Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
