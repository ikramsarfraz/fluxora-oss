"use client";

import Link from "next/link";

import { AuthCenteredShell } from "@/app/(auth)/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const cardClass =
  "w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]";

export function ResetPasswordForm() {
  return (
    <AuthCenteredShell topLabel="Back to" topHref="/login" topAction="Sign in">
      <Card className={cardClass}>
        <CardHeader className="space-y-2 pb-5 text-center">
          <div
            className="mx-auto mb-2 flex size-9 items-center justify-center rounded-[9px] text-[0.8rem] font-extrabold text-white"
            style={{ background: "var(--primary)" }}
          >
            Fx
          </div>
          <CardTitle className="text-2xl tracking-tight text-foreground">
            Sign-in links only
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Password resets are disabled. Choose &quot;Email me a sign-in link&quot;
            on sign-in, or use the email link helper if you landed here from an old
            reset email URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Go to email link helper</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}
