# Permissions matrix

Role-based access control for the sales order flow. Permissions layer **on top
of** workflow-state gating (see `app/(app)/orders/components/order-action-rules.ts`):
an action is allowed only when **both** the workflow state and the user role
allow it.

Source of truth in code: [`lib/auth/permissions.ts`](../../lib/auth/permissions.ts).

## Roles

Mirrors the `user_role` enum in `db/schema.ts` and `PortalUserRole` in
`services/portal-users.ts`.

| Role | Intent |
|---|---|
| `owner` | Tenant owner. Full access. |
| `admin` | Tenant admin. Full access. |
| `sales` | Creates and confirms sales orders. |
| `warehouse` | Picks, fulfills, short-ships, and reverses fulfillment. |
| `accounting` | Invoices and records payments. |

## Sales order permissions

| Permission | `owner` | `admin` | `sales` | `warehouse` | `accounting` |
|---|:-:|:-:|:-:|:-:|:-:|
| `edit_order` | yes | yes | yes | no | no |
| `confirm_order` | yes | yes | yes | no | no |
| `fulfill_order` | yes | yes | no | yes | no |
| `short_ship_order` | yes | yes | no | yes | no |
| `reverse_fulfillment` | yes | yes | no | yes | no |
| `generate_invoice` | yes | yes | no | no | yes |
| `record_payment` | yes | yes | no | no | yes |

## Where each permission is enforced

Permissions are enforced in **two places** for defense-in-depth. The client-side
check drives disabled state and helper text; the server-side check is the
authority and fails with a `Forbidden: <reason>` error.

| Permission | Client (UI gate) | Server (service guard) |
|---|---|---|
| `edit_order` | `OrderHeader` Edit button · `OrderEditForm` lock screen | `createSalesOrder`, `updateSalesOrder`, `updateSalesOrderNotes`, `deleteSalesOrder` in `services/orders.ts` |
| `confirm_order` | `OrderHeader` primary "Confirm order" button | `updateSalesOrderStatus` in `services/orders.ts` |
| `fulfill_order` | `OrderHeader` primary "Start fulfillment" button · "Record fulfillment" in `OrderFulfillmentSection` · submit in `OrderFulfillmentEntryDialog` | `recordSalesOrderFulfillment` in `services/orders.ts` |
| `short_ship_order` | "Short ship" button in `OrderFulfillmentEntryDialog` | `markSalesOrderLineShortShipped` in `services/orders.ts` |
| `reverse_fulfillment` | Per-row "Reverse" in `OrderFulfillmentSection` · submit in `OrderFulfillmentReversalDialog` | `reverseSalesOrderFulfillment` in `services/orders.ts` |
| `generate_invoice` | `OrderHeader` primary "Generate invoice" button · "Generate invoice" in `OrderFinancialSummary` | `generateInvoiceForSalesOrder` in `services/invoicing.ts` |
| `record_payment` | `OrderHeader` primary "Record payment" button · submit in `OrderPaymentEntryDialog` | `recordPaymentForSalesOrderInvoice` in `services/invoicing.ts` |

### Reused permission mappings

Some actions do not get their own dedicated permission; they reuse one of the
permissions above. The behavior and enforcement points are listed here for
completeness.

| Action | Permission reused | Client (UI gate) | Server (service guard) |
|---|---|---|---|
| Manage allocations (add / remove inventory allocations on a line) | `fulfill_order` | `OrderAllocationEditorDialog` Add / Remove buttons · restriction alert | `allocateInventoryToSalesOrderLine`, `addInventoryAllocationToSalesOrderLine`, `removeSalesOrderLineAllocation` in `services/orders.ts` |
| Cancel order | `edit_order` | `OrderHeader` "Cancel order" menu item · confirm dialog in `OrderDetailPage` | `cancelSalesOrder` in `services/orders.ts` (writes a `sales_orders` audit-log row with the status transition) |

Rationale:

- **Allocations → `fulfill_order`**: allocation is fulfillment prep. Anyone who
  can record fulfillment also needs to shape the inventory that feeds it.
  Introducing a separate `manage_allocations` permission was not justified —
  the warehouse role is the natural owner of both actions.
- **Cancel → `edit_order`**: cancellation is a destructive edit. Keeping it on
  `edit_order` keeps the permission surface small and aligns roles that can
  create / mutate an order with the role that can cancel it.

## Layering with workflow state

The helper `getOrderActionAvailability(order, role)` returns one `canXxx` flag
and one `xxxReason` string per action. The reason is resolved in this order:

1. **Workflow-state reason** — e.g. _"Cancelled orders are locked."_,
   _"An invoice has already been generated."_ If present, this is shown and
   the permission check is not consulted.
2. **Permission-denied reason** — e.g. _"Your role does not allow recording
   payments."_ Surfaced only when the workflow allows the action but the role
   does not.
3. **`null`** — action is allowed; button renders enabled.

Workflow rules are intentionally unchanged by this layering; a warehouse user
still cannot record fulfillment on a cancelled order, and an accounting user
still cannot generate an invoice until every line is closed.

## Known gaps

- **Cancel is all-or-nothing once fulfillment starts.** `cancelSalesOrder`
  refuses to cancel when any line has fulfilled cases, an active (non-reversed)
  fulfillment, or a short-ship marker. Those orders must first be reversed via
  the fulfillment reversal flow. An alternative design that auto-reverses and
  cancels in one step is intentionally out of scope — reversal has its own
  permission (`reverse_fulfillment`) and its own audit trail, and combining
  them would hide the reversal in the cancel history.
- **No undo / reopen flow.** Once an order is `cancelled` there is no
  server-side path back to `sales_order` or `confirmed`. If a user cancels by
  mistake, the remediation today is to create a new order. Adding reopen
  would need its own permission decision and its own timeline entry.
- **Read access / row visibility is not role-gated.** Any authenticated portal
  user in the tenant can still read orders, invoices, payments, and allocation
  editor data (`getSalesOrderLineAllocationEditor`). Only mutation actions are
  gated. If sales / warehouse / accounting should have narrower read scopes,
  that is a separate, larger change (list-level filters + detail guards) and
  is intentionally out of scope for the current permission model.
- **Allocation snapshot / reconciliation side-effects.** The permission check
  fires on the public service entrypoints. Internal reconciliation helpers
  called downstream (e.g. `reconcileSalesOrderLineAllocations`) assume the
  caller has already been authorized. Keep this invariant if adding new
  entrypoints.

## Changing the matrix

1. Update `ROLE_PERMISSIONS` in `lib/auth/permissions.ts`.
2. Update the role table and the enforcement table above in the same commit.
3. If a new permission is added, also:
   - add the denied reason to `PERMISSION_DENIED_REASONS`,
   - layer it into `order-action-rules.ts` where relevant,
   - call `requirePermission()` in the corresponding service function.
