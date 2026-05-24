"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getExpenseAttachmentDownloadUrlAction,
  listExpenseAttachmentsAction,
  removeExpenseAttachmentAction,
  uploadExpenseAttachmentAction,
} from "@/modules/distribution/expenses/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

export function useExpenseAttachments(expenseId: string) {
  return useQuery({
    queryKey: queryKeys.expenses.attachments(expenseId),
    queryFn: () => listExpenseAttachmentsAction(expenseId),
    enabled: isUuid(expenseId),
    staleTime: 1000 * 30,
  });
}

export function useUploadExpenseAttachment(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const bytes = await file.arrayBuffer();
      return uploadExpenseAttachmentAction({
        expenseId,
        bytes,
        originalFilename: file.name,
        mimeType: file.type || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.attachments(expenseId),
      });
    },
  });
}

export function useRemoveExpenseAttachment(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      removeExpenseAttachmentAction({ expenseId, fileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.attachments(expenseId),
      });
    },
  });
}

export async function openExpenseAttachmentDownload(input: {
  expenseId: string;
  fileId: string;
}): Promise<void> {
  const url = await getExpenseAttachmentDownloadUrlAction(input);
  // Open in a new tab so the receipt viewer (PDF / image) loads outside
  // the app; the signed URL is short-lived so we can't link to it long-term.
  window.open(url, "_blank", "noopener,noreferrer");
}
