/**
 * Role-based permission matrix for the sales order flow.
 *
 * Permissions layer on top of workflow-state gating (see `order-action-rules.ts`).
 * An action is allowed only when BOTH the workflow state and the user role allow it.
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

/**
 * Role → permission matrix. Owner/admin get everything; the other roles
 * get a scoped subset matching the common ERP function-split:
 *
 * - sales: quote + confirm an order
 * - warehouse: fulfillment + short-ship + reverse fulfillment
 * - accounting: invoicing + payments
 */
const ROLE_PERMISSIONS: Record<PortalUserRole, readonly OrderPermission[]> = {
  owner: [...ORDER_PERMISSIONS],
  admin: [...ORDER_PERMISSIONS],
  sales: ["edit_order", "confirm_order"],
  warehouse: ["fulfill_order", "short_ship_order", "reverse_fulfillment"],
  accounting: ["generate_invoice", "record_payment"],
};

const PERMISSION_DENIED_REASONS: Record<OrderPermission, string> = {
  edit_order: "Your role does not allow editing sales orders.",
  confirm_order: "Your role does not allow confirming sales orders.",
  fulfill_order: "Your role does not allow recording fulfillment.",
  short_ship_order: "Your role does not allow closing lines short.",
  reverse_fulfillment: "Your role does not allow reversing fulfillment.",
  generate_invoice: "Your role does not allow generating invoices.",
  record_payment: "Your role does not allow recording payments.",
};

/**
 * Returns `true` if the given role is allowed to perform the permission.
 * Missing role → always denied (fail closed).
 */
export function can(
  role: PortalUserRole | null | undefined,
  permission: OrderPermission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Human-readable reason string suitable for UI `title`/helper text when a
 * user is blocked by role (not workflow state).
 */
export function getPermissionDeniedReason(permission: OrderPermission): string {
  return PERMISSION_DENIED_REASONS[permission];
}

/**
 * Server-side guard. Throws a `Forbidden` error when the role is missing
 * the permission. Call early in mutating service functions to provide a
 * defense-in-depth check that matches the client-side gating.
 */
export function requirePermission(
  role: PortalUserRole | null | undefined,
  permission: OrderPermission,
): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: ${getPermissionDeniedReason(permission)}`);
  }
}
