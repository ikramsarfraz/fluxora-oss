import { Suspense } from "react";
import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { SupplierBillsShell } from "../components/supplier-bills-shell";

/**
 * `/supplier-invoices` — tabbed shell hosting Inbox (pending bulk-import
 * rows) and Bills (posted supplier invoices). The client component drives
 * its own queries via React Query; prefetching here just delayed every
 * navigation by two DB calls (and a Suspense fallback flash) for keys
 * the cache usually already has. Matches the orders pattern.
 *
 * The permission check stays — it must run on the server so unauthorized
 * users get a 404 instead of seeing the tabbed shell flash for a frame.
 */
export default async function SupplierInvoicesListPage() {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();

  return (
    <Suspense>
      <SupplierBillsShell />
    </Suspense>
  );
}
