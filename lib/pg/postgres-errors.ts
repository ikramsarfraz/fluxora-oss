/** Walk Drizzle/pg error wrappers (`cause` chains) for the underlying Postgres `code`. */
export function unwrapPostgresErrorCause(
  root: unknown,
): { code?: string; message?: string } | null {
  let e: unknown = root;
  for (let i = 0; i < 10; i++) {
    if (e && typeof e === "object") {
      const obj = e as { code?: unknown; message?: unknown };
      const code = typeof obj.code === "string" ? obj.code : undefined;
      const message = typeof obj.message === "string" ? obj.message : undefined;
      if (code !== undefined || message !== undefined) {
        return { code, message };
      }
    }
    const next =
      e instanceof Error && e.cause != null
        ? e.cause
        : typeof e === "object" &&
            e !== null &&
            "cause" in e &&
            (e as { cause?: unknown }).cause !== undefined
          ? (e as { cause: unknown }).cause
          : undefined;
    if (next === undefined) {
      break;
    }
    e = next;
  }
  return null;
}

/** `42P01` — undefined_table (e.g. migrations not applied for `stripe_prices`). */
export function isPostgresUndefinedTableError(root: unknown): boolean {
  return unwrapPostgresErrorCause(root)?.code === "42P01";
}
