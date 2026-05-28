import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  files,
  platformUsers,
  supportTicketAttachments,
  supportTicketUpdates,
  supportTickets,
} from "@/db/schema";
import {
  SUPPORT_ISSUE_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  supportTicketUpdateVisibilityLabel,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  type SupportIssueType,
  type SupportPriority,
  type SupportTicketStatus,
  type SupportTicketUpdateVisibility,
} from "@/lib/support/metadata";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  requirePlatformUser,
  requirePlatformUserInRoles,
} from "@/modules/core/platform-admin/services/platform-users";
import { PLATFORM_SUPPORT_ROLES } from "@/modules/core/platform-admin/support/permissions";

// Platform support functions accept admins and support staff. The
// admin/support permissions list is the single source of truth — when
// it changes (e.g. opening up to QA), every gated function follows.
const requirePlatformSupportUser = () =>
  requirePlatformUserInRoles(PLATFORM_SUPPORT_ROLES);
import {
  buildSupportTicketObjectKey,
  downloadFile,
  uploadFile,
} from "@/lib/uploads/r2";
import {
  notifyAssignedPlatformUser,
  notifyPlatformAdminsOfNewTicket,
  notifyTenantSubmitter,
} from "./support-notifications";

export {
  SUPPORT_ISSUE_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  supportIssueTypeLabel,
  supportPriorityLabel,
  supportTicketStatusLabel,
  supportTicketUpdateVisibilityLabel,
  type SupportIssueType,
  type SupportPriority,
  type SupportTicketStatus,
  type SupportTicketUpdateVisibility,
};

export interface CreateSupportTicketInput {
  name: string;
  email: string;
  issueType: SupportIssueType;
  priority: SupportPriority;
  subject: string;
  message: string;
  pageUrl?: string | null;
}

export interface ListSupportTicketsFilters {
  status?: SupportTicketStatus | "all";
  priority?: SupportPriority | "all";
  issueType?: SupportIssueType | "all";
  search?: string | null;
}

export interface CreateSupportTicketUpdateInput {
  ticketId: string;
  message: string;
  visibility: SupportTicketUpdateVisibility;
}

export interface UploadSupportTicketAttachmentInput {
  ticketId: string;
  updateId?: string | null;
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
}

const MAX_SUPPORT_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENT_FILENAME_LENGTH = 255;
const SUPPORT_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

function normalizeRequired(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function attachmentExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return SUPPORT_ATTACHMENT_EXTENSIONS.has(ext) ? ext : null;
}

function validateAttachment(input: UploadSupportTicketAttachmentInput) {
  const originalFilename = normalizeRequired(input.originalFilename, "Filename");
  if (originalFilename.length > MAX_SUPPORT_ATTACHMENT_FILENAME_LENGTH) {
    throw new Error("Filename is too long.");
  }
  if (/[\\/]/.test(originalFilename)) {
    throw new Error("Filename contains invalid characters.");
  }
  if (input.bytes.byteLength > MAX_SUPPORT_ATTACHMENT_BYTES) {
    throw new Error("Attachment must be 25 MB or smaller.");
  }
  const extension = attachmentExtension(originalFilename);
  if (!extension) {
    throw new Error(
      "Unsupported file type. Allowed: PDF, PNG, JPG, JPEG, WEBP, HEIC, CSV, TXT, DOC, DOCX, XLS, XLSX.",
    );
  }
  return { originalFilename, extension };
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  const name = normalizeRequired(input.name, "Name");
  const email = normalizeRequired(input.email, "Email");
  const subject = normalizeRequired(input.subject, "Subject");
  const message = normalizeRequired(input.message, "Message");

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      tenantId: tenant.id,
      portalUserId: portalUser.id,
      name,
      email,
      issueType: input.issueType,
      priority: input.priority,
      subject,
      message,
      pageUrl: normalizeOptional(input.pageUrl),
    })
    .returning();

  if (!ticket) {
    throw new Error("Failed to submit support ticket.");
  }

  await notifyPlatformAdminsOfNewTicket({
    ticketId: ticket.id,
    subject: ticket.subject,
    tenantName: tenant.name,
    submittedBy: `${name} <${email}>`,
  });

  return ticket;
}

