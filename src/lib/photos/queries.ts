import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { isStorageConfigured, presignView } from "@/lib/storage/s3";

export type PhotoPose = "front" | "side" | "back";

export interface ProgressPhoto {
  id: string;
  takenOn: string;
  pose: PhotoPose;
  weightKg: number | null;
  notes: string | null;
  /** Short-lived presigned URL, minted per request for the owner only. */
  url: string;
}

interface Row {
  id: string;
  taken_on: Date | string;
  pose: PhotoPose;
  object_key: string;
  weight_kg: string | number | null;
  notes: string | null;
}

function day(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

/** All of one user's photos, newest first, with fresh view URLs. */
export async function getPhotosFor(userId: string): Promise<ProgressPhoto[]> {
  const rows = (await db()`
    select id, taken_on, pose, object_key, weight_kg, notes
      from progress_photos
     where user_id = ${userId}
     order by taken_on desc, pose
  `) as unknown as Row[];

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      takenOn: day(r.taken_on),
      pose: r.pose,
      weightKg:
        r.weight_kg === null
          ? null
          : typeof r.weight_kg === "string"
            ? Number(r.weight_kg)
            : r.weight_kg,
      notes: r.notes,
      url: await presignView(r.object_key),
    })),
  );
}

export async function getPhotos(userId: string | null): Promise<ProgressPhoto[]> {
  if (!userId || !isDatabaseConfigured() || !isStorageConfigured()) return [];
  try {
    return await getPhotosFor(userId);
  } catch (cause) {
    console.error("getPhotos:", cause);
    return [];
  }
}

/** Owned photos by id, with fresh URLs — used by the AI review. */
export async function getPhotosByIdsFor(
  userId: string,
  ids: string[],
): Promise<ProgressPhoto[]> {
  if (ids.length === 0) return [];
  const rows = (await db()`
    select id, taken_on, pose, object_key, weight_kg, notes
      from progress_photos
     where user_id = ${userId} and id = any(${ids})
     order by taken_on
  `) as unknown as Row[];

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      takenOn: day(r.taken_on),
      pose: r.pose,
      weightKg:
        r.weight_kg === null
          ? null
          : typeof r.weight_kg === "string"
            ? Number(r.weight_kg)
            : r.weight_kg,
      notes: r.notes,
      url: await presignView(r.object_key),
    })),
  );
}
