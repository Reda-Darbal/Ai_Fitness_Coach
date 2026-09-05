import "server-only";
import { z } from "zod";
import rawExercises from "@/data/exercises.json";
import {
  exerciseDifficulties,
  exerciseSchema,
  type Exercise,
} from "./types";
import type {
  ExerciseFacets,
  ExerciseFilter,
  ExerciseProvider,
} from "./provider";

// The vendored snapshot is ~700KB — `server-only` guarantees it can never be
// pulled into a client bundle. Parsed once per server process, then cached.
let cache: Exercise[] | null = null;

function loadAll(): Exercise[] {
  cache ??= z.array(exerciseSchema).parse(rawExercises);
  return cache;
}

function applyFilters(filter?: ExerciseFilter): Exercise[] {
  let result = loadAll();

    if (filter?.bodyPart) {
      result = result.filter((e) => e.bodyPart === filter.bodyPart);
    }
    if (filter?.target) {
      result = result.filter((e) => e.target === filter.target);
    }
    if (filter?.equipment) {
      result = result.filter((e) => e.equipment === filter.equipment);
    }
    if (filter?.difficulty) {
      result = result.filter((e) => e.difficulty === filter.difficulty);
    }
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      if (q.length > 0) {
        result = result.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.target.toLowerCase().includes(q) ||
            e.aliases.some((a) => a.toLowerCase().includes(q)),
        );
      }
    }

  return result;
}

export class FreeExerciseDbProvider implements ExerciseProvider {
  async list(filter?: ExerciseFilter): Promise<Exercise[]> {
    const result = applyFilters(filter);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? result.length;
    return result.slice(offset, offset + limit);
  }

  async count(filter?: ExerciseFilter): Promise<number> {
    return applyFilters(filter).length;
  }

  async getById(id: string): Promise<Exercise | null> {
    return loadAll().find((e) => e.id === id) ?? null;
  }

  async getByIds(ids: string[]): Promise<Exercise[]> {
    const wanted = new Set(ids);
    return loadAll().filter((e) => wanted.has(e.id));
  }

  async facets(): Promise<ExerciseFacets> {
    const all = loadAll();
    return {
      bodyParts: [...new Set(all.map((e) => e.bodyPart))].sort(),
      targets: [...new Set(all.map((e) => e.target))].sort(),
      equipment: [...new Set(all.map((e) => e.equipment))].sort(),
      difficulties: exerciseDifficulties,
    };
  }
}

export const exerciseProvider: ExerciseProvider = new FreeExerciseDbProvider();
