/**
 * One-time migration: split inventory items with cases > 1 into individual 1-case items.
 *
 * Each original item becomes N items (one per case), each with:
 *   - a new barcode
 *   - exactWeightLbs = originalWeight / cases
 *   - cases = 1
 *   - all other fields preserved
 *
 * Items are skipped if they have active allocations, active fulfillments, or
 * are in a terminal status (shipped / sold).
 *
 * Run with:  tsx db/split-multicases.ts
 */
import { config as loadEnv } from "dotenv";
import { eq, gt } from "drizzle-orm";

import { db } from "./index";
import { inventoryItems } from "./schema";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

function generateBarcode() {
  return `INV-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function main() {
  const multiCaseItems = await db.query.inventoryItems.findMany({
    where: gt(inventoryItems.cases, 1),
    columns: {
      id: true,
      productId: true,
      lotId: true,
      barcodeId: true,
      exactWeightLbs: true,
      cases: true,
      costPerUnitSnapshot: true,
      costUnitTypeSnapshot: true,
      status: true,
      createdAt: true,
    },
    with: {
      allocations: { columns: { id: true } },
      fulfillments: { columns: { id: true, reversedAt: true } },
    },
  });

  console.log(`Found ${multiCaseItems.length} inventory item(s) with cases > 1`);

  const eligible = multiCaseItems.filter(item => {
    if (item.status === "shipped" || item.status === "sold") return false;
    if (item.allocations.length > 0) return false;
    if (item.fulfillments.some(f => !f.reversedAt)) return false;
    return true;
  });

  const skipped = multiCaseItems.length - eligible.length;

  if (skipped > 0) {
    const skippedItems = multiCaseItems.filter(item => !eligible.includes(item));
    for (const item of skippedItems) {
      const reason =
        item.status === "shipped" || item.status === "sold"
          ? `status=${item.status}`
          : item.allocations.length > 0
            ? "has active allocations"
            : "has active fulfillments";
      console.log(`  SKIP ${item.barcodeId} (${item.cases} cases) — ${reason}`);
    }
  }

  console.log(`\nEligible: ${eligible.length}  |  Skipped: ${skipped}`);

  if (eligible.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let totalNewItems = 0;

  await db.transaction(async tx => {
    for (const item of eligible) {
      const caseCount = item.cases;
      const totalWeight = Number(item.exactWeightLbs);
      const perCaseWeight = (totalWeight / caseCount).toFixed(4);

      await tx
        .update(inventoryItems)
        .set({ cases: 1, exactWeightLbs: perCaseWeight, updatedAt: new Date() })
        .where(eq(inventoryItems.id, item.id));

      const newRows = Array.from({ length: caseCount - 1 }, () => ({
        productId: item.productId,
        lotId: item.lotId,
        barcodeId: generateBarcode(),
        exactWeightLbs: perCaseWeight,
        cases: 1 as const,
        costPerUnitSnapshot: item.costPerUnitSnapshot,
        costUnitTypeSnapshot: item.costUnitTypeSnapshot,
        status: item.status,
        createdAt: item.createdAt,
      }));

      if (newRows.length > 0) {
        await tx.insert(inventoryItems).values(newRows);
      }

      totalNewItems += newRows.length;
      console.log(
        `  SPLIT ${item.barcodeId}  ${caseCount} cases → ${caseCount} items @ ${perCaseWeight} lb each`,
      );
    }
  });

  console.log(
    `\nDone. ${eligible.length} original item(s) updated, ${totalNewItems} new item(s) created.`,
  );
  if (skipped > 0) {
    console.log(
      `${skipped} item(s) skipped — handle them manually after clearing allocations/fulfillments.`,
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
