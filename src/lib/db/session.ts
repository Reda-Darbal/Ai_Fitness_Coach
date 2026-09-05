import "server-only";
import { auth } from "@clerk/nextjs/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthorizedError";
  }
}

/**
 * The authorization boundary for this app.
 *
 * Supabase enforced per-user isolation in the database with RLS. Neon has no
 * equivalent we trust yet, so isolation is enforced here instead: every
 * repository function takes `userId` as its FIRST parameter and filters on it,
 * and the only way to obtain that id is this function, which fails closed.
 *
 * Rules, so a missing filter cannot happen quietly:
 *   1. No page, action or component queries the database directly — they call
 *      a repository function in src/lib/db/.
 *   2. Every repository function touching user data takes `userId` first and
 *      includes `where user_id = ${userId}` in its query.
 *   3. Every server action starts with requireUserId() — the Next 16 proxy
 *      does not run for Server Functions, so this is the only check there is.
 *
 * Every table keeps its user_id column, so real RLS can be layered on later
 * without touching data.
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

/** Null instead of throwing — for layouts deciding where to redirect. */
export async function optionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
