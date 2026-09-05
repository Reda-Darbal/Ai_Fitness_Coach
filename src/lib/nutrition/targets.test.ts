import { describe, expect, it } from "vitest";
import { calculateTargets } from "./targets";

const base = {
  weightKg: 65,
  heightCm: 190,
  age: 30,
  sex: "male" as const,
  trainingDaysPerWeek: 3,
  goal: "gain_muscle" as const,
};

describe("calculateTargets", () => {
  it("computes the reference case (65kg, 190cm, 30y male, 3 days, gain muscle)", () => {
    const t = calculateTargets(base);
    // BMR = 650 + 1187.5 - 150 + 5 = 1692.5; TDEE = 1692.5 * 1.465 ≈ 2480
    expect(t?.bmr).toBe(1693);
    expect(t?.tdee).toBe(2480);
    expect(t?.calories).toBe(2800); // +300 surplus, rounded to 50
    expect(t?.proteinG).toBe(115); // 65 * 1.8 = 117 -> nearest 5
  });

  it("fat loss cuts calories and raises protein per kg", () => {
    const t = calculateTargets({ ...base, goal: "fat_loss" });
    expect(t!.calories).toBeLessThan(2480);
    expect(t?.proteinG).toBe(130); // 65 * 2.0
  });

  it("female offset lowers BMR by 166 vs male", () => {
    const m = calculateTargets(base)!;
    const f = calculateTargets({ ...base, sex: "female" })!;
    expect(m.bmr - f.bmr).toBe(166);
  });

  it("'prefer not to say' sits between the two offsets", () => {
    const m = calculateTargets(base)!;
    const f = calculateTargets({ ...base, sex: "female" })!;
    const o = calculateTargets({ ...base, sex: "other" })!;
    expect(o.bmr).toBeGreaterThan(f.bmr);
    expect(o.bmr).toBeLessThan(m.bmr);
  });

  it("more training days means a higher budget", () => {
    const three = calculateTargets(base)!;
    const five = calculateTargets({ ...base, trainingDaysPerWeek: 5 })!;
    expect(five.calories).toBeGreaterThan(three.calories);
  });

  it("never recommends below 1200 kcal", () => {
    const t = calculateTargets({
      ...base,
      weightKg: 42,
      heightCm: 150,
      age: 60,
      sex: "female",
      trainingDaysPerWeek: 1,
      goal: "fat_loss",
    });
    expect(t!.calories).toBeGreaterThanOrEqual(1200);
  });

  it("returns null when a needed field is missing", () => {
    expect(calculateTargets({ ...base, age: null })).toBeNull();
    expect(calculateTargets({ ...base, sex: null })).toBeNull();
    expect(calculateTargets({ ...base, weightKg: null })).toBeNull();
  });
});
