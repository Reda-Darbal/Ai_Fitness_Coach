"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Big +/- stepper for logging weight and reps mid-set.
 *
 * Steppers rather than a keyboard: one thumb, no keyboard covering the screen,
 * and no way to fat-finger 250 instead of 25. The field stays typeable for
 * odd values. Buttons are 44px and the value is tabular so it does not jitter.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  id,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  id: string;
}) {
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Math.round(n * 100) / 100));

  return (
    <div className="min-w-0 flex-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-xl"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
        >
          <Minus className="size-5" />
        </Button>

        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            inputMode="decimal"
            value={String(value)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
            className="h-11 text-center text-lg font-semibold tabular-nums"
            aria-label={unit ? `${label} in ${unit}` : label}
          />
          {unit ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-xs text-muted-foreground"
            >
              {unit}
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-xl"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
