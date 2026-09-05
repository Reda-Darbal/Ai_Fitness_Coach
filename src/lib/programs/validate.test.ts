import { describe, expect, it } from "vitest";
import { validateProgram, ProgramValidationError } from "./validate";
import type { GeneratedProgram } from "./schema";

const context = {
  candidateIds: new Set(["0025", "0033", "0047", "0061"]),
  trainingDays: ["monday", "wednesday", "friday"] as const,
  sessionMinutes: 60,
};

const ex = (id: string, over: Partial<{ sets: number; repMin: number; repMax: number; restSeconds: number }> = {}) => ({
  exerciseId: id,
  sets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
  notes: "Controlled tempo",
  ...over,
});

const program = (days: GeneratedProgram["days"]): GeneratedProgram => ({
  title: "Full Body",
  days,
});

const day = (weekday: string, exercises = [ex("0025"), ex("0033")]) =>
  ({
    weekday,
    name: "Full Body A",
    focus: "full_body",
    estimatedMinutes: 60,
    exercises,
  }) as GeneratedProgram["days"][number];

describe("validateProgram — the AI may not invent exercises", () => {
  it("rejects an exercise id that was never offered", () => {
    const p = program([day("monday", [ex("0025"), ex("9999")])]);
    expect(() =>
      validateProgram(p, { ...context, trainingDays: [...context.trainingDays] }),
    ).toThrow(ProgramValidationError);
  });

  it("rejects a plausible-looking but unknown id", () => {
    const p = program([day("monday", [ex("barbell-bench-press")])]);
    expect(() =>
      validateProgram(p, { ...context, trainingDays: [...context.trainingDays] }),
    ).toThrow(/does not exist/);
  });

  it("accepts a program built only from candidates", () => {
    const p = program([day("monday"), day("wednesday"), day("friday")]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    expect(result.program.days).toHaveLength(3);
  });
});

describe("validateProgram — schedule", () => {
  it("drops a session on a day the user does not train", () => {
    const p = program([day("monday"), day("sunday")]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    expect(result.program.days.map((d) => d.weekday)).toEqual(["monday"]);
    expect(result.repairs.join(" ")).toContain("sunday");
  });

  it("drops a duplicated weekday", () => {
    const p = program([day("monday"), day("monday")]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    expect(result.program.days).toHaveLength(1);
  });

  it("throws when nothing lands on a training day", () => {
    const p = program([day("sunday")]);
    expect(() =>
      validateProgram(p, { ...context, trainingDays: [...context.trainingDays] }),
    ).toThrow(/training days/);
  });

  it("orders days as the week runs", () => {
    const p = program([day("friday"), day("monday"), day("wednesday")]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    expect(result.program.days.map((d) => d.weekday)).toEqual([
      "monday",
      "wednesday",
      "friday",
    ]);
  });
});

describe("validateProgram — repairs", () => {
  it("removes an exercise repeated within one day", () => {
    const p = program([day("monday", [ex("0025"), ex("0025"), ex("0033")])]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    expect(result.program.days[0].exercises).toHaveLength(2);
  });

  it("swaps a reversed rep range", () => {
    const p = program([day("monday", [ex("0025", { repMin: 12, repMax: 8 })])]);
    const result = validateProgram(p, {
      ...context,
      trainingDays: [...context.trainingDays],
    });
    const fixed = result.program.days[0].exercises[0];
    expect(fixed.repMin).toBe(8);
    expect(fixed.repMax).toBe(12);
  });

  it("trims a session that overruns the time budget", () => {
    const many = [
      ex("0025", { sets: 5, restSeconds: 180 }),
      ex("0033", { sets: 5, restSeconds: 180 }),
      ex("0047", { sets: 5, restSeconds: 180 }),
      ex("0061", { sets: 5, restSeconds: 180 }),
    ];
    const result = validateProgram(program([day("monday", many)]), {
      ...context,
      trainingDays: [...context.trainingDays],
      sessionMinutes: 30,
    });
    expect(result.program.days[0].exercises.length).toBeLessThan(4);
    expect(result.repairs.join(" ")).toContain("30 minutes");
  });

  it("never trims below three exercises", () => {
    const many = [
      ex("0025", { sets: 8, restSeconds: 300 }),
      ex("0033", { sets: 8, restSeconds: 300 }),
      ex("0047", { sets: 8, restSeconds: 300 }),
    ];
    const result = validateProgram(program([day("monday", many)]), {
      ...context,
      trainingDays: [...context.trainingDays],
      sessionMinutes: 15,
    });
    expect(result.program.days[0].exercises).toHaveLength(3);
  });

  it("recomputes estimated minutes from the real set list", () => {
    const result = validateProgram(
      program([day("monday", [ex("0025", { sets: 3, restSeconds: 60 })])]),
      { ...context, trainingDays: [...context.trainingDays] },
    );
    // 3 sets x (40s work + 60s rest) = 300s = 5 min
    expect(result.program.days[0].estimatedMinutes).toBe(5);
  });
});
