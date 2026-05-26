"use client";

import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { sendSelfTenantSignInMagicLinkAction } from "@/modules/shared/actions";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  tenantSlug: string;
  displayName: string;
};

export function SendSignInLinkButton({ email, tenantSlug, displayName }: Props) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (pending) return;
    setPending(true);
    try {
      await sendSelfTenantSignInMagicLinkAction({
        tenantSlug,
        email,
        displayNameHint: displayName,
      });
      setSent(true);
      window.setTimeout(() => setSent(false), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send sign-in link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={pending || sent}
      aria-busy={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-[14px] py-[7px] text-[13px] font-medium leading-none transition-colors",
        sent
          ? "border-[0.5px] border-success-border bg-success-bg text-success-fg"
          : "border-[0.5px] border-transparent bg-forest text-card-warm hover:bg-forest-mid",
        (pending || sent) && "cursor-default",
      )}
    >
      {pending ? (
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <Mail size={13} strokeWidth={1.5} />
      )}
      <span>{sent ? "Link sent · check your inbox" : "Send sign-in link"}</span>
    </button>
  );
}
