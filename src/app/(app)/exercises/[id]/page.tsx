import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleAlert, Lightbulb, TrendingUp, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseCard } from "@/components/fitness/exercise-card";
import { ExerciseVideo } from "@/components/fitness/exercise-video";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import { gifUrlFor } from "@/lib/exercises/media";
import { optionalUserId } from "@/lib/db/session";
import { getExerciseHistory } from "@/lib/workouts/history";
import { relativeDay } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import type { Exercise } from "@/lib/exercises/types";

export async function generateMetadata({ params }: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  const exercise = await exerciseProvider.getById(id);
  return { title: exercise?.name ?? "Exercise" };
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="size-4 text-primary" aria-hidden="true" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Same target muscle, different exercise — the basis for a swap. */
async function findSubstitutions(exercise: Exercise): Promise<Exercise[]> {
  const sameTarget = await exerciseProvider.list({ target: exercise.target });
  return sameTarget
    .filter((e) => e.id !== exercise.id)
    .sort((a, b) => {
      // Prefer the same difficulty, then the same equipment.
      const score = (e: Exercise) =>
        (e.difficulty === exercise.difficulty ? 2 : 0) +
        (e.equipment === exercise.equipment ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 4);
}

export default async function ExerciseDetailPage({
  params,
}: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  const { locale, dict } = await getI18n();
  const exercise = await exerciseProvider.getById(id);
  if (!exercise) notFound();

  const userId = await optionalUserId();
  const [substitutions, history] = await Promise.all([
    findSubstitutions(exercise),
    getExerciseHistory(userId, exercise.id),
  ]);
  const gif = gifUrlFor(exercise.id);

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit -ms-2">
        <Link href="/exercises">
          <ArrowLeft className="rtl:-scale-x-100 size-4" aria-hidden="true" />
          {dict.exercises.allExercises}
        </Link>
      </Button>

      <ExerciseVideo src={gif} title={exercise.name} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {exercise.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge className="capitalize">{exercise.target}</Badge>
          <Badge variant="secondary" className="capitalize">
            {exercise.equipment}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {exercise.difficulty}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {exercise.bodyPart}
          </Badge>
          {exercise.compound ? (
            <Badge variant="outline">{dict.exercises.compound}</Badge>
          ) : null}
          {exercise.unilateral ? (
            <Badge variant="outline">{dict.exercises.unilateral}</Badge>
          ) : null}
        </div>
        {exercise.shortDescription ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {exercise.shortDescription}
          </p>
        ) : null}
      </div>

      {history.length > 0 ? (
        <Section icon={TrendingUp} title={dict.exercises.yourHistory}>
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.sessionId}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/history/${entry.sessionId}`}
                    className="text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {relativeDay(entry.completedAt, locale, dict.common)}
                  </Link>
                  {entry.bestWeightKg !== null ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {fmt(dict.exercises.best, { weight: entry.bestWeightKg })}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.sets.map((set) => (
                    <span
                      key={set.setIndex}
                      className="rounded-md bg-muted px-2 py-1 text-xs text-foreground tabular-nums"
                    >
                      {set.weightKg ?? "—"} × {set.reps ?? "—"}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {exercise.secondaryMuscles.length > 0 ? (
        <Section title={dict.exercises.musclesWorked}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground uppercase">
                {dict.exercises.primary}
              </dt>
              <dd className="mt-0.5 text-foreground capitalize">
                {exercise.target}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">
                {dict.exercises.secondary}
              </dt>
              <dd className="mt-0.5 text-foreground capitalize">
                {exercise.secondaryMuscles.join(", ")}
              </dd>
            </div>
          </dl>
        </Section>
      ) : null}

      {exercise.steps.length > 0 ? (
        <Section title={dict.workout.howTo}>
          <ol className="flex flex-col gap-3">
            {exercise.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : exercise.instructions ? (
        <Section title={dict.workout.howTo}>
          <p className="text-sm text-foreground">{exercise.instructions}</p>
        </Section>
      ) : null}

      {exercise.formCues.length > 0 ? (
        <Section icon={Lightbulb} title={dict.exercises.formCues}>
          <ul className="flex flex-col gap-2">
            {exercise.formCues.map((cue, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span aria-hidden="true" className="text-primary">
                  •
                </span>
                {cue}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {exercise.commonMistakes.length > 0 ? (
        <Section icon={CircleAlert} title={dict.exercises.commonMistakes}>
          <ul className="flex flex-col gap-2">
            {exercise.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span aria-hidden="true" className="text-destructive">
                  •
                </span>
                {mistake}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {exercise.breathing ? (
        <Section icon={Wind} title={dict.exercises.breathing}>
          <p className="text-sm text-foreground">{exercise.breathing}</p>
        </Section>
      ) : null}

      {substitutions.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {dict.exercises.similar}
          </h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {substitutions.map((sub) => (
              <li key={sub.id} className="min-w-0">
                <ExerciseCard exercise={sub} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
