import { api } from "./client";
import { endpoints } from "./endpoints";
import type { PortalUserRole } from "@/services/portal-users";

export type InvitationPreviewDto = {
  fullName: string;
  email: string;
  role: PortalUserRole;
};

export function fetchInvitationPreview(token: string) {
  return api.get<InvitationPreviewDto>(endpoints.invitations.preview(token));
}

export function acceptInvitationRequest(body: {
  token: string;
  password: string;
}) {
  return api.post<{ success: boolean }>(endpoints.invitations.accept(), body);
}
