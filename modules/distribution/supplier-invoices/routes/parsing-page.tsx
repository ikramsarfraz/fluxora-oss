import { notFound } from "next/navigation";

import { can } from "@/lib/auth/permissions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

import { ParsingProgressDemo } from "../components/parsing-progress/parsing-progress-demo";

export default async function SupplierInvoicesParsingPage(_props: {
  params: Promise<{ uploadId: string }>;
}) {
  const currentUser = await getCurrentPortalUser();
  if (!can(currentUser.role, "view_supplier_invoice")) notFound();
  if (!can(currentUser.role, "edit_supplier_invoice")) notFound();

  // Phase 1: the screen renders mocked, time-driven data so design + QA can
  // verify the UI. Wiring to a real parse job (stage stream + streaming lines)
  // is a follow-up — see the redesign plan.
  return <ParsingProgressDemo />;
}
