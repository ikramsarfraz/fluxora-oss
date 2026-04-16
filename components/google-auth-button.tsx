"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type GoogleAuthButtonProps = {
  callbackURL: string;
  label: string;
  onError?: (message: string) => void;
};

export function GoogleAuthButton({
  callbackURL,
  label,
  onError,
}: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (error) {
        onError?.(error.message ?? "Google sign-in failed");
      }
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : "Google sign-in failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      type="button"
      className="w-full"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? "Connecting…" : label}
    </Button>
  );
}
