import Link from "next/link";
import { ChevronRight, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/fitness/empty-state";
import { ExerciseCard } from "@/components/fitness/exercise-card";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import { gifUrlFor } from "@/lib/exercises/media";
import { exerciseDifficulties, type ExerciseDifficulty } from "@/lib/exercises/types";
import { ExerciseFilters } from "./exercise-filters";
import { fmt, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Exercises" };

const PAGE_SIZE = 24;
const SECTION_SIZE = 8;

/** Logical browse order — big muscles first, specialties last. */
const BODY_PART_ORDER = [
  "chest",
  "back",
  "shoulders",
  "upper arms",
  "upper legs",
  "hips",
  "waist",
  "lower legs",
  "lower arms",
  "cardio",
  "neck",
];

function bodyPartLabel(dict: Dictionary, part: string): string {
  const table = dict.bodyParts as Record<string, string>;
  return table[part] ?? part;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExercisesPage({
  searchParams,
}: PageProps<"/exercises">) {
  const { dict } = await getI18n();
  const params = await searchParams;

  const difficultyParam = one(params.difficulty);
  const filter = {
    search: one(params.q),
    bodyPart: one(params.bodyPart),
    target: one(params.target),
    equipment: one(params.equipment),
    difficulty: exerciseDifficulties.includes(
      difficultyParam as ExerciseDifficulty,
    )
      ? (difficultyParam as ExerciseDifficulty)
      : undefined,
  };

  const hasFilter = Boolean(
    filter.search || filter.bodyPart || filter.target || filter.equipment || filter.difficulty,
  );

  const facets = await exerciseProvider.facets();

  // No filters: an organized catalogue — one section per body part, demos
  // first, with a "view all" that applies the filter.
  if (!hasFilter) {
    const parts = [...facets.bodyParts].sort(
      (a, b) => BODY_PART_ORDER.indexOf(a) - BODY_PART_ORDER.indexOf(b),
    );
    const sections = await Promise.all(
      parts.map(async (part) => {
        const [count, list] = await Promise.all([
          exerciseProvider.count({ bodyPart: part }),
          exerciseProvider.list({ bodyPart: part, limit: SECTION_SIZE * 3 }),
        ]);
        // Exercises with a demo animation make a better shop window.
        const sorted = [...list].sort(
          (a, b) => Number(Boolean(gifUrlFor(b.id))) - Number(Boolean(gifUrlFor(a.id))),
        );
        return { part, count, exercises: sorted.slice(0, SECTION_SIZE) };
      }),
    );

    return (
      <>
        <PageHeader
          title={dict.exercises.title}
          description={dict.exercises.subtitle}
        />

        <ExerciseFilters
          bodyParts={facets.bodyParts}
          targets={facets.targets}
          equipment={facets.equipment}
          difficulties={facets.difficulties}
        />

        {sections.map(({ part, count, exercises }) => (
          <section key={part} className="mb-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {bodyPartLabel(dict, part)}{" "}
                <span className="font-normal text-muted-foreground tabular-nums">
                  · {count}
                </span>
              </h2>
              <Link
                href={`/exercises?bodyPart=${encodeURIComponent(part)}`}
                className="flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                {fmt(dict.exercises.viewAll, { n: count })}
                <ChevronRight
                  className="size-3.5 rtl:-scale-x-100"
                  aria-hidden="true"
                />
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {exercises.map((exercise) => (
                <li key={exercise.id} className="min-w-0">
                  <ExerciseCard exercise={exercise} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </>
    );
  }

  const limit = Math.min(
    Math.max(Number(one(params.limit)) || PAGE_SIZE, PAGE_SIZE),
    500,
  );

  const [total, exercises] = await Promise.all([
    exerciseProvider.count(filter),
    exerciseProvider.list({ ...filter, limit }),
  ]);

  const remaining = total - exercises.length;

  const nextQuery = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q: filter.search,
    bodyPart: filter.bodyPart,
    target: filter.target,
    equipment: filter.equipment,
    difficulty: filter.difficulty,
  })) {
    if (value) nextQuery.set(key, value);
  }
  nextQuery.set("limit", String(limit + PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={dict.exercises.title}
        description={dict.exercises.subtitle}
      />

      <ExerciseFilters
        bodyParts={facets.bodyParts}
        targets={facets.targets}
        equipment={facets.equipment}
        difficulties={facets.difficulties}
      />

      <p className="mb-3 text-xs text-muted-foreground tabular-nums">
        {total === 1
          ? dict.exercises.countOne
          : fmt(dict.exercises.count, { n: total })}
      </p>

      {exercises.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={dict.exercises.noMatch}
          description={dict.exercises.noMatchBody}
          action={
            <Button asChild size="xl" variant="outline">
              <Link href="/exercises">{dict.exercises.clearFilters}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {exercises.map((exercise, i) => (
              <li key={exercise.id} className="min-w-0">
                <ExerciseCard exercise={exercise} priority={i < 4} />
              </li>
            ))}
          </ul>

          {remaining > 0 ? (
            <div className="mt-6 flex justify-center">
              <Button asChild size="xl" variant="outline">
                <Link href={`/exercises?${nextQuery.toString()}`} scroll={false}>
                  {fmt(dict.exercises.showMore, { n: remaining })}
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
