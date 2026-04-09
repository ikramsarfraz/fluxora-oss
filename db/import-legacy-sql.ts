/**
 * Run one or more SQL files against Postgres (same env as db:migrate).
 *
 * Usage:
 *   npx tsx db/import-legacy-sql.ts docs/legacy-app/import-suppliers-to-postgres.sql
 *   npm run db:import-customers
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error(
      "Usage: tsx db/import-legacy-sql.ts <path.sql> [path2.sql ...]",
    );
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    for (const p of paths) {
      const sqlPath = resolve(process.cwd(), p);
      const sql = readFileSync(sqlPath, "utf8");
      await pool.query(sql);
      console.log(`Applied ${sqlPath}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
