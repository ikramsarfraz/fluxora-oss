"use server";

import {
  prepareGoogleAuthStart,
  discoverTenantsForEmail,
  completeUserOnboarding,
  getAccessibleDestinationsForAuthUser,
  sendRootSignupMagicLink,
  sendMagicLinkForCurrentLoginContext,
  sendTenantUserMagicLink,
  startEmailDestinationSelection,
} from "@/modules/shared/services/auth";

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

export async function sendRootSignupMagicLinkAction(
  input: Parameters<typeof sendRootSignupMagicLink>[0],
) {
  return await sendRootSignupMagicLink(input);
}

/** @deprecated */
export async function signUpAccountOnlyAction(
  input: Parameters<typeof sendRootSignupMagicLink>[0],
) {
  return await sendRootSignupMagicLink(input);
}

export async function sendForgotMagicLinkAction(
  input: Parameters<typeof sendMagicLinkForCurrentLoginContext>[0],
) {
  return await sendMagicLinkForCurrentLoginContext(input);
}

export async function sendSelfTenantSignInMagicLinkAction(
  input: Parameters<typeof sendTenantUserMagicLink>[0],
) {
  return await sendTenantUserMagicLink(input);
}

export async function completeUserOnboardingAction(
  input: Parameters<typeof completeUserOnboarding>[0],
) {
  return await completeUserOnboarding(input);
}