export async function listTenantSupportTickets() {
  const tenant = await getCurrentTenant();

  return db.query.supportTickets.findMany({
    where: eq(supportTickets.tenantId, tenant.id),
    with: {
      attachments: true,
    },
    orderBy: [desc(supportTickets.createdAt)],
  });
}

export async function getTenantSupportTicketById(id: string) {
  const tenant = await getCurrentTenant();

  return (
    (await db.query.supportTickets.findFirst({
      where: and(eq(supportTickets.id, id), eq(supportTickets.tenantId, tenant.id)),
      with: {
        attachments: {
          with: { file: true },
          orderBy: [desc(supportTicketAttachments.createdAt)],
        },
        assignedPlatformUser: {
          with: {
            authUser: true,
          },
        },
        updates: {
          where: eq(supportTicketUpdates.visibility, "tenant_visible"),
          with: {
            attachments: {
              with: { file: true },
              orderBy: [desc(supportTicketAttachments.createdAt)],
            },
            authorPlatformUser: {
              with: {
                authUser: true,
              },
            },
            authorPortalUser: true,
          },
          orderBy: [desc(supportTicketUpdates.createdAt)],
        },
      },
    })) ?? null
  );
}

export async function addTenantSupportTicketUpdate(
  input: Omit<CreateSupportTicketUpdateInput, "visibility">,
) {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const ticket = await db.query.supportTickets.findFirst({
    where: and(
      eq(supportTickets.id, input.ticketId),
      eq(supportTickets.tenantId, tenant.id),
    ),
  });

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  const message = normalizeRequired(input.message, "Message");
  const [update] = await db
    .insert(supportTicketUpdates)
    .values({
      ticketId: ticket.id,
      authorType: "portal_user",
      authorPortalUserId: portalUser.id,
      message,
      visibility: "tenant_visible",
    })
    .returning();

  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id));

  return update;
}

function buildPlatformSupportTicketWhere(
  filters: ListSupportTicketsFilters,
): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(supportTickets.status, filters.status));
  }
  if (filters.priority && filters.priority !== "all") {
    conditions.push(eq(supportTickets.priority, filters.priority));
  }
  if (filters.issueType && filters.issueType !== "all") {
    conditions.push(eq(supportTickets.issueType, filters.issueType));
  }
  const search = filters.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const match = or(
      ilike(supportTickets.subject, like),
      ilike(supportTickets.message, like),
      ilike(supportTickets.email, like),
      ilike(supportTickets.name, like),
    );
    if (match) conditions.push(match);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listPlatformSupportTickets(
  filters: ListSupportTicketsFilters = {},
  pagination?: { limit?: number; offset?: number },
) {
  await requirePlatformSupportUser();

  return db.query.supportTickets.findMany({
    where: buildPlatformSupportTicketWhere(filters),
    with: {
      tenant: true,
      portalUser: true,
      attachments: {
        with: { file: true },
        orderBy: [desc(supportTicketAttachments.createdAt)],
      },
      assignedPlatformUser: {
        with: {
          authUser: true,
        },
      },
    },
    orderBy: [desc(supportTickets.createdAt)],
    limit: pagination?.limit,
    offset: pagination?.offset,
  });
}

export async function countPlatformSupportTickets(
  filters: ListSupportTicketsFilters = {},
): Promise<number> {
  await requirePlatformSupportUser();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(buildPlatformSupportTicketWhere(filters));
  return row?.count ?? 0;
}

export async function getPlatformSupportTicketById(id: string) {
  await requirePlatformSupportUser();

  return (
    (await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, id),
      with: {
        tenant: true,
        portalUser: true,
        assignedPlatformUser: {
          with: {
            authUser: true,
          },
        },
        attachments: {
          with: { file: true },
          orderBy: [desc(supportTicketAttachments.createdAt)],
        },
        updates: {
          with: {
            attachments: {
              with: { file: true },
              orderBy: [desc(supportTicketAttachments.createdAt)],
            },
            authorPlatformUser: {
              with: {
                authUser: true,
              },
            },
            authorPortalUser: true,
          },
          orderBy: [desc(supportTicketUpdates.createdAt)],
        },
      },
    })) ?? null
  );
}

