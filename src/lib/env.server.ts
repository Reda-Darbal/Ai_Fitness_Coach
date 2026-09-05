import "server-only";
import { z } from "zod";

// Server-only secrets, validated lazily on first access so a build on a
// machine without secrets does not die at module scope. TOGETHER_* becomes
// required when AI features land (Phase 4).
/**
 * An empty value in .env means "not set". Without this, `FOO=` fails a
 * .min(1).optional() check, because the string is present but zero-length.
 */
const optionalSecret = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().startsWith("sk_"),
  DATABASE_URL: z.string().min(1, "Set DATABASE_URL to your Neon connection string"),
  TOGETHER_API_KEY: optionalSecret,
  TOGETHER_MODEL: optionalSecret,
  TOGETHER_VISION_MODEL: optionalSecret,
  AWS_ENDPOINT_URL_S3: optionalSecret,
  AWS_ACCESS_KEY_ID: optionalSecret,
  AWS_SECRET_ACCESS_KEY: optionalSecret,
  AWS_REGION: optionalSecret,
  STORAGE_BUCKET: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse({
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
    TOGETHER_MODEL: process.env.TOGETHER_MODEL,
    TOGETHER_VISION_MODEL: process.env.TOGETHER_VISION_MODEL,
    AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  });
  return cached;
}
