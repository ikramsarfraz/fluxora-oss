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
  // Next 16 hands dynamic-segment params back URL-encoded; our storage keys
  // (`fluxora:bulk-import:<id>`) contain colons which encodeURIComponent
  // escapes to `%3A`, so we have to decode before the prefix check. Wrapping
  // in try/catch keeps malformed escapes from blowing up the route — those
  // are treated the same as any other unrecognized path: 404.
  let storageKey: string;
  try {
    storageKey = decodeURIComponent(uploadId);
  } catch {
    notFound();
  }

  // The single-import uploader navigates with a localStorage handoff key as
  // the path segment. Other shapes (legacy URLs, manually-typed paths) get a
  // 404 rather than rendering an empty screen.
  if (!storageKey.startsWith(BULK_IMPORT_LS_PREFIX)) {
    notFound();
  }

  return <ParsingProgressLive storageKey={storageKey} />;
}
