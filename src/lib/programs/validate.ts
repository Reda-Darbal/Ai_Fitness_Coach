import type { Weekday } from "@/lib/profile/constants";
import type { GeneratedProgram } from "./schema";

export interface ValidationContext {
  /** Exercise ids that were offered to the model. Nothing else is allowed. */
  candidateIds: Set<string>;
  /** Days the user actually trains. */
  trainingDays: Weekday[];
  sessionMinutes: number | null;
}

export interface ValidationResult {
  program: GeneratedProgram;
  /** Non-fatal repairs applied, worth surfacing for debugging. */
  repairs: string[];
}

export class ProgramValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgramValidationError";
  }
}

/** Rough time cost of a set including its rest. */
function estimateMinutes(
  exercises: { sets: number; restSeconds: number }[],
): number {
  const seconds = exercises.reduce(
    (total, e) => total + e.sets * (40 + e.restSeconds),
    0,
  );
  return Math.round(seconds / 60);
}

/**
 * Business rules applied after Zod, in the order that matters.
 *
 * The hard rule: every exercise id must be one we offered. A model that
 * invents "0999" or renames an id fails here, and the whole generation is
 * rejected rather than silently dropping exercises — a program missing its
 * pressing movement is worse than no program.
 *
 * Softer problems are repaired: duplicate exercises within a day, days the
 * user does not train, rep ranges the wrong way round, and sessions that
 * overrun the time budget.
 */
export function validateProgram(
  program: GeneratedProgram,
  context: ValidationContext,
): ValidationResult {
  const repairs: string[] = [];
  const allowedDays = new Set<string>(context.trainingDays);

  // 1. Every exercise id must exist in the candidate set. No exceptions.
  for (const day of program.days) {
    for (const exercise of day.exercises) {
      if (!context.candidateIds.has(exercise.exerciseId)) {
        throw new ProgramValidationError(
          `The coach picked an exercise that does not exist (${exercise.exerciseId}).`,
        );
      }
    }
  }

  // 2. Drop days outside the user's schedule; keep one entry per weekday.
  const seenDays = new Set<string>();
  let days = program.days.filter((day) => {
    if (!allowedDays.has(day.weekday)) {
      repairs.push(`Dropped ${day.weekday}: not a training day.`);
      return false;
    }
    if (seenDays.has(day.weekday)) {
      repairs.push(`Dropped a duplicate ${day.weekday}.`);
      return false;
    }
    seenDays.add(day.weekday);
    return true;
  });

  if (days.length === 0) {
    throw new ProgramValidationError(
      "The coach did not produce any sessions on your training days.",
    );
  }

  // 3. Per-day repairs.
  days = days.map((day) => {
    const seenExercises = new Set<string>();
    let exercises = day.exercises.filter((exercise) => {
      if (seenExercises.has(exercise.exerciseId)) {
        repairs.push(`Removed a repeated exercise on ${day.weekday}.`);
        return false;
      }
      seenExercises.add(exercise.exerciseId);
      return true;
    });

    exercises = exercises.map((exercise) =>
      exercise.repMax < exercise.repMin
        ? { ...exercise, repMin: exercise.repMax, repMax: exercise.repMin }
        : exercise,
    );

    // Keep the session inside the time the user said they have. Exercises are
    // ordered most-important-first, so trimming from the end is safe.
    const budget = context.sessionMinutes;
    if (budget) {
      while (exercises.length > 3 && estimateMinutes(exercises) > budget * 1.2) {
        exercises = exercises.slice(0, -1);
        repairs.push(`Trimmed ${day.weekday} to fit ${budget} minutes.`);
      }
    }

    if (exercises.length === 0) {
      throw new ProgramValidationError(
        `The coach produced an empty session for ${day.weekday}.`,
      );
    }

    return { ...day, exercises, estimatedMinutes: estimateMinutes(exercises) };
  });

  // 4. Order days as the week runs.
  const weekOrder = context.trainingDays;
  days.sort((a, b) => weekOrder.indexOf(a.weekday) - weekOrder.indexOf(b.weekday));

  return { program: { ...program, days }, repairs };
}
