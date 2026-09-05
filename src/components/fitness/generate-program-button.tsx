"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateProgramAction } from "@/lib/programs/actions";
import { useI18n } from "@/lib/i18n/client";

export function GenerateProgramButton({
  label,
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateProgramAction();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Repairs are real changes to what the coach proposed — say so rather
      // than pretending the output was perfect.
      if (result.repairs.length > 0) {
        toast.success(dict.dashboard.programReady, {
          description: result.repairs.slice(0, 2).join(" "),
        });
      } else {
        toast.success(dict.dashboard.programReady);
      }
      router.refresh();
    });
  }

  return (
    <Button size="xl" variant={variant} onClick={generate} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {dict.dashboard.generating}
        </>
      ) : (
        <>
          <Sparkles className="size-4" aria-hidden="true" />
          {label ?? dict.dashboard.generate}
        </>
      )}
    </Button>
  );
}
