/**
 * Deterministic progressive overload — Phase 7.
 *
 * The spec is explicit: this is code, not AI. The rules below decide the
 * recommendation; the coach may only ever explain it. Keeping it pure (no
 * database, no dates) makes every rule testable line by line.
 */

export type ProgressionAction = "increase" | "keep" | "decrease" | "start";

export type ProgressionReason =
  | "no_history"
  | "hit_top_of_range"
  | "marked_too_easy"
  | "in_range"
  | "below_range"
  | "marked_too_hard"
  | "pain_reported";

export type SetFeedback = "too_easy" | "ok" | "too_hard" | "pain" | null;

export interface PreviousSet {
  weightKg: number | null;
  reps: number | null;
  isWarmup?: boolean;
}

export interface ProgressionInput {
  targetRepMin: number;
  targetRepMax: number;
  /** Last completed session's sets for this exercise, in order. */
  previousSets: PreviousSet[];
  /** How that session felt, if the user said. */
  feedback: SetFeedback;
  /** Catalogue equipment value — sets the size of a sensible jump. */
  equipment: string;
}

export interface ProgressionRecommendation {
  action: ProgressionAction;
  reason: ProgressionReason;
  /** Weight to load today; null for unweighted work (progress reps instead). */
  suggestedWeightKg: number | null;
  /** True when the movement has no external load to add. */
  repsMode: boolean;
}

/** Smallest practical jump per equipment type. */
const INCREMENTS: Record<string, number> = {
  dumbbell: 2, // a pair of next-size dumbbells
  kettlebell: 4,
  barbell: 2.5,
  "ez barbell": 2.5,
  "smith machine": 2.5,
  "leverage machine": 2.5, // weight-stack pin
  cable: 2.5,
  "sled machine": 5,
  weighted: 2.5,
};

/** Movements with no meaningful external load — progress by reps, not kg. */
const REPS_ONLY = new Set(["body weight", "band", "stability ball", "rope"]);

function round05(value: number): number {
  return Math.round(value * 2) / 2;
}

export function incrementFor(equipment: string): number {
  return INCREMENTS[equipment] ?? 2.5;
}

/**
 * The rules, in priority order:
 *
 *   1. No usable history            -> start (pick a learnable weight)
 *   2. Pain reported                -> decrease ~10% (and the UI warns)
 *   3. Marked too hard              -> decrease one increment
 *   4. Any set below the rep floor  -> keep (own the range first)
 *   5. Marked too easy              -> increase one increment
 *   6. Every set at/above the top   -> increase one increment
 *   7. Otherwise (inside the range) -> keep
 *
 * The spec's examples fall out directly: 12/12/12 in an 8-12 range increases;
 * 8/7/6 holds — or decreases when the lifter said it was too hard.
 */
export function recommendProgression(
  input: ProgressionInput,
): ProgressionRecommendation {
  const repsMode = REPS_ONLY.has(input.equipment);
  const working = input.previousSets.filter(
    (s) => !s.isWarmup && s.reps !== null,
  );

  if (working.length === 0) {
    return {
      action: "start",
      reason: "no_history",
      suggestedWeightKg: null,
      repsMode,
    };
  }

  const topWeight = working.reduce<number | null>(
    (best, s) =>
      s.weightKg !== null && (best === null || s.weightKg > best)
        ? s.weightKg
        : best,
    null,
  );
  const step = incrementFor(input.equipment);

  const finish = (
    action: ProgressionAction,
    reason: ProgressionReason,
  ): ProgressionRecommendation => {
    if (repsMode || topWeight === null) {
      return { action, reason, suggestedWeightKg: null, repsMode: true };
    }
    let weight = topWeight;
    if (action === "increase") weight = topWeight + step;
    if (action === "decrease") {
      // One increment down, or ~10% for pain — whichever is the bigger relief.
      const drop =
        reason === "pain_reported" ? Math.max(step, topWeight * 0.1) : step;
      weight = Math.max(0, topWeight - drop);
    }
    return {
      action,
      reason,
      suggestedWeightKg: round05(weight),
      repsMode: false,
    };
  };

  if (input.feedback === "pain") return finish("decrease", "pain_reported");
  if (input.feedback === "too_hard") return finish("decrease", "marked_too_hard");

  const allReps = working.map((s) => s.reps as number);
  const anyBelowFloor = allReps.some((r) => r < input.targetRepMin);

  if (anyBelowFloor) return finish("keep", "below_range");
  if (input.feedback === "too_easy") return finish("increase", "marked_too_easy");

  const allAtTop = allReps.every((r) => r >= input.targetRepMax);
  if (allAtTop) return finish("increase", "hit_top_of_range");

  return finish("keep", "in_range");
}
