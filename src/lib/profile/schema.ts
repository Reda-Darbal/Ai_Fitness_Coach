import { z } from "zod";
import {
  COACH_LANGUAGES,
  EXPERIENCE_LEVELS,
  GOALS,
  PREFERRED_TIMES,
  SESSION_MINUTES,
  SEXES,
  WEEKDAYS,
} from "./constants";

/** Trims free text and turns blanks into null so the DB never stores "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

/**
 * Field definitions with no object-level refinement, so step schemas can be
 * derived with .pick() (Zod 4 refuses .pick() on a refined object).
 */
const profileFieldsSchema = z.object({
  age: z.number().int().min(13, "Must be 13 or older").max(100),
  sex: z.enum(SEXES),
  heightCm: z.number().min(100, "Height looks too low").max(250),
  currentWeightKg: z.number().min(30).max(300),
  targetWeightKg: z.number().min(30).max(300).nullable(),

  goal: z.enum(GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),

  trainingDays: z
    .array(z.enum(WEEKDAYS))
    .min(1, "Pick at least one training day")
    .max(7),
  preferredTime: z.enum(PREFERRED_TIMES),
  sessionMinutes: z.literal(SESSION_MINUTES),

  equipment: z.array(z.string().min(1)).min(1, "Pick at least one option"),

  injuries: optionalText(500),
  likedExercises: optionalText(500),
  dislikedExercises: optionalText(500),
  notes: optionalText(1000),

  coachLanguage: z.enum(COACH_LANGUAGES),
  conciseReplies: z.boolean(),
});

/** Full payload — what the server action validates before writing. */
export const profileInputSchema = profileFieldsSchema.refine(
  (v) =>
    v.targetWeightKg === null ||
    Math.abs(v.targetWeightKg - v.currentWeightKg) <= 100,
  {
    path: ["targetWeightKg"],
    error: "That target is very far from your current weight",
  },
);

export type ProfileInput = z.infer<typeof profileInputSchema>;

/**
 * Per-step schemas. The flow validates a step before advancing so errors land
 * next to the field that caused them; the server then re-validates the whole
 * payload — client checks are UX, never the security boundary.
 */
export const stepSchemas = {
  basics: profileFieldsSchema.pick({
    age: true,
    sex: true,
    heightCm: true,
    currentWeightKg: true,
  }),
  goal: profileFieldsSchema.pick({ goal: true, targetWeightKg: true }),
  experience: profileFieldsSchema.pick({ experienceLevel: true }),
  schedule: profileFieldsSchema.pick({
    trainingDays: true,
    preferredTime: true,
    sessionMinutes: true,
  }),
  equipment: profileFieldsSchema.pick({ equipment: true }),
  preferences: profileFieldsSchema.pick({
    injuries: true,
    likedExercises: true,
    dislikedExercises: true,
    notes: true,
    coachLanguage: true,
    conciseReplies: true,
  }),
} as const;

export type StepKey = keyof typeof stepSchemas;

/** Settings edits are partial — same rules, every field optional. */
export const profilePatchSchema = profileFieldsSchema.partial();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/**
 * Shape held by the onboarding form. Numeric answers live as strings while
 * being typed (so a half-typed or cleared field stays editable) and are
 * converted once, at validation time.
 */
export interface OnboardingFormState {
  age: string;
  sex?: (typeof SEXES)[number];
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  goal?: (typeof GOALS)[number];
  experienceLevel?: (typeof EXPERIENCE_LEVELS)[number];
  trainingDays: (typeof WEEKDAYS)[number][];
  preferredTime?: (typeof PREFERRED_TIMES)[number];
  sessionMinutes: (typeof SESSION_MINUTES)[number];
  equipment: string[];
  injuries: string;
  likedExercises: string;
  dislikedExercises: string;
  notes: string;
  coachLanguage: (typeof COACH_LANGUAGES)[number];
  conciseReplies: boolean;
}

const toNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Form state -> the payload the schemas and server action expect. */
export function formStateToPayload(state: OnboardingFormState) {
  return {
    age: toNumber(state.age),
    sex: state.sex,
    heightCm: toNumber(state.heightCm),
    currentWeightKg: toNumber(state.currentWeightKg),
    targetWeightKg: toNumber(state.targetWeightKg) ?? null,
    goal: state.goal,
    experienceLevel: state.experienceLevel,
    trainingDays: state.trainingDays,
    preferredTime: state.preferredTime,
    sessionMinutes: state.sessionMinutes,
    equipment: state.equipment,
    injuries: state.injuries,
    likedExercises: state.likedExercises,
    dislikedExercises: state.dislikedExercises,
    notes: state.notes,
    coachLanguage: state.coachLanguage,
    conciseReplies: state.conciseReplies,
  };
}

/** Zod's "expected number, received undefined" is useless to a beginner. */
export function humanizeIssue(message: string): string {
  if (message.includes("expected number") || message.includes("expected string")) {
    return "Required";
  }
  if (message.includes("Invalid option") || message.includes("expected one of")) {
    return "Pick one";
  }
  return message;
}
