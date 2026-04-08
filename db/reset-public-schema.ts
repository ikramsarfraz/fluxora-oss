/**
 * Full reset: drops `public` and `drizzle` schemas so the next migrate starts clean.
 * Use when leftover ENUMs/types/tables exist (e.g. "type already exists") after partial drops.
 *
 * Then: npm run db:migrate
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set.");
}

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO PUBLIC");
    await client.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
  } finally {
    client.release();
    await pool.end();
  }
  console.log(
    "Recreated empty public schema and removed drizzle journal. Run npm run db:migrate.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
