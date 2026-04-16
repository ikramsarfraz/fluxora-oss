import { Suspense } from "react";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