export async function listAssignablePlatformUsers() {
  await requirePlatformSupportUser();

  return db.query.platformUsers.findMany({
    where: eq(platformUsers.isActive, true),
    with: {
      authUser: true,
    },
    orderBy: [desc(platformUsers.createdAt)],
  });
}

export async function assignPlatformSupportTicket(input: {
  id: string;
  assignedPlatformUserId: string | null;
}) {
  await requirePlatformSupportUser();

  if (input.assignedPlatformUserId) {
    const assignee = await db.query.platformUsers.findFirst({
      where: and(
        eq(platformUsers.id, input.assignedPlatformUserId),
        eq(platformUsers.isActive, true),
      ),
    });
    if (!assignee) {
      throw new Error("Assigned platform user not found.");
    }
  }

  const [updated] = await db
    .update(supportTickets)
    .set({
      assignedPlatformUserId: input.assignedPlatformUserId,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, input.id))
    .returning();

  if (!updated) {
    throw new Error("Support ticket not found.");
  }

  if (input.assignedPlatformUserId) {
    const assigned = await db.query.platformUsers.findFirst({
      where: eq(platformUsers.id, input.assignedPlatformUserId),
      with: { authUser: true },
    });
    await notifyAssignedPlatformUser({
      email: assigned?.authUser.email,
      ticketId: updated.id,
      subject: updated.subject,
    });
  }

  return updated;
}

export async function addPlatformSupportTicketUpdate(
  input: CreateSupportTicketUpdateInput,
) {
  const platformUser = await requirePlatformSupportUser();
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, input.ticketId),
  });

  if (!ticket) {
    throw new Error("Support ticket not found.");
  }

  const message = normalizeRequired(input.message, "Message");
  const [update] = await db
    .insert(supportTicketUpdates)
    .values({
      ticketId: ticket.id,
      authorType: "platform_user",
      authorPlatformUserId: platformUser.id,
      message,
      visibility: input.visibility,
    })
    .returning();

  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id));

  if (input.visibility === "tenant_visible") {
    await notifyTenantSubmitter({
      email: ticket.email,
      subject: `Support ticket update: ${ticket.subject}`,
      message,
    });
  }

  return update;
}

export async function updatePlatformSupportTicketStatus(input: {
  id: string;
  status: SupportTicketStatus;
}) {
  await requirePlatformSupportUser();

  const [updated] = await db
    .update(supportTickets)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, input.id))
    .returning();

  if (!updated) {
    throw new Error("Support ticket not found.");
  }

  await notifyTenantSubmitter({
    email: updated.email,
    subject: `Support ticket status updated: ${updated.subject}`,
    message: `Your support ticket status is now ${supportTicketStatusLabel(input.status)}.`,
  });

  return updated;
}

export type BulkSupportTicketsResult = {
  updatedCount: number;
  skippedCount: number;
};

/**
 * Multi-ticket status change. Skips tickets that already match the
 * target status so a re-submit isn't destructive. Tenant-side
 * notifications are sent best-effort per affected ticket; a failed
 * email doesn't roll back the status update (matches the single-row
 * helper's semantics).
 */
export async function bulkUpdatePlatformSupportTicketsStatus(args: {
  ticketIds: string[];
  status: SupportTicketStatus;
}): Promise<BulkSupportTicketsResult> {
  await requirePlatformSupportUser();

  const uniqueIds = Array.from(new Set(args.ticketIds));
  if (uniqueIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  const existing = await db.query.supportTickets.findMany({
    where: inArray(supportTickets.id, uniqueIds),
  });
  const toUpdate = existing.filter(t => t.status !== args.status);
  if (toUpdate.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: existing.length,
    };
  }

  const now = new Date();
  await db
    .update(supportTickets)
    .set({ status: args.status, updatedAt: now })
    .where(
      inArray(
        supportTickets.id,
        toUpdate.map(t => t.id),
      ),
    );

  // Notify each tenant submitter. Run sequentially to keep the
  // transport polite + simple — bulk operations are bounded to ~100
  // tickets by the action-layer schema so this stays well under a
  // second in practice.
  for (const ticket of toUpdate) {
    await notifyTenantSubmitter({
      email: ticket.email,
      subject: `Support ticket status updated: ${ticket.subject}`,
      message: `Your support ticket status is now ${supportTicketStatusLabel(
        args.status,
      )}.`,
    });
  }

  return {
    updatedCount: toUpdate.length,
    skippedCount: existing.length - toUpdate.length,
  };
}

