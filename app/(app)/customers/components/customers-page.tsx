"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCustomersPage } from "@/hooks/use-customers";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import type { CustomerListItem, CustomerListSort } from "@/services/customers";
import { deleteCustomerAction } from "@/actions/customers";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export default function Customers() {
  const pagination = useUrlPaginationState<CustomerListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });
  const queryClient = useQueryClient();
  const {
    data: customers,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useCustomersPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: async (customer: CustomerListItem) => {
          await deleteCustomerAction(customer.id);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.customers.all,
          });
        },
      }),
    [queryClient],
  );

  if (isLoading) {
    return <ListPageSkeleton tableColumns={5} />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasCustomers =
    (customers?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="customers-heading"
    >
      <PageHeader
        title="Customers"
        description="Manage your customer accounts and contact information."
      >
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Customer</span>
          </Link>
        </Button>
      </PageHeader>

      {hasCustomers ? (
        <DataTable
          columns={columns}
          data={customers?.data ?? []}
          searchPlaceholder="Search customers..."
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={customers?.page ?? pagination.page}
          pageSize={customers?.pageSize ?? pagination.pageSize}
          total={customers?.total ?? 0}
          pageCount={customers?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(nextSort as CustomerListSort, nextDirection);
          }}
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Get started by adding your first customer to the system."
        >
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="size-4" />
              Add Customer
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
