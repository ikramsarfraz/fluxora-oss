import Link from "next/link";

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

export default function InviteSuccessPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account created</CardTitle>
          <CardDescription>
            You can sign in with the email from your invitation. If your
            organization requires email verification, check your inbox first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <FieldDescription className="text-center">
            <Link href="/">Go to home</Link>
          </FieldDescription>
        </CardContent>
      </Card>
    </div>
  );
}
