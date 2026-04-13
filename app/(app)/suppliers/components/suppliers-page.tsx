"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import { columns } from "./columns";
import { DataTable } from "./data-table";
import { useSuppliers } from "@/hooks/use-suppliers";

export default function Suppliers() {
  const { data: suppliers, isLoading, error: loadError } = useSuppliers();

  if (isLoading) return <div className="loading">Loading suppliers…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="suppliers-table-heading"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 id="suppliers-table-heading">Suppliers</h1>
          <Button variant="outline" asChild>
            <Link href="/suppliers/new">
              <Plus />
              <span className="hidden lg:inline">Add Supplier</span>
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Add and view suppliers for lots and supplier invoices.
        </p>
      </div>

      <DataTable columns={columns} data={suppliers ?? []} />
    </section>
  );
}
