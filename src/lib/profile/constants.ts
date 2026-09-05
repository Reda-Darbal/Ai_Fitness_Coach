/**
 * Onboarding vocabulary. These values are the contract between the UI, the
 * Zod schemas, and the CHECK constraints in db/migrations/0001 — change
 * one and you must change all three.
 */

export const SEXES = ["male", "female", "other"] as const;

export const GOALS = [
  "gain_muscle",
  "gain_weight",
  "strength",
  "fat_loss",
  "general_fitness",
] as const;

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const PREFERRED_TIMES = [
  "morning",
  "afternoon",
  "evening",
  "flexible",
] as const;

export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

export const COACH_LANGUAGES = ["en", "ar", "fr"] as const;

export type Sex = (typeof SEXES)[number];
export type Goal = (typeof GOALS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type PreferredTime = (typeof PREFERRED_TIMES)[number];
export type CoachLanguage = (typeof COACH_LANGUAGES)[number];


// GOAL_LABELS / WEEKDAY_LABELS stay ENGLISH on purpose: they feed AI
// prompts, not screens. UI labels live in the i18n dictionaries.
export const GOAL_LABELS: Record<Goal, { title: string; description: string }> = {
  gain_muscle: {
    title: "Gain muscle",
    description: "Build size with progressive overload",
  },
  gain_weight: {
    title: "Gain body weight",
    description: "Add weight steadily, mostly as muscle",
  },
  strength: {
    title: "Get stronger",
    description: "Lift heavier over time",
  },
  fat_loss: {
    title: "Lose fat",
    description: "Keep muscle while losing weight",
  },
  general_fitness: {
    title: "General fitness",
    description: "Stay healthy and consistent",
  },
};

export const EXPERIENCE_LABELS: Record<
  ExperienceLevel,
  { title: string; description: string }
> = {
  beginner: {
    title: "Beginner",
    description: "New to the gym, or back after a long break",
  },
  intermediate: {
    title: "Intermediate",
    description: "Training consistently for 6+ months",
  },
  advanced: {
    title: "Advanced",
    description: "Years of structured training",
  },
};

export const WEEKDAY_LABELS: Record<Weekday, { full: string; short: string }> = {
  monday: { full: "Monday", short: "Mon" },
  tuesday: { full: "Tuesday", short: "Tue" },
  wednesday: { full: "Wednesday", short: "Wed" },
  thursday: { full: "Thursday", short: "Thu" },
  friday: { full: "Friday", short: "Fri" },
  saturday: { full: "Saturday", short: "Sat" },
  sunday: { full: "Sunday", short: "Sun" },
};


export const COACH_LANGUAGE_LABELS: Record<CoachLanguage, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

/**
 * Presentation order for equipment — most common beginner gym kit first,
 * rather than the catalogue's alphabetical order. Unknown values sort last so
 * a dataset change adds options instead of hiding them.
 */
const EQUIPMENT_ORDER = [
  "leverage machine",
  "cable",
  "dumbbell",
  "barbell",
  "smith machine",
  "ez barbell",
  "body weight",
  "kettlebell",
  "band",
  "stability ball",
  "sled machine",
  "rope",
  "weighted",
];

export function sortEquipment(values: string[]): string[] {
  const rank = (v: string) => {
    const i = EQUIPMENT_ORDER.indexOf(v);
    return i === -1 ? EQUIPMENT_ORDER.length : i;
  };
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
