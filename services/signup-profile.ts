import { addMinutes } from "date-fns";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { signupProfilePending } from "@/db/schema";
import { composeFullName, splitLooseDisplayName } from "@/lib/user-display-name";

export type SignupIdentityInput = {
  firstName: string;
  lastName: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertSignupProfilePending(
  input: SignupIdentityInput & { email: string },
) {
  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const full = composeFullName(first, last);
  if (!full) {
    throw new Error("Please enter your first and last name.");
  }
  const emailLower = normalizeEmail(input.email);

  await db
    .insert(signupProfilePending)
    .values({
      emailLower,
      firstName: first,
      lastName: last,
      fullName: full,
      expiresAt: addMinutes(new Date(), 60 * 24),
    })
    .onConflictDoUpdate({
      target: signupProfilePending.emailLower,
      set: {
        firstName: first,
        lastName: last,
        fullName: full,
        expiresAt: addMinutes(new Date(), 60 * 24),
      },
    });
}

export async function applyPendingIdentityToNewUser(input: {
  userId: string;
  emailLower: string;
  /** Initial `name` from Better Auth (e.g. magic link or OAuth). */
  initialName: string;
}) {
  const emailLower = normalizeEmail(input.emailLower);
  const pending = await db.query.signupProfilePending.findFirst({
    where: eq(signupProfilePending.emailLower, emailLower),
  });

  let firstName = pending?.firstName?.trim() ?? null;
  let lastName = pending?.lastName?.trim() ?? null;
  let fullName =
    pending?.fullName?.trim() || composeFullName(firstName ?? "", lastName ?? "");

  if (!fullName) {
    const split = splitLooseDisplayName(input.initialName.trim());
    firstName = split.firstName || null;
    lastName = split.lastName || null;
    fullName = composeFullName(firstName ?? "", lastName ?? "") || input.initialName.trim();
  }

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

  if (pending) {
    await db
      .delete(signupProfilePending)
      .where(eq(signupProfilePending.emailLower, emailLower));
  }
}

export async function deleteExpiredSignupProfiles() {
  await db
    .delete(signupProfilePending)
    .where(lt(signupProfilePending.expiresAt, new Date()));
}
