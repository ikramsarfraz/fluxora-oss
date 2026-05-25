"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type { SortDirection } from "@/lib/pagination";

type FilterValue = string | undefined;
type FilterState = object;
type UrlParamValue = string | number | null | undefined;

type UrlPaginationOptions<TSort extends string, TFilters extends FilterState> = {
  defaultSort: TSort;
  defaultDirection?: SortDirection;
  defaultPageSize?: number;
  defaultFilters?: TFilters;
  debounceMs?: number;
};

type UpdateOptions = {
  resetPage?: boolean;
  replace?: boolean;
};

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSortDirection(value: string | null, fallback: SortDirection) {
  return value === "asc" || value === "desc" ? value : fallback;
}

function setParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
  defaultValue?: string | number,
) {
  if (
    value == null ||
    value === "" ||
    value === "all" ||
    String(value) === String(defaultValue ?? "")
  ) {
    params.delete(key);
    return;
  }

  params.set(key, String(value));
}

export function useUrlPaginationState<
  TSort extends string,
  TFilters extends FilterState = Record<string, never>,
>({
  defaultSort,
  defaultDirection = "desc",
  defaultPageSize = 10,
  defaultFilters,
  debounceMs = 350,
}: UrlPaginationOptions<TSort, TFilters>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [paramsSnapshot, setParamsSnapshot] = useState(() =>
    searchParams.toString(),
  );
  const currentParams = useMemo(
    () => new URLSearchParams(paramsSnapshot),
    [paramsSnapshot],
  );

  useEffect(() => {
    // Mirror the server-provided searchParams into the optimistic snapshot
    // that writeParams/popstate also write to. Disable rule: this is the
    // canonical "sync external prop to local state" path for this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParamsSnapshot(searchParams.toString());
  }, [searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      setParamsSnapshot(window.location.search.replace(/^\?/, ""));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const filters = useMemo<TFilters>(() => {
    const nextFilters = { ...(defaultFilters ?? {}) } as TFilters;
    for (const key of Object.keys(defaultFilters ?? {})) {
      const value = currentParams.get(key);
      const defaults = defaultFilters as Record<string, FilterValue> | undefined;
      nextFilters[key as keyof TFilters] = (value ??
        defaults?.[key]) as TFilters[keyof TFilters];
    }
    return nextFilters;
  }, [currentParams, defaultFilters]);

  const page = parsePositiveInt(currentParams.get("page"), 1);
  const pageSize = parsePositiveInt(
    currentParams.get("pageSize"),
    defaultPageSize,
  );
  const search = currentParams.get("search") ?? "";
  const sort = (currentParams.get("sort") ?? defaultSort) as TSort;
  const direction = parseSortDirection(
    currentParams.get("direction"),
    defaultDirection,
  );

  const [searchInput, setSearchInput] = useState(search);

  const writeParams = useCallback(
    (
      updates: Record<string, UrlParamValue>,
      options: UpdateOptions = {},
    ) => {
      const nextParams = new URLSearchParams(paramsSnapshot);

      for (const [key, value] of Object.entries(updates)) {
        const defaultFilterValue = (
          defaultFilters as Record<string, UrlParamValue> | undefined
        )?.[key];
        const defaultValue =
          key === "page"
            ? 1
            : key === "pageSize"
              ? defaultPageSize
              : key === "sort"
                ? defaultSort
                : key === "direction"
                  ? defaultDirection
                  : defaultFilterValue;
        setParam(nextParams, key, value, defaultValue ?? undefined);
      }

      if (options.resetPage) {
        nextParams.delete("page");
      }

      const queryString = nextParams.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) {
        return;
      }

      setParamsSnapshot(queryString);

      if (options.replace) {
        window.history.replaceState(null, "", nextUrl);
        return;
      }

      window.history.pushState(null, "", nextUrl);
    },
    [
      defaultDirection,
      defaultFilters,
      defaultPageSize,
      defaultSort,
      paramsSnapshot,
      pathname,
    ],
  );

  useEffect(() => {
    // Reset the search-box value when the URL's `search` param changes
    // out-of-band (back/forward, programmatic nav). Intentional sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (searchInput === search) {
      return;
    }

    const timeout = window.setTimeout(() => {
      writeParams({ search: searchInput }, { resetPage: true });
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, search, searchInput, writeParams]);

  return {
    page,
    pageSize,
    search,
    searchInput,
    sort,
    direction,
    filters,
    setPage: (nextPage: number) => writeParams({ page: nextPage }),
    setPageSize: (nextPageSize: number) =>
      writeParams({ pageSize: nextPageSize }, { resetPage: true }),
    setSearch: setSearchInput,
    setSort: (nextSort: TSort, nextDirection: SortDirection) =>
      writeParams(
        { sort: nextSort, direction: nextDirection },
        { resetPage: true },
      ),
    setFilter: <TKey extends keyof TFilters>(
      key: TKey,
      value: TFilters[TKey],
    ) =>
      writeParams(
        { [String(key)]: value as UrlParamValue },
        { resetPage: true },
      ),
    setFilters: (nextFilters: Partial<TFilters>) =>
      writeParams(nextFilters as Record<string, UrlParamValue>, {
        resetPage: true,
      }),
  };
}
