import { cn } from "@/lib/utils";

/**
 * Multi-select chip on a native checkbox. Used for training days and
 * equipment, where several answers are valid at once.
 */
export function ChipToggle({
  checked,
  onToggle,
  label,
  hint,
  className,
}: {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center transition-colors",
        checked
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
