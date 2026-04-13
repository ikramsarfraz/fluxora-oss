"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { Plus } from "lucide-react";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export default function Products() {
  const { data: products, isLoading, error: loadError } = useProducts();

  if (isLoading) return <div className="loading">Loading products…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="products-table-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id="products-table-heading">Products</h1>
        <Button asChild>
          <Link href="/products/new">
            <Plus />
            <span className="hidden lg:inline">Add Product</span>
          </Link>
        </Button>
      </div>

      <DataTable columns={columns} data={products ?? []} />
    </section>
  );
}
