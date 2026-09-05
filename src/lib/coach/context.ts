import "server-only";
import { db } from "@/lib/db/client";
import { getLatestCheckinFor } from "@/lib/checkins/queries";
import { getActiveProgramFor, todaysDay } from "@/lib/programs/queries";
import { getWeightStatsFor } from "@/lib/weight/queries";
import { getPersonalRecordsFor } from "@/lib/workouts/history";
import { GOAL_LABELS } from "@/lib/profile/constants";
import { recommendProgression } from "@/lib/workouts/progression";
import type { SetFeedback } from "@/lib/workouts/queries";
import type { Profile } from "@/lib/profile/queries";

/**
 * The compact structured bundle the coach reads — profile facts, today's
 * session with its deterministic recommendations, weight trend, latest
 * check-in, PRs and durable memories. Built fresh per message, in English
 * (it feeds a prompt, not a screen), and deliberately small: the spec's cost
 * rules say summaries, never whole histories.
 *
 * Question-scoped retrieval: when the user's message names an exercise we
 * know, that exercise's recent sets are pulled in too.
 */
export async function buildCoachContext(
  userId: string,
  profile: Profile,
  question: string,
): Promise<string> {
  const [program, weight, checkin, records, memories] = await Promise.all([
    getActiveProgramFor(userId).catch(() => null),
    getWeightStatsFor(userId).catch(() => null),
    getLatestCheckinFor(userId).catch(() => null),
    getPersonalRecordsFor(userId, 3).catch(() => []),
    getMemoriesFor(userId).catch(() => []),
  ]);

  const lines: string[] = ["CLIENT CONTEXT"];

  lines.push(
    `- goal: ${GOAL_LABELS[profile.goal].title}; experience: ${profile.experienceLevel}; trains ${profile.trainingDays.join(", ")}; ${profile.sessionMinutes ?? 60} min/session`,
  );
  if (profile.injuries) lines.push(`- injuries/limits: ${profile.injuries}`);

  if (weight?.currentKg != null) {
    let weightLine = `- body weight: ${weight.currentKg} kg`;
    if (profile.targetWeightKg) weightLine += ` (target ${profile.targetWeightKg} kg)`;
    if (weight.trendKg != null) {
      weightLine += `; weekly-average trend ${weight.trendKg > 0 ? "+" : ""}${weight.trendKg} kg vs last week`;
    }
    lines.push(weightLine);
  }

  const today = todaysDay(program);
  if (today) {
    const previous = await lastSetsByExercise(
      userId,
      today.exercises.map((e) => e.exerciseId),
    );
    lines.push(`- TODAY'S SESSION: ${today.name}`);
    for (const item of today.exercises) {
      const history = previous.get(item.exerciseId);
      const rec = recommendProgression({
        targetRepMin: item.repMin,
        targetRepMax: item.repMax,
        previousSets: history?.sets ?? [],
        feedback: history?.feedback ?? null,
        equipment: item.exercise?.equipment ?? "unknown",
      });
      let line = `    ${item.exercise?.name ?? item.exerciseId}: ${item.sets}x${item.repMin}-${item.repMax}, rest ${item.restSeconds}s`;
      if (rec.suggestedWeightKg != null) {
        line += `; recommended ${rec.suggestedWeightKg} kg (rule: ${rec.reason.replace(/_/g, " ")})`;
      } else if (rec.action === "start") {
        line += "; first time — pick a learnable weight";
      }
      lines.push(line);
    }
  } else if (program) {
    lines.push(
      `- today is a rest day; program days: ${program.days.map((d) => `${d.weekday} (${d.name})`).join(", ")}`,
    );
  } else {
    lines.push("- no training program generated yet");
  }

  if (checkin) lines.push(`- last weekly check-in: ${checkin.summary}`);

  if (records.length > 0) {
    lines.push(
      `- personal records: ${records.map((r) => `${r.name} ${r.weightKg}kg`).join(", ")}`,
    );
  }

  if (memories.length > 0) {
    lines.push(
      `- remembered about the client: ${memories.map((m) => `${m.key}=${m.value}`).join("; ")}`,
    );
  }

  // Question-scoped retrieval: recent sets for any exercise the question names.
  const mentioned = await findMentionedExerciseSets(userId, question, program);
  if (mentioned) lines.push(mentioned);

  return lines.join("\n");
}

