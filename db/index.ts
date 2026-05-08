import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as relations from "./relations";
import * as schema from "./schema";
import {
  resolveDatabaseUrlForApp,
  resolvePgSslConfig,
  warnIfDatabaseUrlEnvMismatch,
} from "./database-url";

// Same resolution as drizzle.config.ts — `dotenv/config` only loads `.env`, not `.env.local`.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const connectionString = resolveDatabaseUrlForApp();
warnIfDatabaseUrlEnvMismatch();

/**
 * node-postgres (TCP) driver with a shared pool. Chosen over the neon-http
 * driver specifically because neon-http does NOT support interactive
 * transactions (`db.transaction(async tx => ...)` throws "No transactions
 * support in neon-http driver"), which the supplier-invoice completion and
 * reversal flows require for atomicity. A single module-level pool is reused
 * across server-action invocations; keep `max` modest to play nicely with
 * Neon's connection limits in serverless environments.
 */
const pool = new pg.Pool({
  connectionString,
  ssl: resolvePgSslConfig(connectionString),
  max: 10,
});

export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});
