"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/use-customers";
import { Plus } from "lucide-react";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export default function Customers() {
  const { data: customers, isLoading, error: loadError } = useCustomers();

  if (isLoading) return <div className="loading">Loading customers…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="customers-table-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id="customers-table-heading">Customers</h1>
        <Button variant="outline" asChild>
          <Link href="/customers/new">
            <Plus />
            <span className="hidden lg:inline">Add Customer</span>
          </Link>
        </Button>
      </div>

      <DataTable columns={columns} data={customers ?? []} />
    </section>
  );
}
