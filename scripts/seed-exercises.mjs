/**
 * Seeds exercise_cache from the vendored snapshot at src/data/exercises.json.
 *
 *   npm run seed:exercises
 *
 * Idempotent: upserts on primary key, so re-running refreshes the catalogue.
 * Demo GIFs are resolved at runtime from src/data/exercise-gifs*.json (see
 * src/lib/exercises/media.ts) — the original dataset's video host died, so
 * exercise_media is no longer seeded and is cleared here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const CHUNK = 100;

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  console.error(
    "\n  DATABASE_URL is not set (or is still a placeholder).\n" +
      "  Create a Neon project and put its connection string in .env.local\n",
  );
  process.exit(1);
}

const exercises = JSON.parse(
  readFileSync(join(here, "..", "src", "data", "exercises.json"), "utf8"),
);

const client = new pg.Client({ connectionString });
await client.connect();

console.log(`\n  Seeding ${exercises.length} exercises\n`);

let done = 0;
for (let i = 0; i < exercises.length; i += CHUNK) {
  const batch = exercises.slice(i, i + CHUNK);
  try {
    await client.query("begin");
    for (const e of batch) {
      await client.query(
        `insert into public.exercise_cache (
           id, provider, name, aliases, body_part, target, secondary_muscles,
           equipment, difficulty, compound, unilateral, short_description,
           instructions, steps, form_cues, common_mistakes, breathing
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         on conflict (id) do update set
           provider = excluded.provider,
           name = excluded.name,
           aliases = excluded.aliases,
           body_part = excluded.body_part,
           target = excluded.target,
           secondary_muscles = excluded.secondary_muscles,
           equipment = excluded.equipment,
           difficulty = excluded.difficulty,
           compound = excluded.compound,
           unilateral = excluded.unilateral,
           short_description = excluded.short_description,
           instructions = excluded.instructions,
           steps = excluded.steps,
           form_cues = excluded.form_cues,
           common_mistakes = excluded.common_mistakes,
           breathing = excluded.breathing,
           updated_at = now()`,
        [
          e.id,
          "free-exercise-db-with-videos",
          e.name,
          JSON.stringify(e.aliases ?? []),
          e.bodyPart,
          e.target,
          JSON.stringify(e.secondaryMuscles ?? []),
          e.equipment,
          e.difficulty,
          Boolean(e.compound),
          Boolean(e.unilateral),
          e.shortDescription ?? null,
          e.instructions ?? null,
          JSON.stringify(e.steps ?? []),
          JSON.stringify(e.formCues ?? []),
          JSON.stringify(e.commonMistakes ?? []),
          e.breathing ?? null,
        ],
      );

    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(`\n  Failed near row ${i}: ${error.message}\n`);
    await client.end();
    process.exit(1);
  }
  done += batch.length;
  process.stdout.write(`\r  exercises: ${done}/${exercises.length}`);
}

// The original host's URLs are all dead — clear any previously seeded rows.
await client.query("delete from public.exercise_media");

const counts = await client.query(
  "select count(*) as exercises from public.exercise_cache",
);
await client.end();
console.log(`\n\n  Done. ${counts.rows[0].exercises} exercises.\n`);
