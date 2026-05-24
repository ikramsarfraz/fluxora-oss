import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import {
  canTransition,
  expenseStatusLabel,
  type ExpenseStatus,
  type ExpenseStatusTransition,
} from "../utils/expense-status";

async function loadExpenseForTransition(expenseId: string) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentPortalUser();
  const row = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)),
  });
  if (!row) throw new Error("Expense not found.");
  return { tenant, user, expense: row };
}

function assertTransition(
  current: ExpenseStatus | string,
  transition: ExpenseStatusTransition,
) {
  if (!canTransition(current as ExpenseStatus, transition)) {
    throw new Error(
      `Cannot ${transition.replace("_", " ")} an expense that is currently "${expenseStatusLabel(current)}".`,
    );
  }
}

async function logTransition(input: {
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
  expenseId: string;
  transition: ExpenseStatusTransition;
  metadata?: Record<string, unknown>;
}) {
  await logAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: `expense.${input.transition}`,
    resourceType: "expense",
    resourceId: input.expenseId,
    metadata: input.metadata,
  });
}

// ── Transitions ───────────────────────────────────────────────────────────

export async function submitExpense(expenseId: string) {
  const { tenant, user, expense } = await loadExpenseForTransition(expenseId);
  assertTransition(expense.status, "submit");

  const now = new Date();
  await db
    .update(expenses)
    .set({
      status: "submitted",
      submittedAt: now,
      submittedByUserId: user.id,
      // Clear any prior rejection — the submitter has iterated past it.
      rejectedAt: null,
      rejectedByUserId: null,
      rejectionReason: null,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)));

  await logTransition({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    expenseId,
    transition: "submit",
  });

  return { success: true as const };
}

export async function approveExpense(expenseId: string) {
  const { tenant, user, expense } = await loadExpenseForTransition(expenseId);
  assertTransition(expense.status, "approve");

  // Approver can't be the submitter — basic separation-of-duties guard.
  // Workspace owners often submit AND approve historically; we leave that
  // judgment to a v2 policy toggle. v1 only blocks the same actor in the
  // same lifecycle (submit → approve self).
  if (expense.submittedByUserId && expense.submittedByUserId === user.id) {
    throw new Error("You can't approve an expense you submitted.");
  }

  const now = new Date();
  await db
    .update(expenses)
    .set({
      status: "approved",
      approvedAt: now,
      approvedByUserId: user.id,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)));

  await logTransition({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    expenseId,
    transition: "approve",
  });

  return { success: true as const };
}

export async function rejectExpense(input: { expenseId: string; reason: string }) {
  const { tenant, user, expense } = await loadExpenseForTransition(input.expenseId);
  assertTransition(expense.status, "reject");

  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new Error("Rejection reason is required.");
  }
  if (reason.length > 1000) {
    throw new Error("Rejection reason is too long (max 1000 characters).");
  }

  const now = new Date();
  await db
    .update(expenses)
    .set({
      status: "rejected",
      rejectedAt: now,
      rejectedByUserId: user.id,
      rejectionReason: reason,
    })
    .where(and(eq(expenses.id, input.expenseId), eq(expenses.tenantId, tenant.id)));

  await logTransition({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    expenseId: input.expenseId,
    transition: "reject",
    metadata: { reason },
  });

  return { success: true as const };
}

export async function resetExpenseToDraft(expenseId: string) {
  const { tenant, user, expense } = await loadExpenseForTransition(expenseId);
  assertTransition(expense.status, "reset");

  // Only the original creator (or a manager) gets to reset — but role-gate
  // happens at the action layer. Service just enforces the transition.

  const now = new Date();
  await db
    .update(expenses)
    .set({
      status: "draft",
      // Keep the rejection_reason so the editor can read why before
      // changing anything. Resetting bumps the row out of "rejected" so
      // the queue UI moves on; the reason survives as historical context
      // (cleared on next submit).
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)));

  await logTransition({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    expenseId,
    transition: "reset",
    metadata: { resetAt: now.toISOString() },
  });

  return { success: true as const };
}

export async function markExpensePaid(expenseId: string) {
  const { tenant, user, expense } = await loadExpenseForTransition(expenseId);
  assertTransition(expense.status, "mark_paid");

  const now = new Date();
  await db
    .update(expenses)
    .set({
      status: "paid",
      paidAt: now,
      paidByUserId: user.id,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.tenantId, tenant.id)));

  await logTransition({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorEmail: user.email,
    expenseId,
    transition: "mark_paid",
  });

  return { success: true as const };
}
