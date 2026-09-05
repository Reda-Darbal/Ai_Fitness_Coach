import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Clock, Dumbbell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/fitness/empty-state";
import { GenerateProgramButton } from "@/components/fitness/generate-program-button";
import { WorkoutCard } from "@/components/fitness/workout-card";
import { optionalUserId } from "@/lib/db/session";
import { gifUrlFor } from "@/lib/exercises/media";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getActiveProgram, todaysDay } from "@/lib/programs/queries";
import { getActiveSessionId } from "@/lib/workouts/queries";
import { StartWorkoutButton } from "@/components/fitness/start-workout-button";
import Image from "next/image";

export const metadata = { title: "Workout" };

export default async function WorkoutPage() {
  const { dict } = await getI18n();
  const userId = await optionalUserId();
  const { program } = await getActiveProgram(userId);
  const today = todaysDay(program);

  // An unfinished session takes priority: resume it rather than starting over.
  const activeSessionId = userId ? await getActiveSessionId(userId) : null;
  if (activeSessionId) redirect(`/workout/${activeSessionId}`);

  if (!program) {
    return (
      <>
        <PageHeader
          title={dict.workout.title}
          description={dict.workout.subtitle}
        />
        <EmptyState
          icon={CalendarPlus}
          title={dict.workout.noProgram}
          description={dict.workout.noProgramBody}
          action={<GenerateProgramButton />}
        />
      </>
    );
  }

  if (!today) {
    return (
      <>
        <PageHeader title={dict.workout.title} description={program.title} />
        <EmptyState
          icon={Clock}
          title={dict.workout.restDay}
          description={dict.workout.restDayBody}
        />
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {program.days.map((day) => (
            <WorkoutCard
              key={day.id}
              day={day}
              action={
                <StartWorkoutButton
                  programDayId={day.id}
                  label={`${dict.workout.start} · ${dict.weekdays[day.weekday].full}`}
                />
              }
            />
          ))}
        </div>
      </>
    );
  }

  const totalSets = today.exercises.reduce((sum, e) => sum + e.sets, 0);

  return (
    <>
      <PageHeader
        title={today.name}
        description={`${dict.weekdays[today.weekday].full} · ${fmt(dict.history.summary, { exercises: today.exercises.length, sets: totalSets })}${
          today.estimatedMinutes
            ? ` · ~${today.estimatedMinutes} ${dict.common.min}`
            : ""
        }`}
      />

      <ol className="flex flex-col gap-3">
        {today.exercises.map((item, index) => {
          const gif = gifUrlFor(item.exerciseId);
          return (
            <li
              key={item.id}
              className="flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {gif ? (
                  <Image
                    src={gif}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-contain"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Dumbbell
                      className="size-5 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <h2 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {item.exercise?.name ?? item.exerciseId}
                  </h2>
                </div>

                <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                  {item.sets} × {item.repMin}–{item.repMax}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    {item.restSeconds}s
                  </span>
                </p>

                {item.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.exercise ? (
                    <Badge variant="outline" className="capitalize">
                      {item.exercise.equipment}
                    </Badge>
                  ) : null}
                  <Button asChild variant="ghost" size="xs">
                    <Link href={`/exercises/${item.exerciseId}`}>
                      {dict.workout.howTo}
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-20 z-20 mt-6 lg:bottom-4">
        <StartWorkoutButton programDayId={today.id} />
      </div>
    </>
  );
}
