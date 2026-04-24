import { asc, desc, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

export type SortDirection = "asc" | "desc";

export interface PaginatedQueryInput<
  TSort extends string = string,
  TFilters = Record<string, string | undefined>,
> {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: TSort;
  direction?: SortDirection;
  filters?: TFilters;
}

export interface PaginatedResult<TData> {
  data: TData[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface NormalizedPaginatedQuery<
  TSort extends string = string,
  TFilters = Record<string, string | undefined>,
> {
  page: number;
  pageSize: number;
  search: string;
  sort: TSort;
  direction: SortDirection;
  filters: TFilters;
}

type SortExpression = AnyColumn | SQL;

interface NormalizeOptions<TSort extends string, TFilters> {
  defaultSort: TSort;
  defaultDirection?: SortDirection;
  defaultPageSize?: number;
  maxPageSize?: number;
  defaultFilters: TFilters;
}

interface ResolveOrderByOptions<TSort extends string> {
  sort: TSort;
  direction: SortDirection;
  expressions: Record<TSort, SortExpression | SortExpression[]>;
}

export function normalizePaginatedQuery<
  TSort extends string,
  TFilters,
>(
  input: PaginatedQueryInput<TSort, TFilters> | undefined,
  options: NormalizeOptions<TSort, TFilters>,
): NormalizedPaginatedQuery<TSort, TFilters> {
  const page = Math.max(1, input?.page ?? 1);
  const defaultPageSize = options.defaultPageSize ?? 10;
  const maxPageSize = options.maxPageSize ?? 100;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, input?.pageSize ?? defaultPageSize),
  );

  return {
    page,
    pageSize,
    search: input?.search?.trim() ?? "",
    sort: input?.sort ?? options.defaultSort,
    direction: input?.direction ?? options.defaultDirection ?? "desc",
    filters: input?.filters ?? options.defaultFilters,
  };
}

export function createPaginatedResult<TData>(input: {
  data: TData[];
  page: number;
  pageSize: number;
  total: number;
}): PaginatedResult<TData> {
  return {
    data: input.data,
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    pageCount: Math.max(1, Math.ceil(input.total / input.pageSize)),
  };
}

export function getPaginationOffset(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

export function buildTextSearchCondition(
  search: string,
  expressions: Array<AnyColumn | SQL>,
) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const escaped = normalized.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  return or(
    ...expressions.map(expression =>
      sql`lower(coalesce(${expression}::text, '')) like ${pattern} escape '\\'`,
    ),
  );
}

export function resolveOrderBy<TSort extends string>({
  sort,
  direction,
  expressions,
}: ResolveOrderByOptions<TSort>) {
  const resolved = expressions[sort];
  const list = Array.isArray(resolved) ? resolved : [resolved];

  return list.map(expression =>
    direction === "asc" ? asc(expression) : desc(expression),
  );
}
