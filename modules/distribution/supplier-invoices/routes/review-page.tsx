import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { ReviewDemo } from "../components/review/review-demo";

export default async function SupplierInvoicesReviewPage(_props: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  // Phase 3: presentational shell with mocked review data. The PDF pane is a
  // fake-invoice placeholder — phase 4 wires PDF.js + real bbox overlays.
  return <ReviewDemo />;
}
