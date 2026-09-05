import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { serverEnv } from "@/lib/env.server";

let cached: NeonQueryFunction<false, false> | undefined;

/**
 * Neon's HTTP driver: one round trip per query, no connection pool to exhaust,
 * which is what serverless request handlers want. Created lazily so importing
 * this module never requires DATABASE_URL to be set (builds, tests).
 *
 * Queries are tagged templates and always parameterised:
 *   sql`select * from profiles where user_id = ${userId}`
 * Never build SQL by string concatenation.
 */
export function db(): NeonQueryFunction<false, false> {
  cached ??= neon(serverEnv().DATABASE_URL);
  return cached;
}

/** True once a real Neon connection string is configured. */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.length > 0 && !url.includes("placeholder"));
}
