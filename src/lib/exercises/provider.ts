import type { Exercise, ExerciseDifficulty } from "./types";

export interface ExerciseFilter {
  bodyPart?: string;
  target?: string;
  equipment?: string;
  difficulty?: ExerciseDifficulty;
  /** Case-insensitive match against name, aliases, and target muscle. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ExerciseFacets {
  bodyParts: string[];
  targets: string[];
  equipment: string[];
  difficulties: readonly ExerciseDifficulty[];
}

/**
 * Abstraction over the exercise catalogue. The rest of the app (UI, workout
 * generation, AI candidate filtering) talks to this interface only, so the
 * dataset can be replaced (e.g. exerciseapi.dev) without a rewrite.
 *
 * The catalogue is the source of truth for exercises: the AI selects from
 * IDs that exist here and may never invent its own.
 */
export interface ExerciseProvider {
  list(filter?: ExerciseFilter): Promise<Exercise[]>;
  /** Total matches ignoring limit/offset — for result counts and paging. */
  count(filter?: ExerciseFilter): Promise<number>;
  getById(id: string): Promise<Exercise | null>;
  getByIds(ids: string[]): Promise<Exercise[]>;
  facets(): Promise<ExerciseFacets>;
}
