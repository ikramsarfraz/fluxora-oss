"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Preview =
  | { ok: true; email: string; role: string; expiresAt: string }
  | { ok: false; detail: string; code: string };

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function PlatformInviteForm({
  token,
  sessionEmail,
}: {
  token: string;
  sessionEmail: string | null;
}) {
  const searchParams = useSearchParams();
  const fromMagicLink = searchParams.get("from") === "ml";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [magicSent, setMagicSent] = useState(false);
  const [magicPending, setMagicPending] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // `previewLoading` is initialized to `true` so the loader shows on
    // first paint; we only need to flip it back to `false` on response.
    let cancelled = false;
    fetch(`/api/platform-invitations/${token}`, { method: "GET" })
      .then(async res => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setPreview({
            ok: true,
            email: data.email,
            role: data.role,
            expiresAt: data.expiresAt,
          });
        } else {
          setPreview({
            ok: false,
            detail: data.detail ?? "Invitation not available",
            code: data.code ?? "INVALID",
          });
        }
      })
      .catch(err => {
        if (cancelled) return;
        setPreview({
          ok: false,
          detail: err instanceof Error ? err.message : "Network error",
          code: "NETWORK",
        });
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSendMagicLink() {
    setSubmitError(null);
    setMagicPending(true);
    try {
      const res = await fetch("/api/platform-invitations/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Could not send sign-in email");
      }
      setMagicSent(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not send sign-in email",
      );
    } finally {
      setMagicPending(false);
    }
  }

  async function onAccept() {
    setSubmitError(null);
    setJoinPending(true);
    try {
      const res = await fetch("/api/platform-invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "Could not accept invitation");
      }
      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not accept invitation",
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
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not sign out",
      );
      setSignOutPending(false);
    }
  }

  if (previewLoading) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8">
          <span
            aria-hidden
            className="size-6 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
          />
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        </div>
      </Card>
    );
  }

  if (!preview || !preview.ok) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-foreground">
          This invitation isn&apos;t available
        </h1>
        <p className="text-sm text-muted-foreground">
          {preview?.detail ??
            "The link is invalid. Ask a platform admin to send a new one."}
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </Card>
    );
  }

  const inviteEmail = preview.email.trim().toLowerCase();
  const sessionMismatch = Boolean(sessionEmail && sessionEmail !== inviteEmail);
  const sessionReady = Boolean(sessionEmail && sessionEmail === inviteEmail);

  if (sessionMismatch) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-foreground">Wrong account</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{sessionEmail}</span>{" "}
          but this invite is for{" "}
          <span className="font-medium text-foreground">{preview.email}</span>.
          Sign out and use the right account, or open the link in a private
          window.
        </p>
        <Button
          type="button"
          onClick={onSignOutAndContinue}
          disabled={signOutPending}
        >
          {signOutPending ? "Signing out…" : "Sign out and continue"}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-1 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-forest">
          Platform admin invitation
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          You&apos;re invited as a {roleLabel(preview.role)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Accepting grants access to{" "}
          <code className="rounded bg-muted px-1 text-xs">
            admin.pelzer.solutions
          </code>{" "}
          (the internal admin console).
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="font-mono text-xs">{preview.email}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{roleLabel(preview.role)}</dd>
        <dt className="text-muted-foreground">Expires</dt>
        <dd>
          {new Date(preview.expiresAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </dd>
      </dl>

      {fromMagicLink ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          You&apos;re signed in. Tap <strong>Accept invitation</strong> below to
          activate your platform admin access.
        </p>
      ) : null}
      {magicSent ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          Check your email — a sign-in link is on its way to{" "}
          <span className="font-mono">{preview.email}</span>. Click it, then
          come back here to finish accepting.
        </p>
      ) : null}
      {submitError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {sessionReady ? (
          <Button
            type="button"
            onClick={onAccept}
            disabled={joinPending}
            size="lg"
          >
            {joinPending ? "Accepting…" : "Accept invitation"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSendMagicLink}
            disabled={magicPending}
            size="lg"
          >
            {magicPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-5 rounded-xl border bg-card p-8 shadow-sm">
      {children}
    </section>
  );
}
