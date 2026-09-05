import { z } from "zod";
import { WEEKDAYS } from "@/lib/profile/constants";

/**
 * The contract the model must return. Kept free of refinements and defaults so
 * it converts cleanly to JSON Schema for Together's structured output — the
 * cross-field rules (real exercise ids, days matching the user's schedule) are
 * enforced afterwards in validateProgram, where the errors are actionable.
 */
export const generatedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  repMin: z.number().int().min(1).max(50),
  repMax: z.number().int().min(1).max(50),
  restSeconds: z.number().int().min(15).max(600),
  notes: z.string().max(300),
});

export const generatedDaySchema = z.object({
  weekday: z.enum(WEEKDAYS),
  name: z.string().min(1).max(60),
  focus: z.string().min(1).max(60),
  estimatedMinutes: z.number().int().min(10).max(240),
  exercises: z.array(generatedExerciseSchema).min(1).max(10),
});

export const generatedProgramSchema = z.object({
  title: z.string().min(1).max(80),
  days: z.array(generatedDaySchema).min(1).max(7),
});

export type GeneratedProgram = z.infer<typeof generatedProgramSchema>;
export type GeneratedDay = z.infer<typeof generatedDaySchema>;
export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>;
