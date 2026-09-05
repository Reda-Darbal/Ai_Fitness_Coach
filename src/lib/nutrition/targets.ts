/**
 * Daily calorie and protein targets — deterministic, per the spec's rule that
 * plain code does the maths and the AI only explains. Mifflin-St Jeor BMR, an
 * activity factor from training days, and a goal adjustment. Estimates for
 * healthy adults, not medical advice; the UI says so.
 */

import type { Goal, Sex } from "@/lib/profile/constants";

export interface TargetsInput {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  trainingDaysPerWeek: number;
  goal: Goal;
}

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  bmr: number;
  tdee: number;
}

/** Extra calories per day on top of maintenance, by goal. */
const GOAL_CALORIE_DELTA: Record<Goal, number> = {
  gain_muscle: 300,
  gain_weight: 400,
  strength: 150,
  fat_loss: -400,
  general_fitness: 0,
};

/** Grams of protein per kg of body weight, by goal. */
const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  gain_muscle: 1.8,
  gain_weight: 1.8,
  strength: 1.8,
  fat_loss: 2.0,
  general_fitness: 1.6,
};

function activityFactor(trainingDays: number): number {
  if (trainingDays >= 5) return 1.55;
  if (trainingDays >= 3) return 1.465;
  return 1.375;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Null when the profile is missing a needed field — the UI asks for it. */
export function calculateTargets(input: TargetsInput): NutritionTargets | null {
  const { weightKg, heightCm, age, sex } = input;
  if (weightKg == null || heightCm == null || age == null || sex == null) {
    return null;
  }

  // Mifflin-St Jeor. "Prefer not to say" gets the midpoint of the two offsets.
  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * activityFactor(input.trainingDaysPerWeek);
  const calories = Math.max(1200, roundTo(tdee + GOAL_CALORIE_DELTA[input.goal], 50));
  const proteinG = roundTo(weightKg * GOAL_PROTEIN_PER_KG[input.goal], 5);

  return {
    calories,
    proteinG,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  };
}
