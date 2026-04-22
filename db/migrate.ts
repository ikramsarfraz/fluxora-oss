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

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const MIGRATIONS_SCHEMA = process.env.DRIZZLE_MIGRATIONS_SCHEMA ?? "drizzle";
const MIGRATIONS_TABLE = process.env.DRIZZLE_MIGRATIONS_TABLE ?? "__drizzle_migrations";
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local (or .env).");
}

async function main() {
  console.log("Using DB:", url?.replace(/:[^:@/]+@/, ":****@"));

  const pool = new pg.Pool({
    connectionString: url,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  const db = drizzle(pool);

  const [{ current_database, current_user, server_addr }] = await pool
    .query(
      `
    select current_database(), current_user, inet_server_addr()::text as server_addr
  `,
    )
    .then(r => r.rows);

  console.log({ current_database, current_user, server_addr });

  const folder = join(process.cwd(), "drizzle");
  console.log(`Applying migrations from ${folder} …`);

  try {
    await migrate(db, {
      migrationsFolder: folder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });

    const migrations = await pool.query(
      `
        select *
        from "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
        order by created_at desc
      `,
    );
    console.log("Applied migrations:", migrations.rows);
    console.log("Done.");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
