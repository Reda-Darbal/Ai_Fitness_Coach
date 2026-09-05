import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Single-select card built on a native radio input, so arrow-key navigation,
 * grouping and screen-reader semantics come for free. The input is visually
 * hidden but stays inside the label, which keeps focus from scroll-jumping.
 * Minimum height clears the 44px touch target.
 */
export function OptionCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:border-input hover:bg-accent/50",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-input text-transparent",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
