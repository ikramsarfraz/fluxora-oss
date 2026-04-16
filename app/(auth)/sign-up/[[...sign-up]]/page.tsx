import { Suspense } from "react";
import { SignUpForm } from "@/app/(auth)/sign-up/[[...sign-up]]/components/sign-up-form";

export default function SignUpPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
