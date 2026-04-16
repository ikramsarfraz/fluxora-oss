import { api } from "./client";
import { endpoints } from "./endpoints";
import type { PendingInvitationListItem } from "@/services/invitations";

export function getPendingInvitations() {
  return api.get<PendingInvitationListItem[]>(
    endpoints.userInvitations.list(),
  );
}

export type { PendingInvitationListItem } from "@/services/invitations";
