"use client";

import Link from "next/link";
import { Clock, Dumbbell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { ProgramDay } from "@/lib/programs/queries";

/** One session in the weekly program. */
export function WorkoutCard({
  day,
  isToday = false,
  href,
  action,
}: {
  day: ProgramDay;
  isToday?: boolean;
  href?: string;
  /** Rendered at the card's foot — e.g. a start button on rest-day views. */
  action?: React.ReactNode;
}) {
  const { dict } = useI18n();
  const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {dict.weekdays[day.weekday].full}
            {isToday ? ` · ${dict.common.today}` : ""}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">
            {day.name}
          </h3>
        </div>
        {isToday ? <Badge>{dict.common.today}</Badge> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Dumbbell className="size-3.5" aria-hidden="true" />
          {fmt(dict.history.summary, {
            exercises: day.exercises.length,
            sets: totalSets,
          })}
        </span>
        {day.estimatedMinutes ? (
          <span className="flex items-center gap-1.5 tabular-nums">
            <Clock className="size-3.5" aria-hidden="true" />
            ~{day.estimatedMinutes} {dict.common.min}
          </span>
        ) : null}
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {day.exercises.slice(0, 4).map((e) => (
          <li key={e.id} className="flex justify-between gap-3 text-sm">
            <span className="truncate text-foreground">
              {e.exercise?.name ?? e.exerciseId}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {e.sets} × {e.repMin}–{e.repMax}
            </span>
          </li>
        ))}
        {day.exercises.length > 4 ? (
          <li className="text-xs text-muted-foreground">
            {fmt(dict.common.more, { n: day.exercises.length - 4 })}
          </li>
        ) : null}
      </ul>

      {action ? <div className="mt-3">{action}</div> : null}
    </>
  );

  const className = `flex flex-col rounded-xl border bg-card p-4 ${
    isToday ? "border-primary/60" : "border-border"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring/70`}
      >
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
