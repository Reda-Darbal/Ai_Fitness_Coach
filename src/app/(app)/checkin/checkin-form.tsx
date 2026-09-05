"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipToggle } from "@/components/fitness/chip-toggle";
import { NumberStepper } from "@/components/fitness/number-stepper";
import { submitCheckin } from "@/lib/checkins/actions";
import type { Checkin } from "@/lib/checkins/queries";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

function ChoiceRow<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <ChipToggle
            key={option.value}
            checked={value === option.value}
            onToggle={() => onChange(option.value)}
            label={option.label}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function CheckinForm({
  workoutsDone,
  currentWeightKg,
  existing,
}: {
  workoutsDone: number;
  currentWeightKg: number | null;
  existing: Checkin | null;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [weight, setWeight] = useState(
    existing?.weightKg ?? currentWeightKg ?? 70,
  );
  const [energy, setEnergy] = useState<"low" | "ok" | "high">(
    existing?.energy ?? "ok",
  );
  const [sleep, setSleep] = useState<"poor" | "ok" | "good">(
    existing?.sleep ?? "ok",
  );
  const [soreness, setSoreness] = useState<"none" | "some" | "high">(
    existing?.soreness ?? "some",
  );
  const [difficulty, setDifficulty] = useState<"too_easy" | "right" | "too_hard">(
    existing?.difficulty ?? "right",
  );
  const [liked, setLiked] = useState(existing?.liked ?? "");
  const [disliked, setDisliked] = useState(existing?.disliked ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function submit() {
    startTransition(async () => {
      const result = await submitCheckin({
        weightKg: weight,
        energy,
        sleep,
        soreness,
        difficulty,
        liked,
        disliked,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(existing ? dict.checkin.updated : dict.checkin.submitted);
      router.push("/dashboard");
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground tabular-nums">
        {fmt(dict.checkin.workoutsAuto, { n: workoutsDone })}
      </p>

      <NumberStepper
        id="checkin-weight"
        label={dict.dashboard.bodyWeight}
        unit={dict.common.kg}
        value={weight}
        onChange={setWeight}
        step={0.1}
        min={20}
        max={400}
      />

      <ChoiceRow
        legend={dict.checkin.energy}
        value={energy}
        onChange={setEnergy}
        options={[
          { value: "low", label: dict.checkin.energyLow },
          { value: "ok", label: dict.checkin.energyOk },
          { value: "high", label: dict.checkin.energyHigh },
        ]}
      />

      <ChoiceRow
        legend={dict.checkin.sleep}
        value={sleep}
        onChange={setSleep}
        options={[
          { value: "poor", label: dict.checkin.sleepPoor },
          { value: "ok", label: dict.checkin.sleepOk },
          { value: "good", label: dict.checkin.sleepGood },
        ]}
      />

      <ChoiceRow
        legend={dict.checkin.soreness}
        value={soreness}
        onChange={setSoreness}
        options={[
          { value: "none", label: dict.checkin.sorenessNone },
          { value: "some", label: dict.checkin.sorenessSome },
          { value: "high", label: dict.checkin.sorenessHigh },
        ]}
      />

      <ChoiceRow
        legend={dict.checkin.difficulty}
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: "too_easy", label: dict.checkin.diffEasy },
          { value: "right", label: dict.checkin.diffRight },
          { value: "too_hard", label: dict.checkin.diffHard },
        ]}
      />

      <div>
        <Label htmlFor="checkin-liked">{dict.checkin.likedLabel}</Label>
        <Textarea
          id="checkin-liked"
          className="mt-1.5"
          rows={2}
          value={liked}
          onChange={(e) => setLiked(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="checkin-disliked">{dict.checkin.dislikedLabel}</Label>
        <Textarea
          id="checkin-disliked"
          className="mt-1.5"
          rows={2}
          value={disliked}
          onChange={(e) => setDisliked(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="checkin-notes">{dict.onboarding.fields.notes}</Label>
        <Textarea
          id="checkin-notes"
          className="mt-1.5"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button size="xl" className="w-full" onClick={submit} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="rtl:-scale-x-100 size-4" aria-hidden="true" />
        )}
        {dict.checkin.submit}
      </Button>
    </div>
  );
}
