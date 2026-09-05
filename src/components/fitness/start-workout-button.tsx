"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startWorkout } from "@/lib/workouts/actions";
import { useI18n } from "@/lib/i18n/client";

export function StartWorkoutButton({
  programDayId,
  label,
}: {
  programDayId: string;
  label?: string;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="xl"
      className="h-14 w-full text-base"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startWorkout(programDayId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push(`/workout/${result.data.sessionId}`);
        })
      }
    >
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <Play className="size-5" aria-hidden="true" />
      )}
      {label ?? dict.workout.start}
    </Button>
  );
}
