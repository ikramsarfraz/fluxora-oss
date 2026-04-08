import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <div className="main" style={{ padding: "2rem" }}>
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
