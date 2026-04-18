"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/use-customers";
import { useDeleteCustomer } from "@/hooks/use-customer-mutations";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";
import type { CustomerListItem } from "@/services/customers";

export default function Customers() {
  const { data: customers, isLoading, error: loadError, refetch } = useCustomers();
  const deleteCustomer = useDeleteCustomer();

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: (customer: CustomerListItem) => {
          deleteCustomer.mutate(customer.id);
        },
      }),
    [deleteCustomer]
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
    <section className="flex flex-col gap-6" aria-labelledby="customers-heading">
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