/** Latest completed session's working sets + feedback, per exercise. */
async function lastSetsByExercise(
  userId: string,
  exerciseIds: string[],
): Promise<
  Map<
    string,
    {
      sets: { weightKg: number | null; reps: number | null; isWarmup: boolean }[];
      feedback: SetFeedback | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      sets: { weightKg: number | null; reps: number | null; isWarmup: boolean }[];
      feedback: SetFeedback | null;
    }
  >();
  if (exerciseIds.length === 0) return result;

  const rows = (await db()`
    with last_we as (
      select distinct on (we.exercise_id) we.id, we.exercise_id, we.feedback
        from workout_exercises we
        join workout_sessions s on s.id = we.session_id
       where we.user_id = ${userId}
         and we.exercise_id = any(${exerciseIds})
         and s.completed_at is not null
         and we.skipped = false
       order by we.exercise_id, s.completed_at desc
    )
    select lw.exercise_id, lw.feedback, ws.weight_kg, ws.reps, ws.is_warmup
      from last_we lw
      join workout_sets ws on ws.workout_exercise_id = lw.id
     order by lw.exercise_id, ws.set_index
  `) as unknown as {
    exercise_id: string;
    feedback: SetFeedback | null;
    weight_kg: string | number | null;
    reps: number | null;
    is_warmup: boolean;
  }[];

  for (const row of rows) {
    const entry = result.get(row.exercise_id) ?? {
      sets: [],
      feedback: row.feedback,
    };
    entry.sets.push({
      weightKg:
        row.weight_kg === null
          ? null
          : typeof row.weight_kg === "string"
            ? Number(row.weight_kg)
            : row.weight_kg,
      reps: row.reps,
      isWarmup: row.is_warmup,
    });
    result.set(row.exercise_id, entry);
  }
  return result;
}

export async function getMemoriesFor(
  userId: string,
  limit = 10,
): Promise<{ key: string; value: string }[]> {
  return (await db()`
    select key, value from coach_memory
     where user_id = ${userId}
     order by updated_at desc
     limit ${limit}
  `) as unknown as { key: string; value: string }[];
}

async function findMentionedExerciseSets(
  userId: string,
  question: string,
  program: Awaited<ReturnType<typeof getActiveProgramFor>>,
): Promise<string | null> {
  if (!program) return null;
  const q = question.toLowerCase();

  const all = program.days.flatMap((d) => d.exercises);
  const hit = all.find((e) => {
    const name = e.exercise?.name.toLowerCase();
    return name && name.length > 3 && q.includes(name.split(" ")[0]) && q.includes(name.split(" ").at(-1) ?? "");
  });
  if (!hit?.exercise) return null;

  const rows = (await db()`
    select ws.weight_kg, ws.reps, s.completed_at
      from workout_sets ws
      join workout_exercises we on we.id = ws.workout_exercise_id
      join workout_sessions s on s.id = we.session_id
     where ws.user_id = ${userId}
       and we.exercise_id = ${hit.exerciseId}
       and ws.is_warmup = false
       and s.completed_at is not null
     order by s.completed_at desc, ws.set_index
     limit 6
  `) as unknown as {
    weight_kg: string | number | null;
    reps: number | null;
    completed_at: Date | string;
  }[];

  if (rows.length === 0) return null;
  const sets = rows
    .map((r) => `${r.weight_kg ?? "?"}kg x ${r.reps ?? "?"}`)
    .join(", ");
  return `- recent sets for ${hit.exercise.name} (newest first): ${sets}`;
}
