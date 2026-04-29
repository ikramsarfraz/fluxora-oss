"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  acceptInvitationRequest,
  fetchInvitationPreview,
  sendInvitationMagicLinkRequest,
  InvitationActionError,
} from "@/lib/api/invitations";
import type { InvitationPreviewFailureReason } from "@/services/invitations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldDescription,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
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

  if (queryError === "INVALID_TOKEN") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
          <CardDescription>
            Ask an administrator to send you a new invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FieldDescription className="text-center">
            <Link href="/sign-in">Back to sign in</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Missing invite link</CardTitle>
          <CardDescription>
            Open the link from your email. It should look like{" "}
            <span className="font-mono text-xs">/invite/…</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild variant="outline">
            <Link href="/invite">About invitations</Link>
          </Button>
          <FieldDescription className="text-center">
            <Link href="/sign-in">Back to sign in</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  if (invitationQuery.isPending) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitation</CardTitle>
          <CardDescription>Loading your invitation…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invitationQuery.isError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Could not load invite</CardTitle>
          <CardDescription>
            Check your network and try again, or open the link from your
            email.
          </CardDescription>
        </CardHeader>
        <FieldDescription className="px-6 pb-6 text-center">
          <Link href="/sign-in">Back to sign in</Link>
        </FieldDescription>
      </Card>
    );
  }

  const preview = invitationQuery.data;
  if (!preview) {
    return null;
  }

  if (!preview.ok) {
    const copy = PREVIEW_FAILURE_COPY[preview.code];
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const inviteEmail = preview.email.trim().toLowerCase();
  const sessionMismatch = Boolean(
    sessionEmail && sessionEmail !== inviteEmail,
  );

  if (sessionMismatch) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            You are signed in as <span className="font-medium">{sessionEmail}</span>{" "}
            but this invite is for{" "}
            <span className="font-medium">{preview.email}</span>. Sign out and
            use the right account, or open this link in a private window.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full" variant="secondary">
            <Link href="/sign-in">Sign out and continue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sessionReady = Boolean(
    sessionEmail && sessionEmail === inviteEmail,
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          {sessionReady
            ? "You&apos;re signed in with the invited email. Join this workspace to finish."
            : "We&apos;ll email you a secure sign-in link for this address. Open the link from that email to sign in, then return here to join."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">{preview.fullName}</p>
          <p className="text-muted-foreground">{preview.email}</p>
          <div className="mt-2">
            <Badge variant="outline">{roleLabel(preview.role)}</Badge>
          </div>
        </div>
        {fromMagicLink ? (
          <Alert>
            <AlertTitle>Signed in</AlertTitle>
            <AlertDescription>
              If you landed here after your email link, tap{" "}
              <span className="font-medium">Join workspace</span> below when you
              are ready.
            </AlertDescription>
          </Alert>
        ) : null}
        {magicSent ? (
          <Alert className="border-emerald-200 bg-emerald-50">
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              We sent a link to{" "}
              <span className="font-medium">{preview.email}</span>. Open it, then come
              back to this page and use{" "}
              <span className="font-medium">Join workspace</span>.
            </AlertDescription>
          </Alert>
        ) : null}
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not continue</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-3">
          {sessionReady ? (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={joinPending}
                onClick={onJoinWorkspace}
              >
                {joinPending ? "Joining workspace…" : "Join workspace"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={magicPending}
                onClick={onSendMagicLink}
              >
                {magicPending ? "Sending…" : "Resend sign-in email"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={magicPending}
              onClick={onSendMagicLink}
            >
              {magicPending ? "Sending…" : "Email me a sign-in link"}
            </Button>
          )}
        </div>
        <FieldDescription className="text-center">
          <Link href="/sign-in">Back to sign in</Link>
        </FieldDescription>
      </CardContent>
    </Card>
  );
}
