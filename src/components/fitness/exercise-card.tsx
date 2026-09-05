import Image from "next/image";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { gifUrlFor } from "@/lib/exercises/media";
import type { Exercise } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";

const difficultyStyles: Record<string, string> = {
  beginner: "bg-success/15 text-success",
  intermediate: "bg-warning/15 text-warning",
  advanced: "bg-destructive/15 text-destructive",
};

export function ExerciseCard({
  exercise,
  priority = false,
}: {
  exercise: Exercise;
  priority?: boolean;
}) {
  const gif = gifUrlFor(exercise.id);

  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {gif ? (
          <Image
            src={gif}
            alt=""
            fill
            unoptimized
            loading={priority ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Dumbbell
              className="size-7 text-muted-foreground/40"
              aria-hidden="true"
            />
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 start-2 rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium capitalize",
            difficultyStyles[exercise.difficulty] ?? "bg-muted text-foreground",
          )}
        >
          {exercise.difficulty}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground">
          {exercise.name}
        </h3>
        <p className="text-xs text-muted-foreground capitalize">
          {exercise.target}
        </p>
        <Badge variant="outline" className="mt-auto w-fit capitalize">
          {exercise.equipment}
        </Badge>
      </div>
    </Link>
  );
}
