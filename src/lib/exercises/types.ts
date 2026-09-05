import { z } from "zod";

export const exerciseDifficulties = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type ExerciseDifficulty = (typeof exerciseDifficulties)[number];

/**
 * Schema for one record of the vendored catalogue (src/data/exercises.json,
 * 1332 records): the original free-exercise-db snapshot, hand-written machine
 * additions, and a bulk import from hasaneyldrm/exercises-dataset. IDs are
 * strings (zero-padded numerics like "0002" plus "drv-"/"new-" slugs).
 *
 * `videos`/`thumbnails` are kept in the schema for shape compatibility but
 * are empty — the original media host died; demo GIFs come from
 * src/lib/exercises/media.ts instead.
 */
export const genderMediaSchema = z.object({
  male: z.url().optional(),
  female: z.url().optional(),
});

export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  bodyPart: z.string().min(1),
  target: z.string().min(1),
  secondaryMuscles: z.array(z.string()).default([]),
  equipment: z.string().min(1),
  difficulty: z.enum(exerciseDifficulties),
  compound: z.boolean(),
  unilateral: z.boolean(),
  shortDescription: z.string().default(""),
  instructions: z.string().default(""),
  steps: z.array(z.string()).default([]),
  formCues: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  breathing: z.string().default(""),
  videos: genderMediaSchema,
  thumbnails: genderMediaSchema,
});

export type Exercise = z.infer<typeof exerciseSchema>;
