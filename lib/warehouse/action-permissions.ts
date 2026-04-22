import type { PortalUserRole } from "@/lib/auth/permissions";

export function canManageWarehouseCorrections(
  role: PortalUserRole | null | undefined,
) {
  return role === "owner" || role === "admin" || role === "warehouse";
}

export function getWarehouseCorrectionDeniedReason() {
  return "Your role does not allow inventory adjustments or lot correction actions.";
}