/**
 * Multi-ticket assignment. `assignedPlatformUserId = null` clears the
 * assignee on every selected ticket; passing a uuid validates the
 * assignee is an active platform user once, then writes all rows in
 * one transaction. Tickets already pointing at the same assignee skip.
 */
export async function bulkAssignPlatformSupportTickets(args: {
  ticketIds: string[];
  assignedPlatformUserId: string | null;
}): Promise<BulkSupportTicketsResult> {
  await requirePlatformSupportUser();

  const uniqueIds = Array.from(new Set(args.ticketIds));
  if (uniqueIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  if (args.assignedPlatformUserId) {
    const assignee = await db.query.platformUsers.findFirst({
      where: and(
        eq(platformUsers.id, args.assignedPlatformUserId),
        eq(platformUsers.isActive, true),
      ),
      with: { authUser: true },
    });
    if (!assignee) {
      throw new Error("Assigned platform user not found.");
    }

    const existing = await db.query.supportTickets.findMany({
      where: inArray(supportTickets.id, uniqueIds),
    });
    const toUpdate = existing.filter(
      t => t.assignedPlatformUserId !== args.assignedPlatformUserId,
    );
    if (toUpdate.length === 0) {
      return { updatedCount: 0, skippedCount: existing.length };
    }

    const now = new Date();
    await db
      .update(supportTickets)
      .set({
        assignedPlatformUserId: args.assignedPlatformUserId,
        updatedAt: now,
      })
      .where(
        inArray(
          supportTickets.id,
          toUpdate.map(t => t.id),
        ),
      );

    // Single notification email per assignee — they don't need one per
    // ticket. Best-effort, mirrors the single-row helper.
    await notifyAssignedPlatformUser({
      email: assignee.authUser.email,
      ticketId: toUpdate[0]!.id,
      subject: `${toUpdate.length} support ticket${
        toUpdate.length === 1 ? "" : "s"
      } assigned to you`,
    });

    return {
      updatedCount: toUpdate.length,
      skippedCount: existing.length - toUpdate.length,
    };
  }

  // Unassign path — no assignee validation, no email.
  const existing = await db.query.supportTickets.findMany({
    where: inArray(supportTickets.id, uniqueIds),
  });
  const toUpdate = existing.filter(t => t.assignedPlatformUserId !== null);
  if (toUpdate.length === 0) {
    return { updatedCount: 0, skippedCount: existing.length };
  }

  const now = new Date();
  await db
    .update(supportTickets)
    .set({ assignedPlatformUserId: null, updatedAt: now })
    .where(
      inArray(
        supportTickets.id,
        toUpdate.map(t => t.id),
      ),
    );

  return {
    updatedCount: toUpdate.length,
    skippedCount: existing.length - toUpdate.length,
  };
}

async function loadTenantTicketForAttachment(ticketId: string) {
  const [tenant, portalUser] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.tenantId, tenant.id)),
  });
  if (!ticket) throw new Error("Support ticket not found.");
  return { tenant, portalUser, ticket };
}

async function loadPlatformTicketForAttachment(ticketId: string) {
  const platformUser = await requirePlatformSupportUser();
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, ticketId),
  });
  if (!ticket) throw new Error("Support ticket not found.");
  return { platformUser, ticket };
}

