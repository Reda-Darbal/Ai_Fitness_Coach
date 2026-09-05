"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function RootError({
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        {dict.errors.somethingWrong}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {dict.errors.somethingWrongBody}
      </p>
      <Button size="xl" onClick={() => reset()}>
        {dict.common.tryAgain}
      </Button>
    </div>
  );
}
