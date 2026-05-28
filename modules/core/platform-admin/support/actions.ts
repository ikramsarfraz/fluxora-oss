"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addPlatformSupportTicketUpdate,
  addTenantSupportTicketUpdate,
  assignPlatformSupportTicket,
  bulkAssignPlatformSupportTickets,
  bulkUpdatePlatformSupportTicketsStatus,
  createSupportTicket,
  SUPPORT_TICKET_STATUSES,
  updatePlatformSupportTicketStatus,
  uploadPlatformSupportTicketAttachment,
  uploadTenantSupportTicketAttachment,
  type CreateSupportTicketUpdateInput,
  type CreateSupportTicketInput,
  type SupportTicketStatus,
} from "@/modules/core/platform-admin/support/services/support";

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

const supportStatusValues = SUPPORT_TICKET_STATUSES.map(s => s.value) as [
  string,
  ...string[],
];

const bulkUpdateStatusSchema = z.object({
  ticketIds: z.array(z.uuid()).min(1).max(100),
  status: z.enum(supportStatusValues),
});

const bulkAssignSchema = z.object({
  ticketIds: z.array(z.uuid()).min(1).max(100),
  assignedPlatformUserId: z.union([z.uuid(), z.literal(null)]),
});

export async function bulkUpdateSupportTicketsStatusAction(
  raw: z.input<typeof bulkUpdateStatusSchema>,
): Promise<
  | { ok: true; updatedCount: number; skippedCount: number }
  | { ok: false; message: string }
> {
  try {
    const input = bulkUpdateStatusSchema.parse(raw);
    const result = await bulkUpdatePlatformSupportTicketsStatus({
      ticketIds: input.ticketIds,
      status: input.status as SupportTicketStatus,
    });
    revalidatePath("/admin/support");
    for (const id of input.ticketIds) {
      revalidatePath(`/admin/support/${id}`);
      revalidatePath(`/support/${id}`);
    }
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Bulk status update failed.",
    };
  }
}

export async function bulkAssignSupportTicketsAction(
  raw: z.input<typeof bulkAssignSchema>,
): Promise<
  | { ok: true; updatedCount: number; skippedCount: number }
  | { ok: false; message: string }
> {
  try {
    const input = bulkAssignSchema.parse(raw);
    const result = await bulkAssignPlatformSupportTickets({
      ticketIds: input.ticketIds,
      assignedPlatformUserId: input.assignedPlatformUserId,
    });
    revalidatePath("/admin/support");
    for (const id of input.ticketIds) {
      revalidatePath(`/admin/support/${id}`);
      revalidatePath(`/support/${id}`);
    }
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Bulk assignment failed.",
    };
  }
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
