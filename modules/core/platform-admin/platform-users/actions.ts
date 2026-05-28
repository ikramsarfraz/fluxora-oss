"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import {
  invitePlatformUserByAdmin,
  resendPlatformUserInvitationByAdmin,
  revokePlatformUserInvitationByAdmin,
} from "@/modules/core/platform-admin/platform-users/services/invitations";
import {
  createPlatformUserByAdmin,
  updatePlatformUserByAdmin,
  type PlatformAdminUserRole,
} from "@/modules/core/platform-admin/services/platform-admin";

const platformUserRoleSchema = z.enum(["platform_admin", "support", "qa"]);

const createPlatformUserSchema = z.object({
  email: z.string().trim().min(3).max(255),
  role: platformUserRoleSchema,
});

const updatePlatformUserSchema = z.object({
  id: z.uuid(),
  role: platformUserRoleSchema,
  isActive: z.boolean(),
});

function revalidatePlatformUsers() {
  revalidatePath("/admin/platform-users");
}

export async function createPlatformUserAction(
  raw: z.input<typeof createPlatformUserSchema>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const input = createPlatformUserSchema.parse(raw);
    recordActionBreadcrumb({
      action: "platform_user.create",
      data: { role: input.role },
    });
    const created = await createPlatformUserByAdmin({
      email: input.email,
      role: input.role as PlatformAdminUserRole,
    });
    revalidatePlatformUsers();
    return { ok: true, id: created.id };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to add platform user.",
    };
  }
}

const invitePlatformUserSchema = z.object({
  email: z.string().trim().min(3).max(255),
  role: platformUserRoleSchema,
});

const invitationIdSchema = z.object({ id: z.uuid() });

export async function invitePlatformUserAction(
  raw: z.input<typeof invitePlatformUserSchema>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const input = invitePlatformUserSchema.parse(raw);
    const result = await invitePlatformUserByAdmin({
      email: input.email,
      role: input.role as PlatformAdminUserRole,
    });
    revalidatePlatformUsers();
    return { ok: true, id: result.id };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Failed to send platform invitation.",
    };
  }
}

export async function revokePlatformUserInvitationAction(
  raw: z.input<typeof invitationIdSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const input = invitationIdSchema.parse(raw);
    await revokePlatformUserInvitationByAdmin({ id: input.id });
    revalidatePlatformUsers();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to revoke invitation.",
    };
  }
}

export async function resendPlatformUserInvitationAction(
  raw: z.input<typeof invitationIdSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const input = invitationIdSchema.parse(raw);
    await resendPlatformUserInvitationByAdmin({ id: input.id });
    revalidatePlatformUsers();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to resend invitation.",
    };
  }
}

export async function updatePlatformUserAction(
  raw: z.input<typeof updatePlatformUserSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const input = updatePlatformUserSchema.parse(raw);
    recordActionBreadcrumb({
      action: "platform_user.update",
      data: { id: input.id, role: input.role, isActive: input.isActive },
    });
    await updatePlatformUserByAdmin({
      id: input.id,
      role: input.role as PlatformAdminUserRole,
      isActive: input.isActive,
    });
    revalidatePlatformUsers();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Failed to update platform user.",
    };
  }
}