async function insertSupportAttachment(args: {
  tenantId: string;
  ticketId: string;
  updateId?: string | null;
  uploadedByType: "portal_user" | "platform_user";
  uploadedById: string;
  portalUploadedByUserId?: string | null;
  input: UploadSupportTicketAttachmentInput;
}) {
  const { originalFilename, extension } = validateAttachment(args.input);
  const mimeType = args.input.mimeType?.trim() || "application/octet-stream";

  return db.transaction(async tx => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        tenantId: args.tenantId,
        category: "support_ticket_attachment",
        storageProvider: "r2",
        status: "ready",
        objectKey: "pending",
        originalFilename,
        mimeType,
        extension,
        sizeBytes: args.input.bytes.byteLength,
        uploadedByUserId: args.portalUploadedByUserId ?? null,
        metadataJson: JSON.stringify({
          supportTicketId: args.ticketId,
          supportTicketUpdateId: args.updateId ?? null,
          uploadedByType: args.uploadedByType,
        }),
      })
      .returning();
    if (!fileRow) throw new Error("Failed to create file record.");

    const objectKey = buildSupportTicketObjectKey({
      tenantId: args.tenantId,
      ticketId: args.ticketId,
      fileId: fileRow.id,
      extension,
    });

    await tx.update(files).set({ objectKey }).where(eq(files.id, fileRow.id));

    const [attachment] = await tx
      .insert(supportTicketAttachments)
      .values({
        ticketId: args.ticketId,
        updateId: args.updateId ?? null,
        uploadedByType: args.uploadedByType,
        uploadedById: args.uploadedById,
        fileId: fileRow.id,
      })
      .returning();
    if (!attachment) throw new Error("Failed to create attachment record.");

    await uploadFile({
      objectKey,
      body: args.input.bytes,
      contentType: mimeType,
      contentLength: args.input.bytes.byteLength,
    });

    return { ...attachment, file: { ...fileRow, objectKey } };
  });
}

export async function uploadTenantSupportTicketAttachment(
  input: UploadSupportTicketAttachmentInput,
) {
  const { tenant, portalUser, ticket } = await loadTenantTicketForAttachment(
    input.ticketId,
  );
  return insertSupportAttachment({
    tenantId: tenant.id,
    ticketId: ticket.id,
    updateId: input.updateId ?? null,
    uploadedByType: "portal_user",
    uploadedById: portalUser.id,
    portalUploadedByUserId: portalUser.id,
    input,
  });
}

export async function uploadPlatformSupportTicketAttachment(
  input: UploadSupportTicketAttachmentInput,
) {
  const { platformUser, ticket } = await loadPlatformTicketForAttachment(
    input.ticketId,
  );
  return insertSupportAttachment({
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    updateId: input.updateId ?? null,
    uploadedByType: "platform_user",
    uploadedById: platformUser.id,
    input,
  });
}

export async function getSupportTicketAttachmentDownload(args: {
  ticketId: string;
  fileId: string;
}) {
  let tenantId: string | null = null;
  try {
    const tenant = await getCurrentTenant();
    tenantId = tenant.id;
  } catch {
    await requirePlatformUser();
  }

  const attachment = await db.query.supportTicketAttachments.findFirst({
    where: and(
      eq(supportTicketAttachments.ticketId, args.ticketId),
      eq(supportTicketAttachments.fileId, args.fileId),
    ),
    with: {
      ticket: true,
      file: true,
    },
  });
  if (!attachment) throw new Error("Attachment not found.");
  if (tenantId && attachment.ticket.tenantId !== tenantId) {
    throw new Error("Forbidden");
  }

  const bytes = await downloadFile(attachment.file.objectKey);
  return {
    bytes,
    mimeType: attachment.file.mimeType ?? "application/octet-stream",
    originalFilename: attachment.file.originalFilename ?? "attachment",
    sizeBytes: attachment.file.sizeBytes ?? bytes.byteLength,
  };
}

export type PlatformSupportTicketListItem = Awaited<
  ReturnType<typeof listPlatformSupportTickets>
>[number];

export type PlatformSupportTicketDetail = NonNullable<
  Awaited<ReturnType<typeof getPlatformSupportTicketById>>
>;

export type TenantSupportTicketListItem = Awaited<
  ReturnType<typeof listTenantSupportTickets>
>[number];

export type TenantSupportTicketDetail = NonNullable<
  Awaited<ReturnType<typeof getTenantSupportTicketById>>
>;

export type AssignablePlatformUser = Awaited<
  ReturnType<typeof listAssignablePlatformUsers>
>[number];
