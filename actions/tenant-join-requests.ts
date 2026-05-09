"use server";

import {
  createTenantJoinRequest,
  listPendingTenantJoinRequestsForAdmin,
  reviewTenantJoinRequestByAdmin,
} from "@/modules/core/workspace-settings/services/tenant-join-requests";

export async function createTenantJoinRequestAction(
  input: Parameters<typeof createTenantJoinRequest>[0],
) {
  return await createTenantJoinRequest(input);
}

export async function getPendingTenantJoinRequestsAction() {
  return await listPendingTenantJoinRequestsForAdmin();
}

export async function reviewTenantJoinRequestAction(
  input: Parameters<typeof reviewTenantJoinRequestByAdmin>[0],
) {
  return await reviewTenantJoinRequestByAdmin(input);
}
