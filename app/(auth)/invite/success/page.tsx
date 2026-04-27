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

export default function InviteSuccessPage() {
  return (
    <AuthCenteredShell>
      <Card className="w-full max-w-100 border-border shadow-[0_1px_3px_oklch(0_0_0/0.06),0_8px_24px_oklch(0_0_0/0.07)]">
        <CardHeader className="space-y-2 pb-5 text-center">
          <div
            className="mx-auto mb-2 flex size-9 items-center justify-center rounded-[9px] text-[0.8rem] font-extrabold text-white"
            style={{ background: "var(--primary)" }}
          >
            Fx
          </div>
          <CardTitle className="text-2xl tracking-tight text-foreground">
            Account created
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            You can sign in with the email from your invitation. If your
            organization requires email verification, check your inbox first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">Sign in to your workspace</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/"
              className="font-medium text-foreground underline underline-offset-[3px] transition hover:opacity-70"
            >
              Go to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}
