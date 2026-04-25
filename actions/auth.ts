"use server";

import {
  prepareGoogleAuthStart,
  discoverTenantsForEmail,
  getAccessibleDestinationsForAuthUser,
  signUpBusinessTenantAccount,
  signUpSoloTenantAccount,
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

export async function signUpBusinessTenantAccountAction(
  input: Parameters<typeof signUpBusinessTenantAccount>[0],
) {
  return await signUpBusinessTenantAccount(input);
}

export async function signUpSoloTenantAccountAction(
  input: Parameters<typeof signUpSoloTenantAccount>[0],
) {
  return await signUpSoloTenantAccount(input);
}
