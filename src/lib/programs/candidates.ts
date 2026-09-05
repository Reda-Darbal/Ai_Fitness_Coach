import "server-only";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import type { Exercise } from "@/lib/exercises/types";
import type { Profile } from "@/lib/profile/queries";

/** How many candidates we are willing to put in a prompt. */
const MAX_CANDIDATES = 90;
const MAX_PER_BODY_PART = 12;

/**
 * Beginners get stable, easy-to-learn movements first. This ranks equipment
 * so machines and cables outrank free weights when we have to trim the list —
 * the training philosophy in the spec, applied in code rather than left to
 * the model.
 */
const BEGINNER_EQUIPMENT_RANK: Record<string, number> = {
  "leverage machine": 0,
  cable: 1,
  "smith machine": 2,
  dumbbell: 3,
  "body weight": 4,
  "ez barbell": 5,
  barbell: 6,
  kettlebell: 7,
  band: 8,
  "stability ball": 9,
  "sled machine": 10,
  rope: 11,
  weighted: 12,
};

function allowedDifficulties(level: Profile["experienceLevel"]): string[] {
  if (level === "beginner") return ["beginner"];
  if (level === "intermediate") return ["beginner", "intermediate"];
  return ["beginner", "intermediate", "advanced"];
}

/** Loose match of free-text dislikes against exercise names and aliases. */
function isDisliked(exercise: Exercise, dislikes: string[]): boolean {
  if (dislikes.length === 0) return false;
  const haystack = [exercise.name, ...exercise.aliases]
    .join(" ")
    .toLowerCase();
  return dislikes.some((d) => d.length > 2 && haystack.includes(d));
}

export function parseFreeTextList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\n;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export interface CandidateSet {
  exercises: Exercise[];
  byBodyPart: Record<string, Exercise[]>;
}

/**
 * Builds the exercise list the model is allowed to choose from.
 *
 * This is deliberately deterministic: equipment the user actually has,
 * difficulty they can handle, nothing they said they dislike. The model never
 * sees anything outside this list, so it cannot prescribe a barbell squat to
 * someone training at home with dumbbells.
 */
export async function buildCandidates(profile: Profile): Promise<CandidateSet> {
  const difficulties = allowedDifficulties(profile.experienceLevel);
  const dislikes = parseFreeTextList(profile.dislikedExercises);
  const equipment = new Set(profile.equipment);

  const all = await exerciseProvider.list();

  const eligible = all.filter(
    (e) =>
      equipment.has(e.equipment) &&
      difficulties.includes(e.difficulty) &&
      e.bodyPart !== "cardio" &&
      !isDisliked(e, dislikes),
  );

  // Keep the list balanced across body parts rather than letting one
  // dominate, and prefer stable equipment for less experienced lifters.
  const preferStable = profile.experienceLevel !== "advanced";
  const byBodyPart: Record<string, Exercise[]> = {};

  for (const exercise of eligible) {
    (byBodyPart[exercise.bodyPart] ??= []).push(exercise);
  }

  for (const part of Object.keys(byBodyPart)) {
    byBodyPart[part] = byBodyPart[part]
      .sort((a, b) => {
        if (preferStable) {
          const rank =
            (BEGINNER_EQUIPMENT_RANK[a.equipment] ?? 99) -
            (BEGINNER_EQUIPMENT_RANK[b.equipment] ?? 99);
          if (rank !== 0) return rank;
        }
        // Compound movements first — more work per minute.
        if (a.compound !== b.compound) return a.compound ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_PER_BODY_PART);
  }

  // Round-robin across body parts so trimming to MAX_CANDIDATES keeps balance.
  const parts = Object.keys(byBodyPart).sort();
  const exercises: Exercise[] = [];
  for (let i = 0; exercises.length < MAX_CANDIDATES; i += 1) {
    let added = false;
    for (const part of parts) {
      const next = byBodyPart[part][i];
      if (next) {
        exercises.push(next);
        added = true;
        if (exercises.length >= MAX_CANDIDATES) break;
      }
    }
    if (!added) break;
  }

  const trimmedByBodyPart: Record<string, Exercise[]> = {};
  for (const exercise of exercises) {
    (trimmedByBodyPart[exercise.bodyPart] ??= []).push(exercise);
  }

  return { exercises, byBodyPart: trimmedByBodyPart };
}
