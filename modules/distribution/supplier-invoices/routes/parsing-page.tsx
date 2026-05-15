import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { ParsingProgressLive } from "../components/parsing-progress/parsing-progress-live";

const BULK_IMPORT_LS_PREFIX = "fluxora:bulk-import:";

export default async function SupplierInvoicesParsingPage({
  params,
}: {
  params: Promise<{ uploadId: string }>;
}) {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  const { uploadId } = await params;
  // The single-import uploader navigates with a localStorage handoff key as
  // the path segment. Other shapes (legacy URLs, manually-typed paths) get a
  // 404 rather than rendering an empty screen.
  if (!uploadId.startsWith(BULK_IMPORT_LS_PREFIX)) {
    notFound();
  }

  return <ParsingProgressLive storageKey={uploadId} />;
}
