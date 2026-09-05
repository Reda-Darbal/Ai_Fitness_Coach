import { fmt } from "@/lib/i18n";

/** Shared display helpers. Pass the active locale so dates read naturally. */

export function formatDate(iso: string, locale = "en"): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export interface RelativeDayLabels {
  today: string;
  yesterday: string;
  daysAgo: string;
  lastWeek: string;
}

const EN_LABELS: RelativeDayLabels = {
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: "{n} days ago",
  lastWeek: "Last week",
};

export function relativeDay(
  iso: string,
  locale = "en",
  labels: RelativeDayLabels = EN_LABELS,
): string {
  const then = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(then)) / 86_400_000,
  );
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  if (days < 7) return fmt(labels.daysAgo, { n: days });
  if (days < 14) return labels.lastWeek;
  return formatDate(iso, locale);
}

/** 12500 -> "12.5k" so big volume numbers stay readable on a phone. */
export function compactKg(value: number): string {
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}
