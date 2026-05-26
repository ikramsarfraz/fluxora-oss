"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { authClient } from "@/lib/auth-client";
import {
  acceptInvitationRequest,
  fetchInvitationPreview,
  sendInvitationMagicLinkRequest,
  InvitationActionError,
} from "@/lib/api/invitations";
import { cn } from "@/lib/utils";
import type { InvitationPreviewFailureReason } from "@/modules/core/workspace-settings/services/invitations";

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

const ROLE_SURFACES: Record<string, { allow: string[]; deny: string[] }> = {
  owner: {
    allow: [
      "Inventory",
      "Sales orders",
      "Receiving",
      "Invoices",
      "Payments",
      "User management",
      "Billing & subscription",
    ],
    deny: [],
  },
  admin: {
    allow: [
      "Inventory",
      "Sales orders",
      "Receiving",
      "Invoices",
      "Payments",
      "User management",
    ],
    deny: ["Billing & subscription"],
  },
  dispatcher: {
    allow: ["Inventory", "Sales orders", "Receiving"],
    deny: ["Invoices", "Payments", "User management", "Billing"],
  },
  picker: {
    allow: ["Sales orders (assigned)", "Receiving"],
    deny: ["Inventory edit", "Invoices", "Payments", "User management"],
  },
  finance: {
    allow: ["Invoices", "Payments", "Reports"],
    deny: ["Inventory edit", "User management", "Receiving"],
  },
  auditor: {
    allow: ["Read-only across all surfaces", "Audit logs", "Reports"],
    deny: ["Any write actions"],
  },
};

function surfacesForRole(role: string) {
  return (
    ROLE_SURFACES[role.toLowerCase()] ?? {
      allow: ["Workspace access"],
      deny: [],
    }
  );
}

type InviteUserFormProps = {
  sessionEmail?: string | null;
};

const PREVIEW_FAILURE_COPY: Record<
  InvitationPreviewFailureReason,
  { title: string; body: string }
> = {
  not_found: {
    title: "Link not found",
    body: "The invitation link is invalid. Ask an administrator to send a new one.",
  },
  expired: {
    title: "Invite expired",
    body: "This link has passed its expiry. Ask an administrator to resend the invitation from Users.",
  },
  revoked: {
    title: "Invite revoked",
    body: "This invitation is no longer active. Ask for a new invite if you still need access.",
  },
  already_accepted: {
    title: "Already used",
    body: "This invitation was already accepted. Sign in to the workspace to continue.",
  },
  invalid: {
    title: "Invite unavailable",
    body: "This invitation cannot be used. Ask an administrator to send a new one.",
  },
};

