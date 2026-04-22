"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/use-customers";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import type { CustomerListItem } from "@/services/customers";
import { deleteCustomerAction } from "@/actions/customers";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

export default function Lots() {
  const queryClient = useQueryClient();
  const {
    data: customers,
    isLoading,
    error: loadError,
    refetch,
  } = useCustomers();

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
    return <PageLoading message="Loading customers..." />;
  }

  if (loadError) {
    return (
      <PageError
        message={(loadError as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasCustomers = customers && customers.length > 0;

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
        <DataTable columns={columns} data={customers} />
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
