import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from "./index";

/**
 * The locale lives in a cookie, mirrored from profiles.coach_language whenever
 * the profile is saved. A cookie rather than a database read because the root
 * layout needs it on every request to set <html lang dir> — a DB round trip
 * there would tax every page for one enum.
 */
export const LOCALE_COOKIE = "app_locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
