"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

function format(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Counts down between sets. Sits above the fold with the biggest numerals in
 * the app so it reads across a gym at arm's length.
 *
 * Timing is derived from a wall-clock deadline rather than by decrementing a
 * counter, because phone browsers throttle timers in background tabs — a
 * counter would drift or stall while the screen is off.
 */
export function RestTimer({
  seconds,
  onDone,
  onDismiss,
}: {
  seconds: number;
  onDone?: () => void;
  onDismiss: () => void;
}) {
  const { dict } = useI18n();
  const [deadline, setDeadline] = useState(() => Date.now() + seconds * 1000);
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onDone?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, onDone]);

  const done = remaining <= 0;

  return (
    <div
      role="timer"
      aria-live="off"
      className="sticky top-14 z-20 mb-3 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 lg:top-0"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {done ? dict.workout.restOver : dict.workout.resting}
        </p>
        <p
          className={`text-display-sm font-semibold tabular-nums ${
            done ? "text-primary" : "text-foreground"
          }`}
        >
          {format(remaining)}
        </p>
        <span className="sr-only">
          {done ? dict.workout.restOver : dict.workout.resting}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon-xl"
          aria-label={dict.workout.addTime}
          onClick={() => {
            firedRef.current = false;
            setDeadline((d) => Math.max(d, Date.now()) + 30_000);
          }}
        >
          <Plus className="size-5" />
        </Button>
        <Button
          variant={done ? "default" : "secondary"}
          size="xl"
          onClick={onDismiss}
        >
          {done ? dict.workout.nextSet : dict.workout.skipRest}
          {done ? null : <X className="size-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
