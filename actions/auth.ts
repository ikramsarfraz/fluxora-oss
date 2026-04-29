"use server";

import {
  prepareGoogleAuthStart,
  discoverTenantsForEmail,
  completeUserOnboarding,
  getAccessibleDestinationsForAuthUser,
  signUpAccountOnly,
  startEmailDestinationSelection,
} from "@/services/auth";

export async function prepareGoogleAuthStartAction(
  input: Parameters<typeof prepareGoogleAuthStart>[0],
) {
  return await prepareGoogleAuthStart(input);
}

export async function discoverTenantsForEmailAction(
  input: Parameters<typeof discoverTenantsForEmail>[0],
) {
  return await discoverTenantsForEmail(input);
}

export async function startEmailDestinationSelectionAction(
  input: Parameters<typeof startEmailDestinationSelection>[0],
) {
  return await startEmailDestinationSelection(input);
}

export async function getAccessibleDestinationsForAuthUserAction(
  authUserId: string,
) {
  return await getAccessibleDestinationsForAuthUser(authUserId);
}

export async function signUpAccountOnlyAction(
  input: Parameters<typeof signUpAccountOnly>[0],
) {
  return await signUpAccountOnly(input);
}

export async function completeUserOnboardingAction(
  input: Parameters<typeof completeUserOnboarding>[0],
) {
  return await completeUserOnboarding(input);
}
