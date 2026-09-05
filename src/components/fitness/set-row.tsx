import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Presentational row for one set of an exercise: index, weight × reps, and
 * completion state. Interactivity (logging, editing) arrives with live
 * workout mode in Phase 5 — this fixes the visual contract early.
 * Row height ≥48px keeps it comfortably tappable with one hand.
 */
export function SetRow({
  index,
  weight,
  reps,
  isWarmup = false,
  completed = false,
  previous,
  className,
}: {
  index: number;
  weight: string | number | null;
  reps: string | number | null;
  isWarmup?: boolean;
  completed?: boolean;
  previous?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid h-12 grid-cols-[2rem_1fr_auto_2.5rem] items-center gap-3 border-b border-border/60 px-1 last:border-b-0",
        className,
      )}
    >
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          isWarmup ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {isWarmup ? "W" : index}
      </span>

      <span className="text-lg font-semibold text-foreground tabular-nums">
        {weight ?? "—"}
        <span className="mx-1 text-sm font-normal text-muted-foreground">
          kg ×
        </span>
        {reps ?? "—"}
      </span>

      {previous ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          prev {previous}
        </span>
      ) : (
        <span />
      )}

      <span
        aria-label={completed ? "Set completed" : "Set not completed"}
        className={cn(
          "flex size-7 items-center justify-center justify-self-end rounded-full border",
          completed
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border text-transparent",
        )}
      >
        <Check className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}
