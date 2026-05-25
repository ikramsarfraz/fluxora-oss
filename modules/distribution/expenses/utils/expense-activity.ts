import type { ActivityTimelineItem } from "@/modules/distribution/services/audit";

import type {
  ExpenseAttachmentRow,
} from "../services/expense-attachments";
import type { ExpenseDetail } from "../services/expenses";

/**
 * Build a synthetic activity feed for an expense from the data already in
 * scope on the detail page. Each lifecycle timestamp on the expense row
 * (`createdAt`, `submittedAt`, `approvedAt`, `rejectedAt`, `paidAt`) plus
 * each attached receipt yields one timeline item.
 *
 * The shape matches the shared `ActivityTimelineItem` consumed by
 * `<ActivityCard>` so it slots into the same UI as supplier-invoice /
 * sales-order activity feeds. When the audit-driven backing arrives this
 * helper can be retired in favour of `getActivityForExpense` without
 * touching the consuming component.
 */
export function buildExpenseActivityItems(
  expense: ExpenseDetail,
  attachments: ExpenseAttachmentRow[],
): ActivityTimelineItem[] {
  const items: ActivityTimelineItem[] = [];

  function pushExpenseEvent(args: {
    id: string;
    action: string;
    summary: string;
    at: Date | string | null;
    user: { id: string | null; fullName: string | null; email: string | null } | null;
  }) {
    if (!args.at) return;
    items.push({
      id: args.id,
      source: "derived",
      scope: "other",
      action: args.action,
      summary: args.summary,
      at: args.at instanceof Date ? args.at.toISOString() : args.at,
      actor: {
        id: args.user?.id ?? null,
        name: args.user?.fullName ?? null,
        email: args.user?.email ?? null,
        type: args.user ? "portal_user" : "system",
      },
      entityTable: "expenses",
      entityId: expense.id,
      entityLabel: null,
      changedFields: null,
    });
  }

  pushExpenseEvent({
    id: `expense-${expense.id}-created`,
    action: "expense.created",
    summary: "Created expense",
    at: expense.createdAt,
    user: expense.createdBy ?? null,
  });

  pushExpenseEvent({
    id: `expense-${expense.id}-submitted`,
    action: "expense.submitted",
    summary: "Submitted for approval",
    at: expense.submittedAt,
    user: expense.submittedBy ?? null,
  });

  pushExpenseEvent({
    id: `expense-${expense.id}-approved`,
    action: "expense.approved",
    summary: "Approved",
    at: expense.approvedAt,
    user: expense.approvedBy ?? null,
  });

  pushExpenseEvent({
    id: `expense-${expense.id}-rejected`,
    action: "expense.rejected",
    summary: expense.rejectionReason
      ? `Rejected — ${expense.rejectionReason}`
      : "Rejected",
    at: expense.rejectedAt,
    user: expense.rejectedBy ?? null,
  });

  pushExpenseEvent({
    id: `expense-${expense.id}-paid`,
    action: "expense.paid",
    summary: "Marked as paid",
    at: expense.paidAt,
    user: expense.paidBy ?? null,
  });

  pushExpenseEvent({
    id: `expense-${expense.id}-voided`,
    action: "expense.voided",
    summary: "Voided",
    at: expense.deletedAt,
    user: expense.deletedBy ?? null,
  });

  for (const att of attachments) {
    items.push({
      id: `attachment-${att.fileId}`,
      source: "derived",
      scope: "file",
      action: "expense.receipt_uploaded",
      summary: att.originalFilename
        ? `Uploaded receipt "${att.originalFilename}"`
        : "Uploaded receipt",
      at:
        att.createdAt instanceof Date
          ? att.createdAt.toISOString()
          : String(att.createdAt),
      // Synthetic events from attachments don't carry the uploader's full
      // user record (the attachment list only returns the id). Activity
      // card shows "Unknown" gracefully in that case.
      actor: {
        id: att.uploadedByUserId ?? null,
        name: null,
        email: null,
        type: att.uploadedByUserId ? "portal_user" : "system",
      },
      entityTable: "expense_attachments",
      entityId: att.fileId,
      entityLabel: att.originalFilename,
      changedFields: null,
    });
  }

  // Newest-first to match the supplier-invoice activity feed convention.
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}
