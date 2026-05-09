import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { expenses, portalUsers } from "@/db/schema";
import {
  canManageExpenses,
  type ExpensePaymentMethod,
} from "@/lib/expenses/metadata";

import { getCurrentPortalUser, type PortalUserRole } from "@/services/portal-users";
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

export type ExpenseListParams = PaginatedQueryInput<ExpenseListSort>;

export async function getExpensesPage(input?: ExpenseListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "expenseDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(expenses.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      expenses.category,
      expenses.note,
      portalUsers.fullName,
    ]),
  );
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

export async function getExpenseById(id: string) {
  const tenant = await getCurrentTenant();
  const row = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, id), eq(expenses.tenantId, tenant.id)),
    with: { createdBy: true },
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
  const [row] = await db
    .insert(expenses)
    .values({
      tenantId: current.tenantId,
      expenseDate: normalizeDate(input.expenseDate),
      category: normalizeCategory(input.category),
      amount: normalizeAmount(input.amount),
      paymentMethod: input.paymentMethod ?? null,
      note: input.note?.trim() || null,
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
