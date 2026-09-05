"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flag,
  Loader2,
  SkipForward,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NumberStepper } from "@/components/fitness/number-stepper";
import { RestTimer } from "@/components/fitness/rest-timer";
import { gifUrlFor } from "@/lib/exercises/media";
import {
  finishWorkout,
  logSet,
  setExerciseFeedback,
  skipExercise,
  undoLastSet,
} from "@/lib/workouts/actions";
import type {
  LoggedSet,
  SessionExercise,
  WorkoutSession,
} from "@/lib/workouts/queries";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/**
 * Opening weight for the stepper: what you already logged today, else the
 * deterministic recommendation, else last session's weight, else a learnable
 * default.
 */
function suggestWeight(exercise: SessionExercise): number {
  const lastLogged = exercise.sets.at(-1)?.weightKg;
  if (lastLogged != null) return lastLogged;
  const recommended = exercise.recommendation.suggestedWeightKg;
  if (recommended != null) return recommended;
  const lastTime = exercise.previous.find((s) => s.weightKg != null)?.weightKg;
  return lastTime ?? 20;
}

function summarisePrevious(previous: LoggedSet[], kg: string): string | null {
  const working = previous.filter((s) => !s.isWarmup);
  if (working.length === 0) return null;
  return working
    .map((s) => `${s.weightKg ?? "—"}${kg} × ${s.reps ?? "—"}`)
    .join("  ·  ");
}

