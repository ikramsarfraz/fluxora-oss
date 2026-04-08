"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err } = await authClient.signIn.email({
      email: email.trim(),
      password,
      callbackURL: callbackUrl,
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "Sign in failed");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form className="card form-card" style={{ maxWidth: "400px" }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Sign in</h1>
      <div className="form-group">
        <label htmlFor="sign-in-email">Email</label>
        <input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="sign-in-password">Password</label>
        <input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="weight-label" style={{ marginTop: "1rem" }}>
        No account? <Link href="/sign-up">Sign up</Link>
      </p>
    </form>
  );
}
