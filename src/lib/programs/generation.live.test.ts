import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import Together from "together-ai";
import { generatedProgramSchema } from "./schema";
import { validateProgram } from "./validate";

/**
 * Live end-to-end check: a real Together AI call through the real schema and
 * the real validation rules.
 *
 * SKIPPED unless TOGETHER_API_KEY and TOGETHER_MODEL are in the environment,
 * so `npm test` stays offline and free. To run it:
 *
 *   node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/lib/programs/generation.live.test.ts
 *
 * Worth running after changing the prompt, and whenever Together retires a
 * model — they do that often, and a dead TOGETHER_MODEL fails here loudly
 * instead of silently breaking the generate button.
 */
const KEY = process.env.TOGETHER_API_KEY;
const MODEL = process.env.TOGETHER_MODEL;

describe.runIf(KEY && MODEL)("program generation (live)", () => {
  it("produces a valid program using only offered exercise ids", async () => {
    const all = JSON.parse(readFileSync("src/data/exercises.json", "utf8"));

    const candidates = all
      .filter(
        (e: { equipment: string; difficulty: string; bodyPart: string }) =>
          ["leverage machine", "cable", "dumbbell"].includes(e.equipment) &&
          e.difficulty === "beginner" &&
          e.bodyPart !== "cardio",
      )
      .slice(0, 60);

    const byPart: Record<string, string[]> = {};
    for (const e of candidates) {
      (byPart[e.bodyPart] ??= []).push(
        `  ${e.id} | ${e.name} | ${e.equipment} | ${e.target}`,
      );
    }

    const prompt = [
      "CLIENT",
      "- goal: Gain muscle",
      "- experience: beginner",
      "- training days: Monday, Wednesday, Friday",
      "- time per session: 60 minutes",
      "",
      "CANDIDATE EXERCISES (choose only from these)",
      ...Object.entries(byPart).flatMap(([p, l]) => [`${p}:`, ...l]),
      "",
      "Write a 3-day weekly program using weekday keys: monday, wednesday, friday.",
    ].join("\n");

    const together = new Together({ apiKey: KEY });
    const res = await together.chat.completions.create({
      model: MODEL as string,
      messages: [
        {
          role: "system",
          content:
            "You are a careful personal trainer. Choose exercises ONLY from the candidate list, using the exact exerciseId strings. Produce exactly one session per training day. Beginners: 4-6 exercises, 2-4 sets, 8-12 reps, 60-120s rest. Reply with JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "weekly_program",
          schema: z.toJSONSchema(generatedProgramSchema),
        },
      },
    } as never);

    const content = res.choices?.[0]?.message?.content;
    expect(content, "model returned empty content").toBeTruthy();

    // 1. Does it satisfy our Zod contract?
    const parsed = generatedProgramSchema.parse(JSON.parse(content as string));
    console.log(`\n  title: ${parsed.title}`);
    console.log(`  days: ${parsed.days.map((d) => d.weekday).join(", ")}`);
    for (const d of parsed.days) {
      console.log(
        `  ${d.weekday}: ${d.exercises.length} exercises — ${d.exercises
          .map((e) => e.exerciseId)
          .join(", ")}`,
      );
    }

    // 2. Do the business rules accept it?
    const result = validateProgram(parsed, {
      candidateIds: new Set(candidates.map((c: { id: string }) => c.id)),
      trainingDays: ["monday", "wednesday", "friday"],
      sessionMinutes: 60,
    });

    console.log(`  repairs: ${result.repairs.length}`);
    expect(result.program.days.length).toBeGreaterThan(0);
    for (const d of result.program.days) {
      expect(d.exercises.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