export function LiveWorkout({ session }: { session: WorkoutSession }) {
  const { dict } = useI18n();
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    // Resume where the user left off rather than at the top.
    const firstUnfinished = session.exercises.findIndex(
      (e) => !e.skipped && e.sets.length < e.targetSets,
    );
    return firstUnfinished === -1 ? 0 : firstUnfinished;
  });
  const [resting, setResting] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = session.exercises[index];
  const [weight, setWeight] = useState(() => suggestWeight(current));
  const [reps, setReps] = useState(current.targetRepMin);

  const totalSets = useMemo(
    () => session.exercises.reduce((n, e) => n + e.targetSets, 0),
    [session.exercises],
  );
  const doneSets = useMemo(
    () => session.exercises.reduce((n, e) => n + e.sets.length, 0),
    [session.exercises],
  );

  const previousText = summarisePrevious(current.previous, dict.common.kg);
  const gif = gifUrlFor(current.exerciseId);
  const setsLeft = Math.max(current.targetSets - current.sets.length, 0);

  function goTo(nextIndex: number) {
    const clamped = Math.min(
      Math.max(nextIndex, 0),
      session.exercises.length - 1,
    );
    const next = session.exercises[clamped];
    setIndex(clamped);
    setResting(false);
    setWeight(suggestWeight(next));
    setReps(next.targetRepMin);
    window.scrollTo({ top: 0 });
  }

  function completeSet() {
    startTransition(async () => {
      const result = await logSet({
        workoutExerciseId: current.id,
        weightKg: weight,
        reps,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResting(true); // rest starts automatically, per the spec
      router.refresh();
    });
  }

  function undo() {
    startTransition(async () => {
      const result = await undoLastSet(current.id);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function feedback(value: "too_easy" | "too_hard" | "pain") {
    startTransition(async () => {
      const result = await setExerciseFeedback({
        workoutExerciseId: current.id,
        feedback: value,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (value === "pain") {
        toast.warning(dict.workout.painWarning, {
          description: dict.workout.painWarningBody,
          duration: 12_000,
        });
      } else {
        toast.success(
          value === "too_easy" ? dict.workout.notedEasier : dict.workout.notedHarder,
        );
      }
      router.refresh();
    });
  }

  function skip() {
    startTransition(async () => {
      const result = await skipExercise(current.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      if (index < session.exercises.length - 1) goTo(index + 1);
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await finishWorkout({
        sessionId: session.id,
        feeling: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(dict.workout.finished);
      router.push("/dashboard");
    });
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {fmt(dict.workout.exerciseOf, {
              current: index + 1,
              total: session.exercises.length,
            })}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {fmt(dict.workout.setsProgress, { done: doneSets, total: totalSets })}
          </p>
        </div>
        <Progress
          value={totalSets === 0 ? 0 : (doneSets / totalSets) * 100}
          className="mt-2"
          aria-label={fmt(dict.workout.setsProgress, { done: doneSets, total: totalSets })}
        />
      </div>

      {resting ? (
        <RestTimer
          seconds={current.restSeconds}
          onDismiss={() => setResting(false)}
        />
      ) : null}

      <div className="flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {gif ? (
            <Image
              src={gif}
              alt=""
              fill
              unoptimized
              sizes="96px"
              className="object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Dumbbell
                className="size-6 text-muted-foreground/40"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground">
            {current.exercise?.name ?? current.exerciseId}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fmt(dict.workout.targetSets, {
              sets: current.targetSets,
              min: current.targetRepMin,
              max: current.targetRepMax,
            })}
            {setsLeft > 0
              ? ` · ${fmt(dict.workout.setsLeft, { n: setsLeft })}`
              : ` · ${dict.workout.done}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {current.exercise ? (
              <Badge variant="outline" className="capitalize">
                {current.exercise.equipment}
              </Badge>
            ) : null}
            <Button asChild variant="ghost" size="xs">
              <Link href={`/exercises/${current.exerciseId}`}>
                {dict.workout.viewForm}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {previousText ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">
            {dict.workout.lastTime}
          </span>{" "}
          {previousText}
        </p>
      ) : (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {fmt(dict.workout.firstTime, { reps: current.targetRepMax + 2 })}
        </p>
      )}

      {current.sets.length === 0 && current.feedback !== "pain" ? (
        (() => {
          const rec = current.recommendation;
          const weightText =
            rec.suggestedWeightKg != null ? String(rec.suggestedWeightKg) : "";
          const line = rec.repsMode
            ? rec.action === "increase"
              ? dict.workout.progressionReps
              : null
            : rec.action === "increase"
              ? fmt(dict.workout.progressionUp, { weight: weightText })
              : rec.action === "keep"
                ? fmt(dict.workout.progressionKeep, { weight: weightText })
                : rec.action === "decrease"
                  ? fmt(dict.workout.progressionDown, { weight: weightText })
                  : null;
          if (!line) return null;
          return (
            <p
              className={`mt-2 text-xs font-medium ${
                rec.action === "increase"
                  ? "text-primary"
                  : rec.action === "decrease"
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {line}
            </p>
          );
        })()
      ) : null}

      {current.notes ? (
        <p className="mt-2 text-xs text-muted-foreground">{current.notes}</p>
      ) : null}

      {current.feedback === "pain" ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p className="text-xs text-foreground">
            {dict.workout.painFlagged}
          </p>
        </div>
      ) : null}

      {current.sets.length > 0 ? (
        <ul className="mt-4 flex flex-col rounded-xl border border-border bg-card px-3">
          {current.sets.map((set) => (
            <li
              key={set.id}
              className="flex h-12 items-center gap-3 border-b border-border/60 last:border-b-0"
            >
              <span className="w-6 text-sm text-muted-foreground tabular-nums">
                {set.setIndex + 1}
              </span>
              <span className="flex-1 text-lg font-semibold text-foreground tabular-nums">
                {set.weightKg ?? "—"}
                <span className="mx-1 text-sm font-normal text-muted-foreground">
                  {dict.common.kg} ×
                </span>
                {set.reps ?? "—"}
              </span>
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" aria-hidden="true" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex gap-3">
        <NumberStepper
          id="set-weight"
          label={dict.workout.weight}
          unit={dict.common.kg}
          value={weight}
          onChange={setWeight}
          step={2.5}
          max={1000}
        />
        <NumberStepper
          id="set-reps"
          label={dict.common.reps}
          value={reps}
          onChange={setReps}
          step={1}
          max={200}
        />
      </div>

      <Button
        size="xl"
        className="mt-3 h-14 w-full text-base"
        onClick={completeSet}
        disabled={pending || current.feedback === "pain"}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-5" aria-hidden="true" />
        )}
        {dict.workout.completeSet}
      </Button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="xl" onClick={() => feedback("too_easy")} disabled={pending}>
          {dict.workout.tooEasy}
        </Button>
        <Button variant="secondary" size="xl" onClick={() => feedback("too_hard")} disabled={pending}>
          {dict.workout.tooHard}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {current.sets.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={undo} disabled={pending}>
            <Undo2 className="size-3.5" aria-hidden="true" />
            {dict.workout.undo}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={skip} disabled={pending}>
          <SkipForward className="rtl:-scale-x-100 size-3.5" aria-hidden="true" />
          {dict.workout.skip}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => feedback("pain")}
          disabled={pending}
        >
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          {dict.workout.pain}
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="icon-xl"
          onClick={() => goTo(index - 1)}
          disabled={index === 0 || pending}
          aria-label={dict.workout.prevExercise}
        >
          <ChevronLeft className="rtl:-scale-x-100 size-5" />
        </Button>

        {index < session.exercises.length - 1 ? (
          <Button
            size="xl"
            variant="outline"
            className="flex-1"
            onClick={() => goTo(index + 1)}
            disabled={pending}
          >
            {dict.workout.nextExercise}
            <ChevronRight className="rtl:-scale-x-100 size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="xl" className="flex-1" onClick={finish} disabled={pending}>
            <Flag className="size-4" aria-hidden="true" />
            {dict.workout.finish}
          </Button>
        )}
      </div>

      {index < session.exercises.length - 1 ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-center"
          onClick={finish}
          disabled={pending}
        >
          {dict.workout.finishEarly}
        </Button>
      ) : null}
    </div>
  );
}
