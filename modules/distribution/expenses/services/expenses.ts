import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { expenses, portalUsers } from "@/db/schema";
import {
  canManageExpenses,
  nextRecurrenceDate,
  planRecurringInstances,
  type ExpensePaymentMethod,
  type ExpenseRecurrenceInterval,
} from "@/lib/expenses/metadata";

import { getCurrentPortalUser, type PortalUserRole } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

/* -------------------------------------------------------------------------- */
/* Re-exports of client-safe metadata (for convenience in server code).       */
/* Client components should import directly from `@/lib/expenses/metadata`.   */
/* -------------------------------------------------------------------------- */

export {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  canManageExpenses,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
} from "@/lib/expenses/metadata";
export type {
  ExpenseCategoryValue,
  ExpensePaymentMethod,
} from "@/lib/expenses/metadata";

/* -------------------------------------------------------------------------- */
/* Role guard                                                                  */
/* -------------------------------------------------------------------------- */

async function requireExpenseManager() {
  const current = await getCurrentPortalUser();
  if (!canManageExpenses(current.role as PortalUserRole)) {
    throw new Error(
      "Your role does not allow creating or editing expenses.",
    );
  }
  return current;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function getExpenses() {
  const tenant = await getCurrentTenant();
  return db.query.expenses.findMany({
    where: eq(expenses.tenantId, tenant.id),
    with: { createdBy: true },
    orderBy: [desc(expenses.expenseDate), desc(expenses.createdAt)],
  });
}

export type ExpenseListSort =
  | "expenseDate"
  | "category"
  | "amount"
  | "createdAt";

/**
 * URL-friendly filter slugs. All values are strings because they flow through
 * the URL search params before reaching the server action.
 *
 *  - dateFrom / dateTo: inclusive YYYY-MM-DD bounds on `expenses.expense_date`.
 *  - amountMin / amountMax: inclusive decimal bounds on `expenses.amount`.
 *  - paymentMethod: a single `ExpensePaymentMethod` slug, or empty for any.
 *  - recurrence: 'all' | 'schedules' | 'instances' | 'oneoff'.
 *  - status: one of the expense_status enum values; empty for any.
 */
export type ExpenseListFilters = {
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  paymentMethod?: string;
  recurrence?: string;
  status?: string;
};

export type ExpenseListParams = PaginatedQueryInput<
  ExpenseListSort,
  ExpenseListFilters
>;

export async function getExpensesPage(input?: ExpenseListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "expenseDate",
    defaultDirection: "desc",
    defaultFilters: {} as ExpenseListFilters,
  });
  const f = query.filters;
  const conditions = [
    eq(expenses.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      expenses.category,
      expenses.note,
      portalUsers.fullName,
    ]),
  ];
  if (f.dateFrom) {
    conditions.push(gte(expenses.expenseDate, f.dateFrom));
  }
  if (f.dateTo) {
    conditions.push(lte(expenses.expenseDate, f.dateTo));
  }
  if (f.amountMin) {
    const n = Number(f.amountMin);
    if (Number.isFinite(n) && n >= 0) {
      conditions.push(gte(expenses.amount, n.toFixed(2)));
    }
  }
  if (f.amountMax) {
    const n = Number(f.amountMax);
    if (Number.isFinite(n) && n >= 0) {
      conditions.push(lte(expenses.amount, n.toFixed(2)));
    }
  }
  if (f.paymentMethod) {
    conditions.push(
      eq(expenses.paymentMethod, f.paymentMethod as ExpensePaymentMethod),
    );
  }
  if (f.recurrence === "schedules") {
    conditions.push(ne(expenses.recurrenceInterval, "none"));
    conditions.push(isNull(expenses.recurrenceParentId));
  } else if (f.recurrence === "instances") {
    conditions.push(isNotNull(expenses.recurrenceParentId));
  } else if (f.recurrence === "oneoff") {
    conditions.push(eq(expenses.recurrenceInterval, "none"));
    conditions.push(isNull(expenses.recurrenceParentId));
  }
  if (f.status) {
    // Trust the enum at the type-level; an unknown string just yields zero rows.
    conditions.push(
      eq(expenses.status, f.status as "draft" | "submitted" | "approved" | "rejected" | "paid"),
    );
  }
  const where = and(...conditions);
  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${expenses.id})::int` })
    .from(expenses)
    .leftJoin(portalUsers, eq(portalUsers.id, expenses.createdByUserId))
    .where(where);
  const expenseIds = await db
    .select({ id: expenses.id })
    .from(expenses)
    .leftJoin(portalUsers, eq(portalUsers.id, expenses.createdByUserId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          expenseDate: expenses.expenseDate,
          category: expenses.category,
          amount: expenses.amount,
          createdAt: expenses.createdAt,
        },
      }),
      desc(expenses.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));
  const ids = expenseIds.map(row => row.id);
  if (ids.length === 0) {
    return createPaginatedResult({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    });
  }

  const rows = await db.query.expenses.findMany({
    where: inArray(expenses.id, ids),
    with: { createdBy: true },
  });

  const rowMap = new Map(rows.map(row => [row.id, row]));
  return createPaginatedResult({
    data: ids
      .map(id => rowMap.get(id))
      .filter((row): row is (typeof rows)[number] => Boolean(row)),
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type ExpenseListItem = Awaited<ReturnType<typeof getExpenses>>[number];

/**
 * Build the CSV export for the expenses listing, honoring the same filters
 * + search the UI applies. Caller is responsible for the Blob/download —
 * service just returns the rows.
 */
export async function exportExpensesCsv(input?: ExpenseListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "expenseDate",
    defaultDirection: "desc",
    defaultFilters: {} as ExpenseListFilters,
  });
  const f = query.filters;
  const conditions = [
    eq(expenses.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      expenses.category,
      expenses.note,
      portalUsers.fullName,
    ]),
  ];
  if (f.dateFrom) conditions.push(gte(expenses.expenseDate, f.dateFrom));
  if (f.dateTo) conditions.push(lte(expenses.expenseDate, f.dateTo));
  if (f.amountMin) {
    const n = Number(f.amountMin);
    if (Number.isFinite(n) && n >= 0) {
      conditions.push(gte(expenses.amount, n.toFixed(2)));
    }
  }
  if (f.amountMax) {
    const n = Number(f.amountMax);
    if (Number.isFinite(n) && n >= 0) {
      conditions.push(lte(expenses.amount, n.toFixed(2)));
    }
  }
  if (f.paymentMethod) {
    conditions.push(
      eq(expenses.paymentMethod, f.paymentMethod as ExpensePaymentMethod),
    );
  }
  if (f.recurrence === "schedules") {
    conditions.push(ne(expenses.recurrenceInterval, "none"));
    conditions.push(isNull(expenses.recurrenceParentId));
  } else if (f.recurrence === "instances") {
    conditions.push(isNotNull(expenses.recurrenceParentId));
  } else if (f.recurrence === "oneoff") {
    conditions.push(eq(expenses.recurrenceInterval, "none"));
    conditions.push(isNull(expenses.recurrenceParentId));
  }
  if (f.status) {
    // Trust the enum at the type-level; an unknown string just yields zero rows.
    conditions.push(
      eq(expenses.status, f.status as "draft" | "submitted" | "approved" | "rejected" | "paid"),
    );
  }
  const where = and(...conditions);

  // Hard cap at 10k rows — anything larger should paginate through the API
  // rather than ship as a single download.
  const rows = await db.query.expenses.findMany({
    where,
    with: { createdBy: true },
    orderBy: [desc(expenses.expenseDate), desc(expenses.createdAt)],
    limit: 10_000,
  });

  return rows.map(r => ({
    expenseDate: r.expenseDate,
    category: r.category,
    amount: r.amount,
    paymentMethod: r.paymentMethod ?? "",
    note: r.note ?? "",
    recurrenceInterval: r.recurrenceInterval ?? "none",
    recurrenceEndDate: r.recurrenceEndDate ?? "",
    isRecurringSchedule:
      r.recurrenceInterval && r.recurrenceInterval !== "none" && !r.recurrenceParentId
        ? "yes"
        : "no",
    isMaterializedInstance: r.recurrenceParentId ? "yes" : "no",
    createdBy: r.createdBy?.fullName ?? "",
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

export async function getExpenseById(id: string) {
  const tenant = await getCurrentTenant();
  const row = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, id), eq(expenses.tenantId, tenant.id)),
    with: {
      // All five actor relations powered by their own relationName so the
      // ActivityCard timeline can render each step ("Bob approved", "Alice
      // submitted", …) without a follow-up query.
      createdBy: true,
      submittedBy: true,
      approvedBy: true,
      rejectedBy: true,
      paidBy: true,
    },
  });
  return row ?? null;
}

export type ExpenseDetail = NonNullable<
  Awaited<ReturnType<typeof getExpenseById>>
>;

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export type CreateExpenseInput = {
  expenseDate: string;
  category: string;
  amount: string;
  paymentMethod?: ExpensePaymentMethod | null;
  note?: string | null;
  /** When set and != 'none', the row is a recurring schedule. */
  recurrenceInterval?: ExpenseRecurrenceInterval | null;
  /** Optional end-of-recurrence date (inclusive). */
  recurrenceEndDate?: string | null;
};

export type UpdateExpenseInput = Partial<CreateExpenseInput> & { id: string };

function normalizeAmount(value: string): string {
  const trimmed = (value ?? "").trim();
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return n.toFixed(2);
}

function normalizeCategory(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error("Category is required.");
  }
  return trimmed;
}

function normalizeDate(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error("Expense date is required.");
  }
  return trimmed;
}

export async function createExpense(input: CreateExpenseInput) {
  const current = await requireExpenseManager();
  const expenseDate = normalizeDate(input.expenseDate);
  const recurrenceInterval = input.recurrenceInterval ?? "none";
  const isSchedule = recurrenceInterval !== "none";
  const recurrenceEndDate = input.recurrenceEndDate?.trim() || null;
  const recurrenceNextDueDate = isSchedule
    ? nextRecurrenceDate(expenseDate, recurrenceInterval)
    : null;

  const [row] = await db
    .insert(expenses)
    .values({
      tenantId: current.tenantId,
      expenseDate,
      category: normalizeCategory(input.category),
      amount: normalizeAmount(input.amount),
      paymentMethod: input.paymentMethod ?? null,
      note: input.note?.trim() || null,
      recurrenceInterval,
      recurrenceStartDate: isSchedule ? expenseDate : null,
      recurrenceEndDate: isSchedule ? recurrenceEndDate : null,
      recurrenceNextDueDate,
      createdByUserId: current.id,
    })
    .returning({ id: expenses.id });
  if (!row) {
    throw new Error("Failed to create expense.");
  }
  return getExpenseById(row.id);
}

export async function updateExpense(input: UpdateExpenseInput) {
  const current = await requireExpenseManager();
  const existing = await getExpenseById(input.id);
  if (!existing) {
    throw new Error("Expense not found.");
  }

  const patch: Record<string, string | null> = {};
  if (input.expenseDate !== undefined) {
    patch.expenseDate = normalizeDate(input.expenseDate);
  }
  if (input.category !== undefined) {
    patch.category = normalizeCategory(input.category);
  }
  if (input.amount !== undefined) {
    patch.amount = normalizeAmount(input.amount);
  }
  if (input.paymentMethod !== undefined) {
    patch.paymentMethod = input.paymentMethod ?? null;
  }
  if (input.note !== undefined) {
    patch.note = input.note?.trim() || null;
  }
  if (input.recurrenceInterval !== undefined) {
    const recurrenceInterval = input.recurrenceInterval ?? "none";
    const expenseDate = (patch.expenseDate as string | undefined) ?? existing.expenseDate;
    const isSchedule = recurrenceInterval !== "none";
    patch.recurrenceInterval = recurrenceInterval;
    patch.recurrenceStartDate = isSchedule ? expenseDate : null;
    patch.recurrenceNextDueDate = isSchedule
      ? nextRecurrenceDate(expenseDate, recurrenceInterval)
      : null;
  }
  if (input.recurrenceEndDate !== undefined) {
    patch.recurrenceEndDate = input.recurrenceEndDate?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  await db
    .update(expenses)
    .set(patch)
    .where(
      and(eq(expenses.id, input.id), eq(expenses.tenantId, current.tenantId)),
    );

  return getExpenseById(input.id);
}

export async function deleteExpense(id: string) {
  const current = await requireExpenseManager();
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.tenantId, current.tenantId)));
  return { success: true as const };
}

/* -------------------------------------------------------------------------- */
/* Cron — materialize recurring schedules                                      */
/* -------------------------------------------------------------------------- */

/**
 * For every recurring schedule whose `recurrenceNextDueDate` is on or before today,
 * create the missing instance(s) up to today (or up to `recurrenceEndDate` if set).
 *
 * Each instance is a normal expense row with:
 *   - expenseDate = the due date being materialized
 *   - recurrenceInterval = 'none' (instances are not themselves recurring)
 *   - recurrenceParentId = the schedule's id
 *
 * After materializing, the schedule's `recurrenceNextDueDate` is advanced.
 * When the next due date moves past `recurrenceEndDate`, the schedule is
 * considered exhausted and `recurrenceNextDueDate` is set to NULL.
 *
 * Tenant-agnostic — runs across every tenant. Cron is the only caller.
 */
export async function materializeRecurringExpenses(options?: {
  /** Override today's date (UTC ISO date). Used by tests. */
  today?: string;
  /** Safety cap on how many instances to create per schedule per run. */
  maxInstancesPerSchedule?: number;
}): Promise<{ schedulesProcessed: number; instancesCreated: number }> {
  const todayISO = options?.today ?? new Date().toISOString().slice(0, 10);
  const cap = options?.maxInstancesPerSchedule ?? 36;

  const schedules = await db
    .select()
    .from(expenses)
    .where(
      and(
        ne(expenses.recurrenceInterval, "none"),
        isNotNull(expenses.recurrenceNextDueDate),
        lte(expenses.recurrenceNextDueDate, todayISO),
        or(
          sql`${expenses.recurrenceEndDate} IS NULL`,
          sql`${expenses.recurrenceNextDueDate} <= ${expenses.recurrenceEndDate}`,
        ),
      ),
    );

  let instancesCreated = 0;

  for (const schedule of schedules) {
    const plan = planRecurringInstances(
      {
        recurrenceInterval: schedule.recurrenceInterval as ExpenseRecurrenceInterval,
        recurrenceEndDate: schedule.recurrenceEndDate,
        recurrenceNextDueDate: schedule.recurrenceNextDueDate,
      },
      { today: todayISO, cap },
    );

    for (const dueDate of plan.dueDates) {
      await db.insert(expenses).values({
        tenantId: schedule.tenantId,
        expenseDate: dueDate,
        category: schedule.category,
        amount: schedule.amount,
        paymentMethod: schedule.paymentMethod,
        note: schedule.note,
        recurrenceInterval: "none",
        recurrenceParentId: schedule.id,
        createdByUserId: schedule.createdByUserId,
      });
      instancesCreated += 1;
    }

    await db
      .update(expenses)
      .set({ recurrenceNextDueDate: plan.nextDueDate })
      .where(eq(expenses.id, schedule.id));
  }

  return { schedulesProcessed: schedules.length, instancesCreated };
}
