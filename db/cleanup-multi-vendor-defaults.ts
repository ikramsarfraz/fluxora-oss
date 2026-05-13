/**
 * One-time cleanup: drop "default" customer prices (supplier_id IS NULL) for
 * products that now have more than one supplier.
 *
 * Background: PR #16 brought the price-chart's main row to parity with the
 * per-supplier customer-detail view. A follow-up dropped the single-price
 * input on the main row for multi-vendor products — pricing for those
 * products is meant to be set per-supplier from the expanded sub-rows. Any
 * default-price rows left behind from before the UI change (including bulk
 * markup writes) are no longer visible or editable, but they still apply as
 * a fallback at order time. This script deletes them.
 *
 * Run with:  tsx db/cleanup-multi-vendor-defaults.ts
 */
import { config as loadEnv } from "dotenv";
import { and, inArray, isNull, sql } from "drizzle-orm";

import { db } from "./index";
import { customerProductPrices, productSupplierCosts } from "./schema";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

async function main() {
  const multiVendorProducts = await db
    .select({ productId: productSupplierCosts.productId })
    .from(productSupplierCosts)
    .groupBy(productSupplierCosts.productId)
    .having(sql`count(*) > 1`);

  const productIds = multiVendorProducts.map(r => r.productId);
  console.log(`Found ${productIds.length} product(s) with >1 supplier`);

  if (productIds.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  const deleted = await db
    .delete(customerProductPrices)
    .where(
      and(
        isNull(customerProductPrices.supplierId),
        inArray(customerProductPrices.productId, productIds),
      ),
    )
    .returning({
      customerId: customerProductPrices.customerId,
      productId: customerProductPrices.productId,
    });

  console.log(`Deleted ${deleted.length} stale default price row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
