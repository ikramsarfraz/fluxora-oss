"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  INVITATION_EXPIRY_DAYS_DEFAULT,
  INVITATION_EXPIRY_DAYS_MAX,
  INVITATION_EXPIRY_DAYS_MIN,
} from "@/lib/invitation-expiry";

import { updateInvitationExpiryDaysAction } from "@/modules/core/workspace-settings/actions";

/**
 * Tenant-admin card to tighten or extend the invite-link live window
 * (#236). Sits on the Team → Members page next to the user list because
 * that's where invitations get sent. Owner+admin only — the
 * underlying server action gates on `requireAdminPortalUser()`, this
 * card is just the UI surface for that path.
 *
 * Empty input + Save clears the override so the codebase default
 * (7 days) takes over again. Numbers outside [1, 30] are accepted on
 * input but the server clamps them on write; the form still uses
 * native `min`/`max` so most browsers nudge the user toward the band
 * before submit.
 */
export function InvitationExpiryCard({
  currentValue,
}: {
  /** The tenant row's `invitation_expiry_days` column. Null means the
   *  tenant hasn't set an override yet (the form shows it as empty,
   *  with the default surfaced in the helper text). */
  currentValue: number | null;
}) {
  const [draft, setDraft] = useState<string>(
    currentValue == null ? "" : String(currentValue),
  );
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    // Empty input → null payload → clears the override.
    const parsed = trimmed.length === 0 ? null : Number(trimmed);
    if (parsed != null && !Number.isFinite(parsed)) {
      toast.error("Enter a number between 1 and 30.");
      return;
    }
    startTransition(async () => {
      try {
        await updateInvitationExpiryDaysAction({
          invitationExpiryDays: parsed,
        });
        toast.success(
          parsed == null
            ? `Cleared — invitations now expire after ${INVITATION_EXPIRY_DAYS_DEFAULT} days (the default).`
            : `Invitations will now expire after ${parsed} day${parsed === 1 ? "" : "s"}.`,
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save the setting.",
        );
      }
    });
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle className="text-base">Invitation expiry</CardTitle>
          <CardDescription>
            How long a fresh invite link stays valid before it expires.
            Tighten this for sensitive tenants so a leaked link has a
            smaller live window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="invitation-expiry-days"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Days until expiry
              </label>
              <Input
                id="invitation-expiry-days"
                type="number"
                inputMode="numeric"
                min={INVITATION_EXPIRY_DAYS_MIN}
                max={INVITATION_EXPIRY_DAYS_MAX}
                step={1}
                placeholder={String(INVITATION_EXPIRY_DAYS_DEFAULT)}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={isPending}
                className="w-32 tabular-nums"
              />
            </div>
            <p className="pb-2 text-[12px] leading-[1.5] text-muted-foreground">
              {currentValue == null
                ? `Using the default (${INVITATION_EXPIRY_DAYS_DEFAULT} days).`
                : `Current: ${currentValue} day${currentValue === 1 ? "" : "s"}.`}
              {" "}Allowed range is {INVITATION_EXPIRY_DAYS_MIN}–{INVITATION_EXPIRY_DAYS_MAX} days.
              Leave blank to revert to the default.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
