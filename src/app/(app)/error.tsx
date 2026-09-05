"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dict } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        {dict.errors.screenProblem}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {dict.errors.screenProblemBody}
      </p>
      <Button size="xl" onClick={() => reset()}>
        {dict.common.tryAgain}
      </Button>
    </div>
  );
}
