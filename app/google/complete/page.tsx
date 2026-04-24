import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { finalizeGoogleAuthFlow } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function GoogleCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow } = await searchParams;

  if (!flow) {
    redirect("/login?error=google_missing_flow");
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/login?error=google_no_session");
  }

  let result: Awaited<ReturnType<typeof finalizeGoogleAuthFlow>>;
  try {
    result = await finalizeGoogleAuthFlow({
      flowToken: flow,
      authUserId: session.user.id,
      sessionId: session.session.id,
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  redirect(result.url);
}
