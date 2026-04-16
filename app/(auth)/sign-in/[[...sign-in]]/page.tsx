import { Suspense } from "react";
import { SignInForm } from "@/app/(auth)/sign-in/[[...sign-in]]/components/sign-in-form";

export default function SignInPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
