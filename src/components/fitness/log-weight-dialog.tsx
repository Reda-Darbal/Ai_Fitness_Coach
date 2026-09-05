"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NumberStepper } from "@/components/fitness/number-stepper";
import { logBodyWeight } from "@/lib/weight/actions";
import { useI18n } from "@/lib/i18n/client";

/**
 * Quick weigh-in: open, adjust with 0.1kg steps from your last value, save.
 * Same-day entries overwrite, so correcting a typo is just logging again.
 */
export function LogWeightDialog({
  initialWeightKg,
}: {
  initialWeightKg: number | null;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(initialWeightKg ?? 70);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await logBodyWeight({ weightKg: weight });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(dict.progress.weightLogged);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xl">
          <Scale className="size-4" aria-hidden="true" />
          {dict.progress.logWeight}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dict.progress.logWeightTitle}</DialogTitle>
          <DialogDescription>{dict.progress.logWeightHint}</DialogDescription>
        </DialogHeader>

        <NumberStepper
          id="weigh-in"
          label={dict.dashboard.bodyWeight}
          unit={dict.common.kg}
          value={weight}
          onChange={setWeight}
          step={0.1}
          min={20}
          max={400}
        />

        <Button size="xl" className="w-full" onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.common.saving}
            </>
          ) : (
            dict.common.save
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
