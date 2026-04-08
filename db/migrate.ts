/**
 * Run SQL migrations from ./drizzle (same as drizzle-kit migrate, but clearer errors).
 * Prefer DATABASE_URL_UNPOOLED for Neon when pooled URLs fail on DDL.
 */
import { config as loadEnv } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { join } from "node:path";
import pg from "pg";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (or .env).",
  );
}

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);

  const folder = join(process.cwd(), "drizzle");
  console.log(`Applying migrations from ${folder} …`);

  await migrate(db, { migrationsFolder: folder });

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
