"use client";

import Image from "next/image";
import { Dumbbell } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * Demo animation for the exercise detail page.
 *
 * `unoptimized` is required: Next's image optimizer would flatten the GIF to
 * a single frame, and the animation is the whole point.
 */
export function ExerciseVideo({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const { dict } = useI18n();

  if (!src) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted px-6 text-center">
        <Dumbbell
          className="size-6 text-muted-foreground/50"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">{dict.exercises.noDemo}</p>
        <p className="text-xs text-muted-foreground/70">
          {dict.exercises.noDemoBody}
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
      <Image
        src={src}
        alt={`${title} demonstration`}
        fill
        unoptimized
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-contain"
      />
    </div>
  );
}