export function InviteUserForm({ sessionEmail = null }: InviteUserFormProps) {
  const params = useParams();
  const searchParams = useSearchParams();

  const tokenFromPath =
    typeof params?.token === "string" ? params.token : null;
  const tokenFromQuery = searchParams.get("token");
  const token = tokenFromPath ?? tokenFromQuery;

  const queryError = searchParams.get("error");
  const fromMagicLink = searchParams.get("from") === "ml";

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [magicPending, setMagicPending] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [tab, setTab] = useState<"create" | "existing">("create");

  const invitationQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitationPreview(token!),
    enabled: Boolean(token),
  });

  async function onSendMagicLink() {
    if (!token) {
      setSubmitError(
        "Missing invite token. Open the full link from your invitation email.",
      );
      return;
    }
    setSubmitError(null);
    setMagicPending(true);
    try {
      await sendInvitationMagicLinkRequest({ token });
      setMagicSent(true);
    } catch (e) {
      if (e instanceof InvitationActionError) {
        if (e.code === "ALREADY_ACCEPTED" || e.code === "EXPIRED_OR_INVALID") {
          setSubmitError(
            e.message || "This invitation can no longer be accepted.",
          );
          return;
        }
        if (e.code === "REVOKED") {
          setSubmitError("This invitation was revoked.");
          return;
        }
      }
      setSubmitError(
        e instanceof Error ? e.message : "Could not send sign-in email",
      );
    } finally {
      setMagicPending(false);
    }
  }

  async function onJoinWorkspace() {
    if (!token) {
      setSubmitError(
        "Missing invite token. Open the full link from your invitation email.",
      );
      return;
    }
    setSubmitError(null);
    setJoinPending(true);
    try {
      const { redirectUrl } = await acceptInvitationRequest({ token });
      window.location.assign(redirectUrl);
    } catch (e) {
      if (e instanceof InvitationActionError) {
        if (e.code === "ALREADY_ACCEPTED" || e.code === "EXPIRED_OR_INVALID") {
          setSubmitError(
            e.message || "This invitation can no longer be accepted.",
          );
          return;
        }
        if (e.code === "REVOKED") {
          setSubmitError("This invitation was revoked.");
          return;
        }
        if (e.code === "SIGN_IN_REQUIRED") {
          setSubmitError("Sign in with the invited email, then try again.");
          return;
        }
        if (e.code === "EMAIL_MISMATCH") {
          setSubmitError(
            "You are signed in with a different email than this invite.",
          );
          return;
        }
      }
      setSubmitError(
        e instanceof Error ? e.message : "Could not join workspace.",
      );
    } finally {
      setJoinPending(false);
    }
  }

  async function onSignOutAndContinue() {
    setSubmitError(null);
    setSignOutPending(true);
    try {
      await authClient.signOut();
      window.location.reload();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not sign out.");
      setSignOutPending(false);
    }
  }

  // ── Edge states ────────────────────────────────────────────────────────

  if (queryError === "INVALID_TOKEN") {
    return (
      <ErrorCard
        title="Link invalid or expired"
        body="Ask an administrator to send you a new invitation."
      />
    );
  }
  if (!token) {
    return (
      <ErrorCard
        title="Missing invite link"
        body={
          <>
            Open the link from your email. It should look like{" "}
            <span className="font-mono text-[12.5px]">/invite/…</span>.
          </>
        }
      />
    );
  }
  if (invitationQuery.isPending) {
    return (
      <CenteredShell>
        <div className="flex w-full max-w-[520px] flex-col items-center gap-3 rounded-xl border-[0.5px] border-border-soft bg-card px-9 py-9 text-center">
          <span
            aria-hidden
            className="size-7 animate-[loading-spin_800ms_linear_infinite] rounded-full border-[2.5px] border-forest-tint-deep border-t-forest"
          />
          <p className="text-[14px] text-subtle">Loading your invitation…</p>
        </div>
      </CenteredShell>
    );
  }
  if (invitationQuery.isError) {
    return (
      <ErrorCard
        title="Could not load invite"
        body="Check your network and try again, or open the link from your email."
      />
    );
  }

  const preview = invitationQuery.data;
  if (!preview) return null;

  if (!preview.ok) {
    const copy = PREVIEW_FAILURE_COPY[preview.code];
    return <ErrorCard title={copy.title} body={copy.body} />;
  }

  const inviteEmail = preview.email.trim().toLowerCase();
  const sessionMismatch = Boolean(sessionEmail && sessionEmail !== inviteEmail);

  if (sessionMismatch) {
    return (
      <ErrorCard
        title="Wrong account"
        body={
          <>
            You are signed in as{" "}
            <span className="font-medium text-ink">{sessionEmail}</span> but
            this invite is for{" "}
            <span className="font-medium text-ink">{preview.email}</span>. Sign
            out and use the right account, or open this link in a private
            window.
          </>
        }
        action={
          <button
            type="button"
            onClick={onSignOutAndContinue}
            disabled={signOutPending}
            className="w-full rounded-md bg-forest px-4 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signOutPending ? "Signing out…" : "Sign out and continue"}
          </button>
        }
      />
    );
  }

  // ── Main state ─────────────────────────────────────────────────────────

  const sessionReady = Boolean(sessionEmail && sessionEmail === inviteEmail);
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const hostParts = hostname.split(".");
  const tenantSlug = hostParts[0] ?? "workspace";
  const rootDomain =
    hostParts.length > 1 ? hostParts.slice(1).join(".") : "fluxora.app";
  // Display name fallback: prettify slug ("acme-foods" → "Acme Foods").
  const tenantName = tenantSlug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "your workspace";
  const surfaces = surfacesForRole(preview.role);
  const accent = tenantAccent(tenantSlug);

  return (
    <div className="flex min-h-screen w-full flex-col bg-page text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[0.5px] border-border-soft bg-surface px-8 py-2.5 font-mono text-[11.5px] text-subtle">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="grid size-[14px] place-items-center rounded-sm font-sans text-[8px] font-semibold text-card-warm"
              style={{ background: "var(--color-forest)" }}
            >
              F
            </span>
            <span>{rootDomain}</span>
          </span>
          <span className="text-muted">/</span>
          <span className="font-medium text-ink">{tenantSlug}</span>
          <span className="text-muted">/</span>
          <span>invite</span>
          <span className="text-muted">/</span>
          <span className="text-muted">
            {token.length > 12 ? `${token.slice(0, 12)}…` : token}
          </span>
        </div>
      </div>

      <main className="flex flex-1 items-start justify-center px-6 py-12">
        <section className="w-full max-w-[520px] overflow-hidden rounded-xl border-[0.5px] border-border-soft bg-card shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]">
          {/* masthead */}
          <header
            className="relative flex flex-col items-center gap-3 px-9 pb-7 pt-9 text-center"
            style={{
              background: `linear-gradient(180deg, ${accent.tint} 0%, var(--color-card) 100%)`,
            }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-gold bg-card-warm px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-deep">
              <span aria-hidden>✦</span> You&apos;ve been invited
            </span>
            <span
              className="grid size-[60px] place-items-center rounded-md font-sans text-[24px] font-semibold leading-none text-card-warm"
              style={{ background: accent.mark }}
            >
              {tenantName.trim().charAt(0).toUpperCase()}
            </span>
            <h1 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
              Join <span style={{ color: accent.ink }}>{tenantName}</span> on
              Fluxora
            </h1>
            <p className="max-w-[380px] text-[13.5px] leading-[1.55] text-subtle">
              {preview.fullName
                ? `${preview.fullName} is being added`
                : "You're being added"}{" "}
              as a{" "}
              <span className="font-medium text-ink">
                {roleLabel(preview.role)}
              </span>{" "}
              with the surfaces below.
            </p>
          </header>

          <div className="flex flex-col gap-5 border-t-[0.5px] border-divider px-9 py-7">
            {/* Meta block */}
            <div className="flex flex-col divide-y divide-divider rounded-md border-[0.5px] border-border-soft bg-card-warm">
              <MetaRow label="From">
                <div className="text-[13px] font-medium text-ink">
                  {preview.fullName || "Workspace admin"}
                </div>
                <div className="font-mono text-[11.5px] text-subtle">
                  {tenantSlug}.{rootDomain}
                </div>
              </MetaRow>
              <MetaRow label="Invited as">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint px-2.5 py-0.5 text-[12px] font-medium text-forest">
                  <span className="size-1.5 rounded-full bg-forest" />
                  {roleLabel(preview.role)}
                </span>
              </MetaRow>
              <MetaRow label="Email">
                <span className="font-mono text-[12.5px] text-ink">
                  {preview.email}
                </span>
                <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-subtle">
                  🔒 Locked
                </span>
              </MetaRow>
              <MetaRow label="You'll see">
                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {surfaces.allow.map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-ink-warm">
                      <span className="text-success-fg">✓</span> {s}
                    </li>
                  ))}
                  {surfaces.deny.map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-subtle">
                      <span className="text-danger-fg">×</span> {s}
                    </li>
                  ))}
                </ul>
              </MetaRow>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-md border-[0.5px] border-border-soft bg-surface p-1">
              <button
                type="button"
                onClick={() => setTab("create")}
                className={cn(
                  "rounded-sm px-3 py-2 text-[12.5px] font-medium transition-colors",
                  tab === "create"
                    ? "bg-card text-ink shadow-[0_0.5px_0_rgba(26,26,20,0.04)]"
                    : "text-subtle hover:text-ink",
                )}
              >
                {sessionReady ? "Join with this account" : "Create new account"}
              </button>
              <button
                type="button"
                onClick={() => setTab("existing")}
                className={cn(
                  "rounded-sm px-3 py-2 text-[12.5px] font-medium transition-colors",
                  tab === "existing"
                    ? "bg-card text-ink shadow-[0_0.5px_0_rgba(26,26,20,0.04)]"
                    : "text-subtle hover:text-ink",
                )}
              >
                I already use Fluxora
              </button>
            </div>

            {fromMagicLink ? (
              <div className="rounded-md border-[0.5px] border-info-border bg-info-bg px-3 py-2.5 text-[12.5px] text-info-fg">
                <span className="font-medium">Signed in.</span> Tap{" "}
                <span className="font-medium">Join workspace</span> below when
                you&apos;re ready.
              </div>
            ) : null}
            {magicSent ? (
              <div className="rounded-md border-[0.5px] border-success-border bg-success-bg px-3 py-2.5 text-[12.5px] text-success-fg">
                <span className="font-medium">Check your email.</span> Sent a
                link to{" "}
                <span className="font-mono text-[11.5px]">{preview.email}</span>
                . Open it, then come back to this page.
              </div>
            ) : null}
            {submitError ? (
              <div className="rounded-md border-[0.5px] border-danger-border bg-danger-bg px-3 py-2.5 text-[12.5px] text-danger-fg">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {sessionReady ? (
                <>
                  <button
                    type="button"
                    onClick={onJoinWorkspace}
                    disabled={joinPending}
                    className="w-full rounded-md bg-forest px-4 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {joinPending
                      ? "Joining workspace…"
                      : `Accept & join ${tenantName}`}
                  </button>
                  <button
                    type="button"
                    onClick={onSendMagicLink}
                    disabled={magicPending}
                    className="w-full rounded-md border-[0.5px] border-border-default bg-card px-4 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card-warm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {magicPending ? "Sending…" : "Resend sign-in email"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onSendMagicLink}
                  disabled={magicPending}
                  className="w-full rounded-md bg-forest px-4 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {magicPending ? "Sending…" : "Email me a sign-in link"}
                </button>
              )}
              <Link
                href={`https://${rootDomain}/signin`}
                className="text-center text-[12.5px] text-subtle transition-colors hover:text-ink"
              >
                Decline — not for me
              </Link>
            </div>
          </div>

          <footer className="border-t-[0.5px] border-divider bg-card-warm px-9 py-4 text-center text-[11.5px] text-subtle">
            By accepting, you agree to {tenantName}&apos;s use of Fluxora and
            our{" "}
            <Link href="/terms" className="font-medium text-ink hover:underline">
              Terms
            </Link>
            .
          </footer>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-8 py-[18px] text-[12px] text-subtle">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-warm">
          <FluxoraMark size={16} />
          Powered by{" "}
          <Link
            href={`https://${rootDomain}/`}
            className="font-medium text-forest hover:underline"
          >
            Fluxora
          </Link>
        </span>
        <div className="flex gap-[18px]">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-[88px] shrink-0 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="flex items-center justify-between border-b-[0.5px] border-border-soft px-8 py-[18px]">
        <Link
          href="/"
          className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink transition-opacity hover:opacity-80"
        >
          <FluxoraMark size={28} />
          Fluxora
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}

function ErrorCard({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <CenteredShell>
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border-[0.5px] border-border-soft bg-card p-9 text-center shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-bg text-[18px] text-warning-fg">
          ⚠
        </span>
        <div>
          <h1 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-subtle">
            {body}
          </p>
        </div>
        {action ?? (
          <Link
            href="/signin"
            className="w-full rounded-md border-[0.5px] border-border-default bg-card px-4 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card-warm"
          >
            Back to sign in
          </Link>
        )}
      </div>
    </CenteredShell>
  );
}

const TENANT_ACCENT_PALETTE: { tint: string; ink: string; mark: string }[] = [
  { tint: "#F4E6C2", ink: "#6B4A0E", mark: "#6B4A0E" }, // mustard
  { tint: "#DCE5DD", ink: "#1F3A2E", mark: "#1F3A2E" }, // forest
  { tint: "#E0E8D5", ink: "#4A6B2F", mark: "#4A6B2F" }, // sage
  { tint: "#EDD4C9", ink: "#8B3415", mark: "#8B3415" }, // clay
];

function tenantAccent(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TENANT_ACCENT_PALETTE[hash % TENANT_ACCENT_PALETTE.length]!;
}
