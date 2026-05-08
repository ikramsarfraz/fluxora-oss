import { config as loadEnv } from "dotenv";

/** Match db/index.ts / migrate.ts: `.env.local` overrides `.env`. */
function ensureEnvLoaded(): void {
  loadEnv({ path: ".env" });
  loadEnv({ path: ".env.local", override: true });
}

function isLocalHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function parsePostgresUrl(raw: string): URL {
  if (raw.startsWith("postgresql://") || raw.startsWith("postgres://")) {
    return new URL(raw);
  }
  return new URL(`postgres://${raw}`);
}

export function resolvePgSslConfig(
  connectionString: string,
): false | { rejectUnauthorized: true } {
  const url = parsePostgresUrl(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "disable") {
    return false;
  }

  if (!sslMode && isLocalHostname(url.hostname)) {
    return false;
  }

  return { rejectUnauthorized: true };
}

/**
 * Next.js app + server actions: prefer pooled `DATABASE_URL`, fall back to
 * `DATABASE_URL_UNPOOLED` when Neon direct is the only value set.
 */
export function resolveDatabaseUrlForApp(): string {
  ensureEnvLoaded();
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!url) {
    throw new Error(
      "Set DATABASE_URL or DATABASE_URL_UNPOOLED (see .env.local.example).",
    );
  }
  return url;
}

/**
 * DDL / drizzle migrate: Neon recommends direct connections for migrations;
 * prefers `DATABASE_URL_UNPOOLED` when both are set.
 */
export function resolveDatabaseUrlForMigrate(): string {
  ensureEnvLoaded();
  const url =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Set DATABASE_URL_UNPOOLED or DATABASE_URL for db:migrate (see .env.local.example).",
    );
  }
  return url;
}

/**
 * Dev-only: warn when pooled + unpooled look like different environments
 * (e.g. local app DB vs Neon) — a common reason `db:migrate` updates one DB
 * while the app reads another (`relation "stripe_prices" does not exist`).
 */
export function warnIfDatabaseUrlEnvMismatch(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  ensureEnvLoaded();
  const rawPooled = process.env.DATABASE_URL?.trim();
  const rawUnpooled = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!rawPooled || !rawUnpooled) {
    return;
  }
  try {
    const a = parsePostgresUrl(rawPooled);
    const b = parsePostgresUrl(rawUnpooled);
    const aLocal = isLocalHostname(a.hostname);
    const bLocal = isLocalHostname(b.hostname);
    if (aLocal !== bLocal) {
      console.warn(
        `[db] DATABASE_URL host (${a.hostname}) and DATABASE_URL_UNPOOLED host (${b.hostname}) look like different environments. ` +
          "Migrations use UNPOOLED first; the app uses DATABASE_URL first. Use the same Postgres for both, or set a single DATABASE_URL.",
      );
    }
  } catch {
    void 0;
  }
}
