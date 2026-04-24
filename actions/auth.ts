"use server";

import {
  prepareGoogleAuthStart,
  discoverTenantsForEmail,
  signUpBusinessTenantAccount,
  signUpSoloTenantAccount,
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
