import { db } from "./index";
import { sql } from "drizzle-orm";

async function resetDb() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset database in production");
  }

  console.log("Dropping public schema...");

  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
  await db.execute(sql`CREATE SCHEMA public;`);

  console.log("Database schema reset complete.");
}

resetDb()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
