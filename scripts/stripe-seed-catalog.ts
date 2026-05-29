/**
 * Idempotently creates the three SaaS subscription tiers (Starter / Growth /
 * Enterprise) as Stripe Products + recurring Prices, tagged with the `plan`
 * metadata the app's catalog sync relies on. Each tier gets BOTH a monthly and
 * an annual Price; the annual Price is monthly × 10 (two months free).
 *
 *   pnpm stripe:seed                 # uses STRIPE_SECRET_KEY from .env.local
 *
 * Re-runs are safe: existing prices (matched by Price `lookup_key`) are reused,
 * not duplicated. After seeding, run "Sync Stripe catalog" in Admin →
 * Subscriptions (or `syncStripeCatalogFullFromStripeApi`) to mirror the
 * catalog into the database.
 */
import { config as loadEnv } from "dotenv";
import Stripe from "stripe";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

type PlanSeed = {
  plan: "starter" | "growth" | "enterprise";
  name: string;
  description: string;
  unitAmountCents: number;
};

const CURRENCY = (process.env.STRIPE_SEED_CURRENCY ?? "usd").toLowerCase();

/** Annual price = monthly × 10 (two months free). */
const ANNUAL_MONTHS_CHARGED = 10;

type Interval = "month" | "year";

const INTERVALS: Interval[] = ["month", "year"];

const PLANS: PlanSeed[] = [
  {
    plan: "starter",
    name: "Starter",
    description: "For small teams getting started.",
    unitAmountCents: 4900,
  },
  {
    plan: "growth",
    name: "Growth",
    description: "For growing distributors that need purchasing + reports.",
    unitAmountCents: 14900,
  },
  {
    plan: "enterprise",
    name: "Enterprise",
    description: "Unlimited usage, priority support.",
    unitAmountCents: 49900,
  },
];

function lookupKeyFor(plan: PlanSeed["plan"], interval: Interval): string {
  return `plan_${plan}_${interval === "year" ? "yearly" : "monthly"}`;
}

function unitAmountFor(seed: PlanSeed, interval: Interval): number {
  return interval === "year"
    ? seed.unitAmountCents * ANNUAL_MONTHS_CHARGED
    : seed.unitAmountCents;
}

async function findExistingPriceByLookupKey(
  stripe: Stripe,
  lookupKey: string,
): Promise<Stripe.Price | null> {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return list.data[0] ?? null;
}

async function findProductForPlan(
  stripe: Stripe,
  plan: PlanSeed["plan"],
): Promise<Stripe.Product | null> {
  try {
    const result = await stripe.products.search({
      query: `active:'true' AND metadata['plan']:'${plan}'`,
      limit: 1,
    });
    return result.data[0] ?? null;
  } catch {
    // Search may be unavailable on some account types; fall back to creating.
    return null;
  }
}

async function ensureProductForPlan(
  stripe: Stripe,
  seed: PlanSeed,
): Promise<Stripe.Product> {
  const existing = await findProductForPlan(stripe, seed.plan);
  if (existing) {
    console.log(`• ${seed.name}: reusing product ${existing.id}.`);
    return existing;
  }
  const product = await stripe.products.create(
    {
      name: seed.name,
      description: seed.description,
      metadata: { plan: seed.plan },
    },
    { idempotencyKey: `seed_product_${seed.plan}` },
  );
  console.log(`+ ${seed.name}: created product ${product.id}.`);
  return product;
}

async function seedPrice(
  stripe: Stripe,
  seed: PlanSeed,
  product: Stripe.Product,
  interval: Interval,
): Promise<void> {
  const lookupKey = lookupKeyFor(seed.plan, interval);
  const unitAmount = unitAmountFor(seed, interval);
  const cadence = interval === "year" ? "yr" : "mo";

  const existingPrice = await findExistingPriceByLookupKey(stripe, lookupKey);
  if (existingPrice) {
    console.log(
      `✓ ${seed.name} (${interval}ly): price already exists (${existingPrice.id}, lookup_key=${lookupKey}) — skipping.`,
    );
    return;
  }

  const price = await stripe.prices.create(
    {
      product: product.id,
      currency: CURRENCY,
      unit_amount: unitAmount,
      recurring: { interval },
      lookup_key: lookupKey,
      metadata: { plan: seed.plan },
    },
    { idempotencyKey: `seed_price_${seed.plan}_${interval}_${unitAmount}_${CURRENCY}` },
  );
  console.log(
    `+ ${seed.name} (${interval}ly): created price ${price.id} (${(unitAmount / 100).toFixed(2)} ${CURRENCY.toUpperCase()}/${cadence}, lookup_key=${lookupKey}).`,
  );
}

async function seedPlan(stripe: Stripe, seed: PlanSeed): Promise<void> {
  const product = await ensureProductForPlan(stripe, seed);
  for (const interval of INTERVALS) {
    await seedPrice(stripe, seed, product, interval);
  }
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set (.env.local). Aborting.");
    process.exit(1);
  }
  const stripe = new Stripe(key, { typescript: true });

  console.log(`Seeding Stripe catalog (currency=${CURRENCY})…\n`);
  for (const seed of PLANS) {
    await seedPlan(stripe, seed);
  }

  console.log(
    "\nDone. Next: run 'Sync Stripe catalog' in Admin → Subscriptions (or call syncStripeCatalogFullFromStripeApi) to mirror these into the DB.",
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
