# Support workflow

## Tenant-facing

Customers open **`/support`**, submit new tickets from **`/support/new`**, and may attach supporting files. Tenants see only tickets for **their workspace** (tenant isolation on every query).

Ticket detail shows the reported issue, attachments, timeline, assignment when configured, and **tenant-visible updates** added by admins.

## Platform admin-facing

Authorized platform users manage tickets from **`admin.<ROOT_DOMAIN>/admin/support`**.

The list supports filters such as status, priority, and issue type. Ticket detail supports status changes, assignment, internal-only notes vs tenant-visible replies, and attachment retrieval.

When Resend credentials are configured, notifications use email where applicable; otherwise the service layer falls back to structured console logging.

See also: [Documentation index](./README.md), [permissions rules](./rules/README.md).
