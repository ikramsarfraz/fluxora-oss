import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getPlaidClient } from "@/modules/distribution/plaid/services/plaid-client";

export async function POST() {
  try {
    const [portalUser, tenant] = await Promise.all([
      getCurrentPortalUser(),
      getCurrentTenant(),
    ]);

    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: portalUser.id },
      client_name: tenant.name ?? "Acme Distribution",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL}/api/plaid/webhook`,
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("[plaid/link-token]", err);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
