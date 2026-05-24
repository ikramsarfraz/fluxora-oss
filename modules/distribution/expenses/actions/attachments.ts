"use server";

import {
  getExpenseAttachmentDownloadUrl,
  listExpenseAttachments,
  removeExpenseAttachment,
  uploadExpenseAttachment,
  type UploadExpenseAttachmentInput,
} from "../services/expense-attachments";

/**
 * Server action used by the receipt-upload widget. The browser converts the
 * picked File to an ArrayBuffer (via FormData parsing) and the action wraps
 * it as a Buffer before handing to the service. Tenancy + role gating is
 * inside the service.
 */
export async function uploadExpenseAttachmentAction(input: {
  expenseId: string;
  bytes: ArrayBuffer;
  originalFilename: string;
  mimeType: string | null;
}) {
  const buffer = Buffer.from(input.bytes);
  const serviceInput: UploadExpenseAttachmentInput = {
    expenseId: input.expenseId,
    bytes: buffer,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
  };
  return uploadExpenseAttachment(serviceInput);
}

export async function listExpenseAttachmentsAction(expenseId: string) {
  return listExpenseAttachments(expenseId);
}

export async function getExpenseAttachmentDownloadUrlAction(input: {
  expenseId: string;
  fileId: string;
}) {
  return getExpenseAttachmentDownloadUrl(input);
}

export async function removeExpenseAttachmentAction(input: {
  expenseId: string;
  fileId: string;
}) {
  return removeExpenseAttachment(input);
}
