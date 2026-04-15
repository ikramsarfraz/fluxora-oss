"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/use-users";
import { Plus } from "lucide-react";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export default function Users() {
  const { data: users, isLoading, error: loadError } = useUsers();

  if (isLoading) return <div className="loading">Loading users…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="users-table-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id="users-table-heading">Users</h1>
        <Button asChild>
          <Link href="/users/new">
            <Plus />
            <span className="hidden lg:inline">Invite user</span>
          </Link>
        </Button>
      </div>

      <DataTable columns={columns} data={users ?? []} />
    </section>
  );
}
