import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env.server";

/**
 * Neon Object Storage (S3-compatible). The bucket is PRIVATE — verified:
 * unsigned requests return 403 — so every read and write happens through a
 * short-lived presigned URL minted here, never a stored public link.
 */

let cached: S3Client | undefined;

export function isStorageConfigured(): boolean {
  const env = serverEnv();
  return Boolean(
    env.AWS_ENDPOINT_URL_S3 &&
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY &&
      env.STORAGE_BUCKET,
  );
}

function client(): S3Client {
  // The SDK reads AWS_* from the environment; forcePathStyle is what the
  // Neon endpoint expects.
  cached ??= new S3Client({ forcePathStyle: true });
  return cached;
}

function bucket(): string {
  const name = serverEnv().STORAGE_BUCKET;
  if (!name) throw new Error("STORAGE_BUCKET is not configured.");
  return name;
}

/** Upload URL the browser PUTs the file to — bypasses the server entirely. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/** Short-lived view URL for the owner. */
export async function presignView(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

/** Confirms an object landed and how big it is, before we trust the row. */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | undefined } | null> {
  try {
    const head = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return { size: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
