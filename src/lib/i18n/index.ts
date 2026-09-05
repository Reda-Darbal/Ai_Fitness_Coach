import { en, type Dictionary } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";
import { fr } from "./dictionaries/fr";

export type { Dictionary };

export const LOCALES = ["en", "ar", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";


export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

const dictionaries: Record<Locale, Dictionary> = { en, ar, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

/** Fills {placeholders} in a dictionary string: fmt(dict.x, { n: 3 }). */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Equipment labels come from the dictionary; unknown values fall back raw. */
export function equipmentLabelFrom(
  dict: Dictionary,
  value: string,
): { title: string; hint?: string } {
  const table = dict.equipmentLabels as Record<
    string,
    { title: string; hint: string }
  >;
  const entry = table[value];
  if (!entry) return { title: value };
  return { title: entry.title, hint: entry.hint || undefined };
}
