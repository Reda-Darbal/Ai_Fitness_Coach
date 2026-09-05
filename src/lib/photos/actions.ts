"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import {
  deleteObject,
  headObject,
  isStorageConfigured,
  presignUpload,
} from "@/lib/storage/s3";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Fail = { ok: false; error: string };

function fail(cause: unknown): Fail {
  if (cause instanceof UnauthorizedError) {
    return { ok: false, error: "You are not signed in." };
  }
  const message = cause instanceof Error ? cause.message : "Unknown error";
  console.error("photo action:", message);
  return { ok: false, error: message };
}

/** The ownership rule for storage: every key belongs to exactly one user. */
function keyFor(userId: string, extension: string): string {
  return `progress/${userId}/${randomUUID()}.${extension}`;
}

function assertOwnKey(userId: string, key: string): void {
  if (!key.startsWith(`progress/${userId}/`)) {
    throw new Error("Not your photo.");
  }
}

const createSchema = z.object({
  contentType: z.string(),
});

/**
 * Step 1 of an upload: mint a presigned PUT so the browser sends the file
 * straight to storage — no multi-megabyte bodies through server actions.
 */
export async function createPhotoUpload(
  input: unknown,
): Promise<{ ok: true; key: string; uploadUrl: string } | Fail> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success || !ALLOWED_TYPES.has(parsed.data.contentType)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  try {
    const userId = await requireUserId();
    if (!isStorageConfigured()) {
      return { ok: false, error: "Photo storage is not configured." };
    }
    const extension = parsed.data.contentType.split("/")[1];
    const key = keyFor(userId, extension);
    const uploadUrl = await presignUpload(key, parsed.data.contentType);
    return { ok: true, key, uploadUrl };
  } catch (cause) {
    return fail(cause);
  }
}

const confirmSchema = z.object({
  key: z.string().min(1),
  pose: z.enum(["front", "side", "back"]),
  weightKg: z.number().min(20).max(400).nullable(),
  notes: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

/**
 * Step 2: after the browser finishes the PUT, verify the object really exists
 * and is a sane size, then record it. The prefix check is the authorization —
 * nobody can confirm (or later view/delete) a key outside their own folder.
 */
export async function confirmPhotoUpload(
  input: unknown,
): Promise<{ ok: true } | Fail> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That photo looks wrong." };

  try {
    const userId = await requireUserId();
    const { key, pose, weightKg, notes } = parsed.data;
    assertOwnKey(userId, key);

    const head = await headObject(key);
    if (!head) return { ok: false, error: "The upload did not arrive. Try again." };
    if (head.size > MAX_PHOTO_BYTES) {
      await deleteObject(key);
      return { ok: false, error: "That photo is too large (15MB max)." };
    }

    await db()`
      insert into progress_photos (user_id, pose, object_key, weight_kg, notes)
      values (${userId}, ${pose}, ${key}, ${weightKg}, ${notes ?? null})
    `;

    revalidatePath("/photos");
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

/** Removes the row and the object — a deleted photo is gone from both. */
export async function deletePhoto(photoId: string): Promise<{ ok: true } | Fail> {
  try {
    const userId = await requireUserId();

    const rows = (await db()`
      delete from progress_photos
       where id = ${photoId} and user_id = ${userId}
       returning object_key
    `) as unknown as { object_key: string }[];

    const key = rows[0]?.object_key;
    if (key) {
      assertOwnKey(userId, key);
      await deleteObject(key).catch((cause) =>
        console.error("deletePhoto storage:", cause),
      );
    }

    revalidatePath("/photos");
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}
