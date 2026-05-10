/**
 * One-time script: configure "By Weight" (lb + cs) for all products except
 * those in the "beverages" or "processed foods" categories.
 *
 * For each eligible product:
 *  - Sets baseUnitId → lb
 *  - Replaces sales-purpose productUnits with:
 *      lb  (conversionToBase=1, isDefault=false when cs also present, sortOrder=1)
 *      cs  (conversionToBase=<existing value>,   isDefault=true,  sortOrder=0)
 *            ↑ only if product already has a cs sales unit — we can't invent a
 *              case weight for products that were never configured with one.
 *  - Non-sales units (stock, purchase, pricing, display) are left untouched.
 *
 * Run with:  tsx db/add-lb-sales-unit.ts
 * Dry-run:   DRY_RUN=1 tsx db/add-lb-sales-unit.ts
 */
import { config as loadEnv } from "dotenv";
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { db } from "./index";
import {
  categories,
  productCategories,
  productUnits,
  products,
  unitsOfMeasure,
} from "./schema";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const EXCLUDED_CATEGORY_NAMES = ["beverages", "processed foods"];
const EXCLUDED_CATEGORY_SLUGS = ["beverages", "processed-foods"];

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  // ── 1. Look up lb and cs UOMs ────────────────────────────────────────────
  const allUoms = await db.select().from(unitsOfMeasure);

  const lbUom = allUoms.find(
    u =>
      u.abbreviation?.toLowerCase() === "lb" ||
      u.abbreviation?.toLowerCase() === "lbs" ||
      u.name.toLowerCase() === "lb" ||
      u.name.toLowerCase() === "lbs" ||
      u.name.toLowerCase() === "pound" ||
      u.name.toLowerCase() === "pounds",
  );
  if (!lbUom) {
    console.error("No lb/lbs/pound unit found. Available units:");
    allUoms.forEach(u => console.error(`  ${u.name} (${u.abbreviation ?? "—"})`));
    process.exit(1);
  }

  const csUom = allUoms.find(
    u =>
      u.abbreviation?.toLowerCase() === "cs" ||
      u.name.toLowerCase() === "case" ||
      u.name.toLowerCase() === "cases",
  );
  if (!csUom) {
    console.error("No cs/case unit found. Available units:");
    allUoms.forEach(u => console.error(`  ${u.name} (${u.abbreviation ?? "—"})`));
    process.exit(1);
  }

  console.log(`lb UOM : "${lbUom.name}" (${lbUom.abbreviation}) — ${lbUom.id}`);
  console.log(`cs UOM : "${csUom.name}" (${csUom.abbreviation}) — ${csUom.id}`);

  // ── 2. Find excluded category IDs ───────────────────────────────────────
  const allCategories = await db.select().from(categories);
  const excludedCatIds = allCategories
    .filter(
      c =>
        EXCLUDED_CATEGORY_NAMES.includes(c.name.toLowerCase()) ||
        EXCLUDED_CATEGORY_SLUGS.includes((c.slug ?? "").toLowerCase()),
    )
    .map(c => c.id);

  const excludedNames = allCategories
    .filter(c => excludedCatIds.includes(c.id))
    .map(c => `"${c.name}"`);

  if (excludedCatIds.length > 0) {
    console.log(`\nExcluding categories: ${excludedNames.join(", ")}`);
  } else {
    console.log("\nNo matching excluded categories found — proceeding without exclusions.");
  }

  // ── 3. Find product IDs to exclude ──────────────────────────────────────
  const excludedProductLinks =
    excludedCatIds.length > 0
      ? await db
          .select({ productId: productCategories.productId })
          .from(productCategories)
          .where(inArray(productCategories.categoryId, excludedCatIds))
      : [];
  const excludedProductIds = [...new Set(excludedProductLinks.map(r => r.productId))];

  // ── 4. Fetch all eligible products with their current units ─────────────
  const allProducts = await db.query.products.findMany({
    with: {
      productUnits: { with: { unit: true } },
      productCategories: { with: { category: true } },
    },
  });

  const eligible = allProducts.filter(p => !excludedProductIds.includes(p.id));
  const excluded = allProducts.filter(p => excludedProductIds.includes(p.id));

  console.log(`\nProducts total   : ${allProducts.length}`);
  console.log(`Excluded         : ${excluded.length} (${excluded.map(p => p.sku).join(", ") || "none"})`);
  console.log(`Eligible         : ${eligible.length}`);

  if (eligible.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // ── 5. Plan changes ──────────────────────────────────────────────────────
  const toProcess: {
    id: string;
    sku: string;
    name: string;
    newBaseUnitId: string;
    newSalesUnits: { unitId: string; conversionToBase: string; isDefault: boolean; sortOrder: number; allowsFractional: boolean }[];
    hasCs: boolean;
    alreadyCorrect: boolean;
  }[] = [];

  for (const product of eligible) {
    const salesUnits = product.productUnits.filter(u => u.purpose === "sales");
    const hasLb = salesUnits.some(u => u.unitId === lbUom.id);
    const csUnit = salesUnits.find(u => u.unitId === csUom.id);
    const hasCs = !!csUnit;

    const alreadyHasLbBase = product.baseUnitId === lbUom.id;
    const alreadyCorrect = alreadyHasLbBase && hasLb;

    const newSalesUnits = [];

    if (hasCs) {
      newSalesUnits.push({
        unitId: csUom.id,
        conversionToBase: csUnit!.conversionToBase,
        isDefault: true,
        allowsFractional: false,
        sortOrder: 0,
      });
    }

    newSalesUnits.push({
      unitId: lbUom.id,
      conversionToBase: "1",
      isDefault: !hasCs,
      allowsFractional: true,
      sortOrder: 1,
    });

    toProcess.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      newBaseUnitId: lbUom.id,
      newSalesUnits,
      hasCs,
      alreadyCorrect,
    });
  }

  const needsUpdate = toProcess.filter(p => !p.alreadyCorrect);
  const noCs = needsUpdate.filter(p => !p.hasCs);

  console.log(`\nAlready correct  : ${toProcess.filter(p => p.alreadyCorrect).length}`);
  console.log(`Will update      : ${needsUpdate.length}`);
  if (noCs.length > 0) {
    console.log(
      `  ⚠  ${noCs.length} product(s) have no existing case unit — will get lb-only` +
        ` (set lbs/case via the product form to add case selling later):`,
    );
    noCs.forEach(p => console.log(`       [${p.sku}] ${p.name}`));
  }

  if (needsUpdate.length === 0) {
    console.log("All eligible products are already configured correctly.");
    return;
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — changes that would be applied:");
    for (const p of needsUpdate) {
      const unitStr = p.newSalesUnits
        .map(u => (u.unitId === lbUom.id ? "lb" : "cs") + (u.isDefault ? "*" : ""))
        .join(" + ");
      console.log(`  [${p.sku}] ${p.name}  →  baseUnit=lb, sales=[${unitStr}]`);
    }
    return;
  }

  // ── 6. Apply changes ─────────────────────────────────────────────────────
  let done = 0;
  for (const p of needsUpdate) {
    // Set baseUnitId
    await db
      .update(products)
      .set({ baseUnitId: p.newBaseUnitId })
      .where(eq(products.id, p.id));

    // Replace sales units only — delete existing sales units, insert new ones
    await db
      .delete(productUnits)
      .where(
        and(
          eq(productUnits.productId, p.id),
          eq(productUnits.purpose, "sales"),
        ),
      );

    await db.insert(productUnits).values(
      p.newSalesUnits.map(u => ({
        productId: p.id,
        unitId: u.unitId,
        purpose: "sales" as const,
        conversionToBase: u.conversionToBase,
        isDefault: u.isDefault,
        allowsFractional: u.allowsFractional,
        sortOrder: u.sortOrder,
      })),
    );

    const unitStr = p.newSalesUnits
      .map(u => (u.unitId === lbUom.id ? "lb" : "cs") + (u.isDefault ? "*" : ""))
      .join(" + ");
    console.log(`  ✓ [${p.sku}] ${p.name}  →  [${unitStr}]`);
    done++;
  }

  console.log(`\nDone. Updated ${done} product(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
