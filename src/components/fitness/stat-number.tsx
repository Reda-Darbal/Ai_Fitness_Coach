import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "text-2xl",
  md: "text-display-sm",
  lg: "text-display",
  xl: "text-display-lg",
} as const;

/**
 * The signature data primitive: a large tabular-nums numeral with an optional
 * unit and label. Sized to be readable from arm's length mid-set.
 * Pass "—" as the value when no data exists yet — never invent numbers.
 */
export function StatNumber({
  value,
  unit,
  label,
  size = "md",
  className,
}: {
  value: string | number;
  unit?: string;
  label?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-semibold text-foreground tabular-nums",
            sizeClasses[size],
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {label ? (
        <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
    </div>
  );
}
