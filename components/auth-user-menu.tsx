"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthUserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <span className="text-sm opacity-70">…</span>;
  }

  if (!session?.user) {
    return (
      <Link href="/sign-in" className="btn btn-secondary">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm opacity-90" title={session.user.email ?? ""}>
        {session.user.name || session.user.email}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
