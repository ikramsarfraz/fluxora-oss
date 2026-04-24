"use client";

import { useState } from "react";

import { prepareGoogleAuthStartAction } from "@/actions/auth";
import { Google } from "@/components/icons/google";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import type {
  GoogleAuthMode,
  GoogleAuthSignupType,
} from "@/lib/google-auth-flow";

type GoogleAuthButtonProps = {
  label: string;
  mode: GoogleAuthMode;
  returnTo?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  signupType?: GoogleAuthSignupType | null;
  enabled: boolean;
  disabledReason?: string | null;
  className?: string;
  onError?: (message: string) => void;
};

export function GoogleAuthButton({
  label,
  mode,
  returnTo,
  tenantSlug,
  tenantName,
  signupType,
  enabled,
  disabledReason,
  className,
  onError,
}: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!enabled || disabledReason) {
      return;
    }

    setPending(true);
    try {
      const flow = await prepareGoogleAuthStartAction({
        mode,
        returnTo,
        tenantSlug,
        tenantName,
        signupType,
      });

      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: flow.callbackURL,
        newUserCallbackURL: flow.newUserCallbackURL,
        errorCallbackURL: flow.errorCallbackURL,
        requestSignUp: flow.requestSignUp,
        additionalData: flow.additionalData,
      });

      if (error) {
        onError?.(error.message ?? "Google sign-in failed");
      }
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Google sign-in failed",
      );
    } finally {
      setPending(false);
    }
  }

  const button = (
    <Button
      variant="outline"
      type="button"
      className={className}
      disabled={!enabled || Boolean(disabledReason) || pending}
      onClick={handleClick}
    >
      <Google className="size-4" />
      {pending ? "Connecting…" : label}
    </Button>
  );

  if (!disabledReason) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">{button}</span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
