import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";

export default function InviteLandingPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Team invitations</CardTitle>
          <CardDescription>
            Invitations are sent by email. Open the link in the message to
            accept—it will look like{" "}
            <span className="font-mono text-xs">/invite/&lt;token&gt;</span> on
            this site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <FieldDescription className="text-center text-muted-foreground">
            If you lost the email, ask an administrator to send a new invite.
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  );
}
