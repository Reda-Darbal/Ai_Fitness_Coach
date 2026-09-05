import { MoveDownRight, MoveRight, MoveUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatNumber } from "./stat-number";

const trendConfig = {
  up: { icon: MoveUpRight, className: "text-success" },
  down: { icon: MoveDownRight, className: "text-destructive" },
  flat: { icon: MoveRight, className: "text-muted-foreground" },
} as const;

/**
 * A StatNumber in a Card with an optional trend delta. Whether "up" is good
 * depends on the metric — callers choose the direction semantics.
 */
export function MetricCard({
  value,
  unit,
  label,
  trend,
  className,
}: {
  value: string | number;
  unit?: string;
  label: string;
  trend?: { value: string; direction: keyof typeof trendConfig };
  className?: string;
}) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;

  return (
    <Card className={className}>
      <CardContent className="flex items-end justify-between gap-2">
        <StatNumber value={value} unit={unit} label={label} size="md" />
        {trend && TrendIcon ? (
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-medium tabular-nums",
              trendConfig[trend.direction].className,
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {trend.value}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
