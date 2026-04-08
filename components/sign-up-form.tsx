"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "Sign up failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form className="card form-card" style={{ maxWidth: "400px" }} onSubmit={onSubmit}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Create account</h1>
      <div className="form-group">
        <label htmlFor="sign-up-name">Name</label>
        <input
          id="sign-up-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="sign-up-email">Email</label>
        <input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="sign-up-password">Password</label>
        <input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="weight-label" style={{ marginTop: "1rem" }}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
