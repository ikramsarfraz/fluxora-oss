import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";

import * as relations from "./relations";
import * as schema from "./schema";

// Same resolution as drizzle.config.ts — `dotenv/config` only loads `.env`, not `.env.local`.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

/** Neon serverless HTTP driver; tables + relations for `db.query.*` relational API. */
export const db = drizzle(process.env.DATABASE_URL, {
  schema: { ...schema, ...relations },
});
