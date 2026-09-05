import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import type { Exercise } from "@/lib/exercises/types";
import type { Weekday } from "@/lib/profile/constants";

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes: string | null;
  exercise: Exercise | null;
}

export interface ProgramDay {
  id: string;
  weekday: Weekday;
  name: string;
  focus: string | null;
  estimatedMinutes: number | null;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  title: string;
  goal: string;
  status: string;
  createdAt: string;
  days: ProgramDay[];
}

interface DayRow {
  id: string;
  weekday: Weekday;
  name: string;
  focus: string | null;
  estimated_minutes: number | null;
  order_index: number;
}

interface ExerciseRow {
  id: string;
  program_day_id: string;
  exercise_id: string;
  order_index: number;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  notes: string | null;
}

/**
 * The user's active program with days and exercises hydrated from the
 * catalogue. userId first and filtered on — the authorization boundary.
 */
export async function getActiveProgramFor(
  userId: string,
): Promise<Program | null> {
  const sql = db();

  const programs = (await sql`
    select id, title, goal, status, created_at
      from programs
     where user_id = ${userId} and status = 'active'
     order by created_at desc
     limit 1
  `) as unknown as {
    id: string;
    title: string;
    goal: string;
    status: string;
    created_at: Date | string;
  }[];

  const program = programs[0];
  if (!program) return null;

  const [dayRows, exerciseRows] = await Promise.all([
    sql`
      select id, weekday, name, focus, estimated_minutes, order_index
        from program_days
       where user_id = ${userId} and program_id = ${program.id}
       order by order_index
    ` as unknown as Promise<DayRow[]>,
    sql`
      select pe.id, pe.program_day_id, pe.exercise_id, pe.order_index,
             pe.sets, pe.rep_min, pe.rep_max, pe.rest_seconds, pe.notes
        from program_exercises pe
        join program_days pd on pd.id = pe.program_day_id
       where pe.user_id = ${userId} and pd.program_id = ${program.id}
       order by pe.order_index
    ` as unknown as Promise<ExerciseRow[]>,
  ]);

  const catalogue = await exerciseProvider.getByIds(
    exerciseRows.map((r) => r.exercise_id),
  );
  const byId = new Map(catalogue.map((e) => [e.id, e]));

  const days: ProgramDay[] = dayRows.map((day) => ({
    id: day.id,
    weekday: day.weekday,
    name: day.name,
    focus: day.focus,
    estimatedMinutes: day.estimated_minutes,
    exercises: exerciseRows
      .filter((e) => e.program_day_id === day.id)
      .map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        orderIndex: e.order_index,
        sets: e.sets,
        repMin: e.rep_min,
        repMax: e.rep_max,
        restSeconds: e.rest_seconds,
        notes: e.notes,
        exercise: byId.get(e.exercise_id) ?? null,
      })),
  }));

  return {
    id: program.id,
    title: program.title,
    goal: program.goal,
    status: program.status,
    createdAt:
      program.created_at instanceof Date
        ? program.created_at.toISOString()
        : String(program.created_at),
    days,
  };
}

/** Never throws — pages use it for rendering decisions. */
export async function getActiveProgram(userId: string | null): Promise<{
  program: Program | null;
  error: string | null;
}> {
  if (!userId || !isDatabaseConfigured()) {
    return { program: null, error: null };
  }
  try {
    return { program: await getActiveProgramFor(userId), error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("getActiveProgram:", message);
    return { program: null, error: message };
  }
}

/** Today's session, or null on a rest day. */
export function todaysDay(program: Program | null): ProgramDay | null {
  if (!program) return null;
  const weekdays: Weekday[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const today = weekdays[(new Date().getDay() + 6) % 7];
  return program.days.find((d) => d.weekday === today) ?? null;
}
