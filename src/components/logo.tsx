import { cn } from "@/lib/utils";

/** The dumbbell mark, lime on transparent — pairs with any surface. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 40"
      aria-hidden="true"
      className={cn("fill-primary", className)}
    >
      <rect x="6" y="18" width="52" height="4" rx="2" />
      <rect x="10" y="5" width="7" height="30" rx="3.5" />
      <rect x="19" y="10" width="5" height="20" rx="2.5" />
      <rect x="47" y="5" width="7" height="30" rx="3.5" />
      <rect x="40" y="10" width="5" height="20" rx="2.5" />
    </svg>
  );
}

/** Mark + wordmark. The name stays "COACH" in every locale — it's a brand. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="h-4 w-auto" />
      <span className="text-sm font-semibold tracking-[0.14em] text-foreground uppercase">
        Coach
      </span>
    </span>
  );
}
