/**
 * Drops only the `drizzle` schema (migration journal).
 * If migrate then fails with "type … already exists", leftover ENUMs/types are still in
 * `public` — use `npm run db:reset-public` instead, then `npm run db:migrate`.
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
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.end();
  console.log(
    "Removed drizzle migration journal. Run npm run db:migrate to recreate tables.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
