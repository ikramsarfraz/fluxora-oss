"use server";

import { revalidatePath } from "next/cache";

import {
  addPlatformSupportTicketUpdate,
  addTenantSupportTicketUpdate,
  assignPlatformSupportTicket,
  createSupportTicket,
  updatePlatformSupportTicketStatus,
  uploadPlatformSupportTicketAttachment,
  uploadTenantSupportTicketAttachment,
  type CreateSupportTicketUpdateInput,
  type CreateSupportTicketInput,
  type SupportTicketStatus,
} from "@/services/support";

async function fileFromFormData(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("File is required.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    originalFilename: file.name,
    mimeType: file.type || null,
    bytes,
  };
}

export async function createSupportTicketAction(input: CreateSupportTicketInput) {
  const ticket = await createSupportTicket(input);
  revalidatePath("/support");
  revalidatePath("/admin/support");
  return ticket;
}

export async function updateSupportTicketStatusAction(
  id: string,
  status: SupportTicketStatus,
) {
  const ticket = await updatePlatformSupportTicketStatus({ id, status });
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  return ticket;
}

export async function assignSupportTicketAction(
  id: string,
  assignedPlatformUserId: string | null,
) {
  const ticket = await assignPlatformSupportTicket({
    id,
    assignedPlatformUserId,
  });
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  return ticket;
}

export async function addPlatformSupportTicketUpdateAction(
  input: CreateSupportTicketUpdateInput,
) {
  const update = await addPlatformSupportTicketUpdate(input);
  revalidatePath("/support");
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${input.ticketId}`);
  revalidatePath(`/support/${input.ticketId}`);
  return update;
}

export async function addTenantSupportTicketUpdateAction(
  ticketId: string,
  message: string,
) {
  const update = await addTenantSupportTicketUpdate({ ticketId, message });
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath(`/support/${ticketId}`);
  return update;
}

export async function uploadTenantSupportTicketAttachmentAction(
  ticketId: string,
  updateId: string | null,
  formData: FormData,
) {
  const file = await fileFromFormData(formData);
  const attachment = await uploadTenantSupportTicketAttachment({
    ticketId,
    updateId,
    ...file,
  });
  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  return attachment;
}

export async function uploadPlatformSupportTicketAttachmentAction(
  ticketId: string,
  updateId: string | null,
  formData: FormData,
) {
  const file = await fileFromFormData(formData);
  const attachment = await uploadPlatformSupportTicketAttachment({
    ticketId,
    updateId,
    ...file,
  });
  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  return attachment;
}

