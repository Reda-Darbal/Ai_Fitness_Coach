import { describe, expect, it } from "vitest";
import { recommendProgression, incrementFor } from "./progression";

const base = {
  targetRepMin: 8,
  targetRepMax: 12,
  feedback: null,
  equipment: "leverage machine",
};

const sets = (...pairs: [number, number][]) =>
  pairs.map(([weightKg, reps]) => ({ weightKg, reps }));

describe("recommendProgression — the spec's own examples", () => {
  it("12/12/12 at the top of an 8-12 range -> increase slightly", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 12], [25, 12], [25, 12]),
    });
    expect(rec.action).toBe("increase");
    expect(rec.suggestedWeightKg).toBe(27.5);
    expect(rec.reason).toBe("hit_top_of_range");
  });

  it("8/7/6 with reps falling below the floor -> keep the load", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 8], [25, 7], [25, 6]),
    });
    expect(rec.action).toBe("keep");
    expect(rec.suggestedWeightKg).toBe(25);
    expect(rec.reason).toBe("below_range");
  });

  it("8/7/6 AND the lifter said too hard -> reduce", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 8], [25, 7], [25, 6]),
      feedback: "too_hard",
    });
    expect(rec.action).toBe("decrease");
    expect(rec.suggestedWeightKg).toBe(22.5);
  });
});

describe("recommendProgression — feedback overrides", () => {
  it("too_easy raises the load even mid-range", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 10], [25, 10], [25, 9]),
      feedback: "too_easy",
    });
    expect(rec.action).toBe("increase");
    expect(rec.suggestedWeightKg).toBe(27.5);
  });

  it("pain forces a decrease of at least ~10%", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([60, 10], [60, 10], [60, 10]),
      feedback: "pain",
    });
    expect(rec.action).toBe("decrease");
    expect(rec.reason).toBe("pain_reported");
    // 10% of 60 = 6kg, bigger than the 2.5 step
    expect(rec.suggestedWeightKg).toBe(54);
  });

  it("too_hard beats a top-of-range performance", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 12], [25, 12], [25, 12]),
      feedback: "too_hard",
    });
    expect(rec.action).toBe("decrease");
  });
});

describe("recommendProgression — steady state and history", () => {
  it("reps inside the range -> keep and build", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: sets([25, 12], [25, 10], [25, 9]),
    });
    expect(rec.action).toBe("keep");
    expect(rec.suggestedWeightKg).toBe(25);
    expect(rec.reason).toBe("in_range");
  });

  it("no history -> start, no weight to suggest", () => {
    const rec = recommendProgression({ ...base, previousSets: [] });
    expect(rec.action).toBe("start");
    expect(rec.suggestedWeightKg).toBeNull();
  });

  it("warm-up sets never count toward the decision", () => {
    const rec = recommendProgression({
      ...base,
      previousSets: [
        { weightKg: 10, reps: 15, isWarmup: true },
        ...sets([25, 12], [25, 12], [25, 12]),
      ],
    });
    expect(rec.action).toBe("increase");
    // and the suggestion builds on 25, not the 10kg warm-up
    expect(rec.suggestedWeightKg).toBe(27.5);
  });
});

describe("recommendProgression — equipment", () => {
  it("dumbbells jump by 2kg (the next pair), machines by 2.5", () => {
    expect(incrementFor("dumbbell")).toBe(2);
    expect(incrementFor("leverage machine")).toBe(2.5);
    const rec = recommendProgression({
      ...base,
      equipment: "dumbbell",
      previousSets: sets([12, 12], [12, 12], [12, 12]),
    });
    expect(rec.suggestedWeightKg).toBe(14);
  });

  it("bodyweight work progresses by reps, not kilograms", () => {
    const rec = recommendProgression({
      ...base,
      equipment: "body weight",
      previousSets: [
        { weightKg: null, reps: 12 },
        { weightKg: null, reps: 12 },
        { weightKg: null, reps: 12 },
      ],
    });
    expect(rec.repsMode).toBe(true);
    expect(rec.action).toBe("increase");
    expect(rec.suggestedWeightKg).toBeNull();
  });

  it("unknown equipment falls back to a 2.5 step", () => {
    expect(incrementFor("mystery machine")).toBe(2.5);
  });
});
