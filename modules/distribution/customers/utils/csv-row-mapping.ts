import type { BulkCreateCustomerInput } from "../services/customers";

/**
 * Maps one row of a parsed customers CSV into the service's bulk-create
 * input shape. Pure function — no DB, no React state, no I/O — so the
 * CSV-import page and tests can both use it.
 *
 * Rules:
 *   - Empty strings collapse to `null` (vs. inserting "" into the DB).
 *   - Email is lower-cased (matches the form-path Zod schema).
 *   - net_days is parsed as an integer; non-numeric / blank → null.
 *   - An address sub-record is only built when `address_line1` is set;
 *     city/state/zip without a street would fail the NOT NULL constraint
 *     on customer_addresses.street.
 *
 * Note: phone is not normalized here — that happens in
 * createCustomerForTenant on the server so the same canonicalization
 * applies whether the row came from the form or a CSV.
 */
export function csvRowToCustomerInput(
  row: Record<string, string>,
): BulkCreateCustomerInput {
  const street = row.address_line1?.trim() || "";
  const addresses = street
    ? [
        {
          addressType: "shipping" as const,
          street,
          city: row.address_city?.trim() || null,
          state: row.address_state?.trim() || null,
          zip: row.address_zip?.trim() || null,
          isDefault: true,
        },
      ]
    : undefined;

  const netDaysRaw = row.net_days?.trim();
  const netDaysNum = netDaysRaw ? Number(netDaysRaw) : null;

  return {
    name: row.name?.trim() ?? "",
    abbreviation: row.abbreviation?.trim() || null,
    email: row.email?.trim().toLowerCase() || null,
    phoneNumber: row.phone?.trim() || null,
    taxId: row.tax_id?.trim() || null,
    netDays:
      netDaysNum != null && Number.isFinite(netDaysNum) ? netDaysNum : null,
    fuelSurchargeAmount: row.fuel_surcharge?.trim() || null,
    creditLimit: row.credit_limit?.trim() || null,
    notes: row.notes?.trim() || null,
    addresses,
  };
}
