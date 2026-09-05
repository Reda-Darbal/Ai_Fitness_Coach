import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { optionalUserId } from "@/lib/db/session";
import type {
  CoachLanguage,
  ExperienceLevel,
  Goal,
  PreferredTime,
  Sex,
  Weekday,
} from "./constants";

export interface Profile {
  userId: string;
  displayName: string | null;
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  trainingDays: Weekday[];
  preferredTime: PreferredTime | null;
  sessionMinutes: number | null;
  equipment: string[];
  injuries: string | null;
  likedExercises: string | null;
  dislikedExercises: string | null;
  notes: string | null;
  coachLanguage: CoachLanguage;
  conciseReplies: boolean;
  onboardingCompletedAt: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | string | null;
  current_weight_kg: number | string | null;
  target_weight_kg: number | string | null;
  goal: Goal;
  experience_level: ExperienceLevel;
  training_days: Weekday[] | null;
  preferred_time: PreferredTime | null;
  session_minutes: number | null;
  equipment: string[] | null;
  injuries: string | null;
  liked_exercises: string | null;
  disliked_exercises: string | null;
  notes: string | null;
  coach_language: CoachLanguage;
  concise_replies: boolean;
  onboarding_completed_at: Date | string | null;
}

/** Postgres `numeric` arrives as a string over the wire. */
function num(value: number | string | null): number | null {
  if (value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    age: row.age,
    sex: row.sex,
    heightCm: num(row.height_cm),
    currentWeightKg: num(row.current_weight_kg),
    targetWeightKg: num(row.target_weight_kg),
    goal: row.goal,
    experienceLevel: row.experience_level,
    trainingDays: row.training_days ?? [],
    preferredTime: row.preferred_time,
    sessionMinutes: row.session_minutes,
    equipment: row.equipment ?? [],
    injuries: row.injuries,
    likedExercises: row.liked_exercises,
    dislikedExercises: row.disliked_exercises,
    notes: row.notes,
    coachLanguage: row.coach_language,
    conciseReplies: row.concise_replies,
    onboardingCompletedAt:
      row.onboarding_completed_at instanceof Date
        ? row.onboarding_completed_at.toISOString()
        : row.onboarding_completed_at,
  };
}

/** True once a real Neon connection string is configured. */
export function isProfileStorageReady(): boolean {
  return isDatabaseConfigured();
}

/**
 * One user's profile. `userId` is required and filtered on — this is the
 * authorization boundary (see src/lib/db/session.ts).
 */
export async function getProfileFor(userId: string): Promise<Profile | null> {
  const rows = (await db()`
    select * from profiles where user_id = ${userId} limit 1
  `) as unknown as ProfileRow[];

  return rows.length > 0 ? toProfile(rows[0]) : null;
}

/**
 * The signed-in user's profile. Never throws: layouts use this for redirect
 * decisions, and a transient failure must not take the whole app down. A
 * non-null `error` means "unknown", not "no profile".
 */
export async function getProfile(): Promise<{
  profile: Profile | null;
  error: string | null;
}> {
  if (!isDatabaseConfigured()) {
    return { profile: null, error: "The database is not configured yet." };
  }

  try {
    const userId = await optionalUserId();
    if (!userId) return { profile: null, error: null };
    return { profile: await getProfileFor(userId), error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("getProfile:", message);
    return { profile: null, error: message };
  }
}

export function hasCompletedOnboarding(profile: Profile | null): boolean {
  return Boolean(profile?.onboardingCompletedAt);
}
