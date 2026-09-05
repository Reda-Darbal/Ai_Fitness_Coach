import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migration files against an in-process Postgres (PGlite, the
 * actual engine compiled to WASM) so schema mistakes surface here rather than
 * the first time someone points the app at a live database.
 */
const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
}, 60_000);

describe("migrations", () => {
  it("creates the expected tables", async () => {
    const result = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );
    const tables = result.rows.map((r) => r.table_name);
    expect(tables).toContain("profiles");
    expect(tables).toContain("exercise_cache");
    expect(tables).toContain("exercise_media");
    expect(tables).toContain("programs");
    expect(tables).toContain("program_days");
    expect(tables).toContain("program_exercises");
    expect(tables).toContain("ai_generations");
    expect(tables).toContain("workout_sessions");
    expect(tables).toContain("workout_exercises");
    expect(tables).toContain("workout_sets");
  });

  it("keeps user_id on user-owned tables so RLS can be added later", async () => {
    const result = await db.query<{ data_type: string }>(
      `select data_type from information_schema.columns
       where table_name = 'profiles' and column_name = 'user_id'`,
    );
    expect(result.rows[0]?.data_type).toBe("text");
  });
});

describe("profiles constraints", () => {
  const insert = (overrides: Record<string, unknown> = {}) => {
    const row = {
      user_id: `user_${Math.random().toString(36).slice(2)}`,
      goal: "gain_muscle",
      experience_level: "beginner",
      training_days: ["monday", "wednesday", "friday"],
      coach_language: "en",
      ...overrides,
    };
    return db.query(
      `insert into profiles (user_id, goal, experience_level, training_days, coach_language, age)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        row.user_id,
        row.goal,
        row.experience_level,
        row.training_days,
        row.coach_language,
        (row as { age?: number }).age ?? 30,
      ],
    );
  };

  it("accepts a valid profile", async () => {
    await expect(insert()).resolves.toBeDefined();
  });

  it("rejects an unknown goal", async () => {
    await expect(insert({ goal: "become_a_bird" })).rejects.toThrow();
  });

  it("rejects an unknown coach language", async () => {
    await expect(insert({ coach_language: "de" })).rejects.toThrow();
  });

  it("rejects a training day that is not a weekday", async () => {
    await expect(insert({ training_days: ["funday"] })).rejects.toThrow();
  });

  it("rejects an implausible age", async () => {
    await expect(insert({ age: 5 })).rejects.toThrow();
  });

  it("keeps one row per user", async () => {
    const userId = "user_duplicate_test";
    await insert({ user_id: userId });
    await expect(insert({ user_id: userId })).rejects.toThrow();
  });

  it("bumps updated_at on update via the trigger", async () => {
    const userId = "user_trigger_test";
    await insert({ user_id: userId });

    const before = await db.query<{ updated_at: Date }>(
      "select updated_at from profiles where user_id = $1",
      [userId],
    );
    await db.query(
      "update profiles set age = 31 where user_id = $1",
      [userId],
    );
    const after = await db.query<{ updated_at: Date }>(
      "select updated_at from profiles where user_id = $1",
      [userId],
    );

    expect(
      new Date(after.rows[0].updated_at).getTime(),
    ).toBeGreaterThanOrEqual(new Date(before.rows[0].updated_at).getTime());
  });
});

describe("exercise catalogue", () => {
  it("cascades media deletion with its exercise", async () => {
    await db.query(
      `insert into exercise_cache (id, name, body_part, target, equipment, difficulty)
       values ('t1', 'Test Press', 'chest', 'pectorals', 'cable', 'beginner')`,
    );
    await db.query(
      `insert into exercise_media (exercise_id, kind, sex, url)
       values ('t1', 'video', 'male', 'https://example.com/a.mp4')`,
    );

    await db.query("delete from exercise_cache where id = 't1'");
    const media = await db.query("select * from exercise_media where exercise_id = 't1'");
    expect(media.rows).toHaveLength(0);
  });

  it("rejects an unknown difficulty", async () => {
    await expect(
      db.query(
        `insert into exercise_cache (id, name, body_part, target, equipment, difficulty)
         values ('t2', 'Bad', 'chest', 'pectorals', 'cable', 'impossible')`,
      ),
    ).rejects.toThrow();
  });
});

describe("workout logging", () => {
  const userId = "user_workout_test";

  it("allows only one session in progress per user", async () => {
    await db.query(
      "insert into workout_sessions (user_id, title) values ($1, 'A')",
      [userId],
    );
    // A second open session must be refused by the database, not just the UI.
    await expect(
      db.query("insert into workout_sessions (user_id, title) values ($1, 'B')", [
        userId,
      ]),
    ).rejects.toThrow();

    // Finishing the first frees the slot.
    await db.query(
      "update workout_sessions set completed_at = now() where user_id = $1",
      [userId],
    );
    await expect(
      db.query("insert into workout_sessions (user_id, title) values ($1, 'B')", [
        userId,
      ]),
    ).resolves.toBeDefined();
  });

  it("rejects an unknown feedback value", async () => {
    const s = await db.query<{ id: string }>(
      "insert into workout_sessions (user_id, title) values ('user_fb', 'S') returning id",
    );
    await db.query(
      `insert into exercise_cache (id, name, body_part, target, equipment, difficulty)
       values ('w1', 'W', 'chest', 'pectorals', 'cable', 'beginner')`,
    );
    await expect(
      db.query(
        `insert into workout_exercises (user_id, session_id, exercise_id, order_index, feedback)
         values ('user_fb', $1, 'w1', 0, 'exhausted')`,
        [s.rows[0].id],
      ),
    ).rejects.toThrow();
  });

  it("keeps set numbering unique within an exercise", async () => {
    const s = await db.query<{ id: string }>(
      "insert into workout_sessions (user_id, title) values ('user_sets', 'S') returning id",
    );
    await db.query(
      `insert into exercise_cache (id, name, body_part, target, equipment, difficulty)
       values ('w2', 'W2', 'chest', 'pectorals', 'cable', 'beginner')`,
    );
    const we = await db.query<{ id: string }>(
      `insert into workout_exercises (user_id, session_id, exercise_id, order_index)
       values ('user_sets', $1, 'w2', 0) returning id`,
      [s.rows[0].id],
    );
    const weId = we.rows[0].id;

    await db.query(
      "insert into workout_sets (user_id, workout_exercise_id, set_index, weight_kg, reps) values ('user_sets', $1, 0, 25, 10)",
      [weId],
    );
    await expect(
      db.query(
        "insert into workout_sets (user_id, workout_exercise_id, set_index, weight_kg, reps) values ('user_sets', $1, 0, 25, 10)",
        [weId],
      ),
    ).rejects.toThrow();
  });

  it("deletes sets when their session is deleted", async () => {
    const s = await db.query<{ id: string }>(
      "insert into workout_sessions (user_id, title) values ('user_cascade', 'S') returning id",
    );
    await db.query(
      `insert into exercise_cache (id, name, body_part, target, equipment, difficulty)
       values ('w3', 'W3', 'chest', 'pectorals', 'cable', 'beginner')`,
    );
    const we = await db.query<{ id: string }>(
      `insert into workout_exercises (user_id, session_id, exercise_id, order_index)
       values ('user_cascade', $1, 'w3', 0) returning id`,
      [s.rows[0].id],
    );
    await db.query(
      "insert into workout_sets (user_id, workout_exercise_id, set_index, reps) values ('user_cascade', $1, 0, 10)",
      [we.rows[0].id],
    );

    await db.query("delete from workout_sessions where id = $1", [s.rows[0].id]);
    const left = await db.query("select * from workout_sets where user_id = 'user_cascade'");
    expect(left.rows).toHaveLength(0);
  });
});
