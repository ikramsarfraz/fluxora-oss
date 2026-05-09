"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPendingInvitationsAction,
  getUserByIdAction,
  getUsersDirectoryPageAction,
  getUsersAction,
  inviteUserAction,
  resendUserInvitationAction,
  revokeUserInvitationAction,
  sendUserPasswordResetAction,
  setUserActiveAction,
  setUserRoleAction,
} from "@/modules/core/workspace-settings/actions";
import type { PortalUserRole } from "@/modules/shared/services/portal-users";
import type { UsersDirectoryListParams } from "@/modules/shared/services/portal-users";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: getUsersAction,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUsersDirectoryPage(params: UsersDirectoryListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => getUsersDirectoryPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => getUserByIdAction(id),
    enabled: isUuid(id),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: queryKeys.users.invitations,
    queryFn: getPendingInvitationsAction,
    staleTime: 1000 * 60 * 2,
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActiveAction(id, isActive),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.users.detail(variables.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: PortalUserRole }) =>
      setUserRoleAction(id, role),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.users.detail(variables.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useSendUserPasswordReset() {
  return useMutation({
    mutationFn: (id: string) => sendUserPasswordResetAction(id),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteUserAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.users.invitations,
      });
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}

export function useResendUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => resendUserInvitationAction(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.users.invitations,
      });
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}

export function useRevokeUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => revokeUserInvitationAction(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.users.invitations,
      });
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
