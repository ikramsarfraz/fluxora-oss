import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { composeFullName, splitLooseDisplayName } from "@/lib/user-display-name";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Sets initial display fields for a newly created Better Auth user.
 * Exact first/last for self-serve signups come from `/onboarding` after sign-in.
 */
export async function bootstrapAuthUserIdentityOnCreate(input: {
  userId: string;
  emailLower: string;
  /** Initial `name` from Better Auth (magic link empty, OAuth fuller). */
  initialName: string;
}) {
  const emailLower = normalizeEmail(input.emailLower);

  const splitFromInitial = splitLooseDisplayName(input.initialName.trim());
  let firstName = splitFromInitial.firstName || null;
  let lastName = splitFromInitial.lastName || null;
  let fullName =
    composeFullName(firstName ?? "", lastName ?? "") || input.initialName.trim();

  if (!fullName) {
    fullName = emailLower.split("@")[0] ?? "User";
    const split = splitLooseDisplayName(fullName);
    firstName = split.firstName || fullName;
    lastName = split.lastName ?? "";
  }

  await db
    .update(user)
    .set({
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      fullName,
      name: fullName,
      updatedAt: new Date(),
    })
    .where(eq(user.id, input.userId));
}
