import { z } from "zod";

// Client-safe environment. NEXT_PUBLIC_* values are inlined at build time,
// so each one must be referenced as a literal property access.
const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
