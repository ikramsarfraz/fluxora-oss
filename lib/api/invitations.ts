import type { InvitationPreviewFailureReason } from "@/modules/core/workspace-settings/services/invitations";
import type { PortalUserRole } from "@/modules/shared/services/portal-users";
import { endpoints } from "./endpoints";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type InvitationPreviewSuccess = {
  ok: true;
  fullName: string;
  email: string;
  role: PortalUserRole;
};

export type InvitationPreviewError = {
  ok: false;
  code: InvitationPreviewFailureReason;
  detail: string;
};

export type InvitationPreviewResult =
  | InvitationPreviewSuccess
  | InvitationPreviewError;

export async function fetchInvitationPreview(
  token: string,
): Promise<InvitationPreviewResult> {
  const path = `${BASE}${endpoints.invitations.preview(token)}`;
  const res = await fetch(path, { credentials: "include" });
  const data = (await res.json()) as
    | { fullName: string; email: string; role: PortalUserRole }
    | { detail: string; code: InvitationPreviewFailureReason };

  if (!res.ok) {
    const failure = data as { detail: string; code: InvitationPreviewFailureReason };
    return {
      ok: false,
      code: failure.code,
      detail: failure.detail,
    };
  }

  const ok = data as { fullName: string; email: string; role: PortalUserRole };
  return { ok: true, ...ok };
}

export class InvitationActionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type AcceptInvitationResponse = {
  success: true;
  redirectUrl: string;
};

export async function sendInvitationMagicLinkRequest(body: {
  token: string;
}): Promise<{ success: true }> {
  const path = `${BASE}${endpoints.invitations.sendMagic()}`;
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    code?: string;
    success?: boolean;
  };
  if (!res.ok) {
    throw new InvitationActionError(
      typeof data.detail === "string" ? data.detail : res.statusText,
      typeof data.code === "string" ? data.code : "REJECTED",
      res.status,
    );
  }
  return { success: true };
}

export async function acceptInvitationRequest(body: {
  token: string;
}): Promise<AcceptInvitationResponse> {
  const path = `${BASE}${endpoints.invitations.accept()}`;
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    code?: string;
    success?: boolean;
    redirectUrl?: string;
  };
  if (!res.ok) {
    throw new InvitationActionError(
      typeof data.detail === "string" ? data.detail : res.statusText,
      typeof data.code === "string" ? data.code : "REJECTED",
      res.status,
    );
  }
  if (typeof data.redirectUrl !== "string" || !data.redirectUrl) {
    throw new Error("Invite accept response missing redirect URL.");
  }
  return { success: true, redirectUrl: data.redirectUrl };
}
