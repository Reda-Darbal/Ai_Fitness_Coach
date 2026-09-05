"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChipToggle } from "@/components/fitness/chip-toggle";
import { OptionCard } from "@/components/fitness/option-card";
import { completeOnboarding } from "@/lib/profile/actions";
import {
  COACH_LANGUAGES,
  COACH_LANGUAGE_LABELS,
  EXPERIENCE_LEVELS,
  GOALS,
  PREFERRED_TIMES,
  SESSION_MINUTES,
  SEXES,
  WEEKDAYS,
  type Weekday,
} from "@/lib/profile/constants";
import { equipmentLabelFrom, fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import {
  formStateToPayload,
  humanizeIssue,
  stepSchemas,
  type OnboardingFormState,
  type StepKey,
} from "@/lib/profile/schema";

const STEP_KEYS: StepKey[] = [
  "basics",
  "goal",
  "experience",
  "schedule",
  "equipment",
  "preferences",
];

const DEFAULTS: OnboardingFormState = {
  age: "",
  heightCm: "",
  currentWeightKg: "",
  targetWeightKg: "",
  trainingDays: [],
  sessionMinutes: 60,
  equipment: [],
  injuries: "",
  likedExercises: "",
  dislikedExercises: "",
  notes: "",
  coachLanguage: "en",
  conciseReplies: true,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-destructive">
      {message}
    </p>
  );
}

export function OnboardingFlow({
  equipmentOptions,
  databaseReady,
  initialState,
}: {
  equipmentOptions: string[];
  databaseReady: boolean;
  initialState?: Partial<OnboardingFormState>;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<OnboardingFormState>({
    ...DEFAULTS,
    ...initialState,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const stepKey = STEP_KEYS[index];
  const step = dict.onboarding.steps[stepKey];
  const isLast = index === STEP_KEYS.length - 1;

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const set = useCallback(
    <K extends keyof OnboardingFormState>(
      key: K,
      value: OnboardingFormState[K],
    ) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      clearError(key as string);
    },
    [clearError],
  );

  const toggleDay = useCallback(
    (day: Weekday, checked: boolean) => {
      setValues((prev) => ({
        ...prev,
        trainingDays: checked
          ? [...prev.trainingDays, day].sort(
              (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
            )
          : prev.trainingDays.filter((d) => d !== day),
      }));
      clearError("trainingDays");
    },
    [clearError],
  );

  const toggleEquipment = useCallback(
    (item: string, checked: boolean) => {
      setValues((prev) => ({
        ...prev,
        equipment: checked
          ? [...prev.equipment, item]
          : prev.equipment.filter((e) => e !== item),
      }));
      clearError("equipment");
    },
    [clearError],
  );

  const payload = useMemo(() => formStateToPayload(values), [values]);

  /** Zod speaks English; the two generic messages get dictionary versions. */
  function localizeIssue(message: string): string {
    if (message === "Required") return dict.onboarding.errors.required;
    if (message === "Pick one") return dict.onboarding.errors.pickOne;
    return message;
  }

  /** Validates only the current step so errors stay local to what is on screen. */
  function validateStep(): boolean {
    const result = stepSchemas[stepKey].safeParse(payload);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "form");
      next[field] ??= localizeIssue(humanizeIssue(issue.message));
    }
    setErrors(next);
    return false;
  }

  function goBack() {
    setErrors({});
    setIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  }

  function goNext() {
    if (!validateStep()) return;

    if (!isLast) {
      setIndex((i) => i + 1);
      window.scrollTo({ top: 0 });
      return;
    }

    startTransition(async () => {
      const result = await completeOnboarding(payload);

      if (result.ok) {
        toast.success(dict.onboarding.saved);
        router.push("/dashboard");
        return;
      }

      if (result.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) mapped[field] = localizeIssue(humanizeIssue(messages[0]));
        }
        setErrors(mapped);
      }
      toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {!databaseReady ? (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="text-xs text-foreground">
            {dict.onboarding.noDatabase}
          </p>
        </div>
      ) : null}

      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {fmt(dict.onboarding.stepOf, {
              current: index + 1,
              total: STEP_KEYS.length,
            })}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {Math.round(((index + 1) / STEP_KEYS.length) * 100)}%
          </p>
        </div>
        <Progress
          value={((index + 1) / STEP_KEYS.length) * 100}
          className="mt-2"
          aria-label={fmt(dict.onboarding.stepOf, {
            current: index + 1,
            total: STEP_KEYS.length,
          })}
        />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {step.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{step.subtitle}</p>
      </div>

      {stepKey === "basics" ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="age">{dict.onboarding.fields.age}</Label>
              <Input
                id="age"
                inputMode="numeric"
                autoComplete="off"
                placeholder="25"
                className="mt-1.5 h-11 text-base tabular-nums"
                value={values.age}
                onChange={(e) => set("age", e.target.value)}
                aria-invalid={Boolean(errors.age)}
              />
              <FieldError message={errors.age} />
            </div>
            <div>
              <Label htmlFor="height">{dict.onboarding.fields.height}</Label>
              <Input
                id="height"
                inputMode="decimal"
                autoComplete="off"
                placeholder="175"
                className="mt-1.5 h-11 text-base tabular-nums"
                value={values.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
                aria-invalid={Boolean(errors.heightCm)}
              />
              <FieldError message={errors.heightCm} />
            </div>
          </div>

          <div>
            <Label htmlFor="weight">{dict.onboarding.fields.weight}</Label>
            <Input
              id="weight"
              inputMode="decimal"
              autoComplete="off"
              placeholder="70"
              className="mt-1.5 h-11 text-base tabular-nums"
              value={values.currentWeightKg}
              onChange={(e) => set("currentWeightKg", e.target.value)}
              aria-invalid={Boolean(errors.currentWeightKg)}
            />
            <FieldError message={errors.currentWeightKg} />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.sex}
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              {dict.onboarding.fields.sexHint}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {SEXES.map((sex) => (
                <OptionCard
                  key={sex}
                  name="sex"
                  value={sex}
                  checked={values.sex === sex}
                  onSelect={() => set("sex", sex)}
                  title={dict.sex[sex]}
                />
              ))}
            </div>
            <FieldError message={errors.sex} />
          </fieldset>
        </div>
      ) : null}

      {stepKey === "goal" ? (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="sr-only">{dict.settings.goal}</legend>
            <div className="flex flex-col gap-2">
              {GOALS.map((goal) => (
                <OptionCard
                  key={goal}
                  name="goal"
                  value={goal}
                  checked={values.goal === goal}
                  onSelect={() => set("goal", goal)}
                  title={dict.goals[goal].title}
                  description={dict.goals[goal].description}
                />
              ))}
            </div>
            <FieldError message={errors.goal} />
          </fieldset>

          <div>
            <Label htmlFor="target">{dict.onboarding.fields.targetWeight}</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {dict.onboarding.fields.targetWeightHint}
            </p>
            <Input
              id="target"
              inputMode="decimal"
              autoComplete="off"
              placeholder="75"
              className="mt-1.5 h-11 text-base tabular-nums"
              value={values.targetWeightKg}
              onChange={(e) => set("targetWeightKg", e.target.value)}
              aria-invalid={Boolean(errors.targetWeightKg)}
            />
            <FieldError message={errors.targetWeightKg} />
          </div>
        </div>
      ) : null}

      {stepKey === "experience" ? (
        <fieldset>
          <legend className="sr-only">
            {dict.onboarding.steps.experience.title}
          </legend>
          <div className="flex flex-col gap-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <OptionCard
                key={level}
                name="experienceLevel"
                value={level}
                checked={values.experienceLevel === level}
                onSelect={() => set("experienceLevel", level)}
                title={dict.experience[level].title}
                description={dict.experience[level].description}
              />
            ))}
          </div>
          <FieldError message={errors.experienceLevel} />
        </fieldset>
      ) : null}

      {stepKey === "schedule" ? (
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.trainingDays}
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              {values.trainingDays.length === 0
                ? dict.onboarding.fields.trainingDaysHint
                : values.trainingDays.length === 1
                  ? dict.onboarding.fields.dayPerWeek
                  : fmt(dict.onboarding.fields.daysPerWeek, {
                      n: values.trainingDays.length,
                    })}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {WEEKDAYS.map((day) => (
                <ChipToggle
                  key={day}
                  checked={values.trainingDays.includes(day)}
                  onToggle={(checked) => toggleDay(day, checked)}
                  label={dict.weekdays[day].short}
                />
              ))}
            </div>
            <FieldError message={errors.trainingDays} />
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.preferredTime}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PREFERRED_TIMES.map((time) => (
                <ChipToggle
                  key={time}
                  checked={values.preferredTime === time}
                  onToggle={() => set("preferredTime", time)}
                  label={dict.times[time]}
                />
              ))}
            </div>
            <FieldError message={errors.preferredTime} />
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.sessionLength}
            </legend>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {SESSION_MINUTES.map((minutes) => (
                <ChipToggle
                  key={minutes}
                  checked={values.sessionMinutes === minutes}
                  onToggle={() => set("sessionMinutes", minutes)}
                  label={`${minutes}m`}
                />
              ))}
            </div>
            <FieldError message={errors.sessionMinutes} />
          </fieldset>
        </div>
      ) : null}

      {stepKey === "equipment" ? (
        <fieldset>
          <legend className="sr-only">{dict.settings.equipment}</legend>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {fmt(dict.onboarding.fields.selected, {
                n: values.equipment.length,
              })}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("equipment", [...equipmentOptions])}
              >
                {dict.onboarding.fields.selectAll}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("equipment", [])}
              >
                {dict.onboarding.fields.clear}
              </Button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {equipmentOptions.map((item) => {
              const label = equipmentLabelFrom(dict, item);
              return (
                <ChipToggle
                  key={item}
                  checked={values.equipment.includes(item)}
                  onToggle={(checked) => toggleEquipment(item, checked)}
                  label={label.title}
                  hint={label.hint}
                />
              );
            })}
          </div>
          <FieldError message={errors.equipment} />
        </fieldset>
      ) : null}

      {stepKey === "preferences" ? (
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="injuries">{dict.onboarding.fields.injuries}</Label>
            <Textarea
              id="injuries"
              placeholder={dict.onboarding.fields.injuriesPlaceholder}
              className="mt-1.5"
              value={values.injuries}
              onChange={(e) => set("injuries", e.target.value)}
            />
            <FieldError message={errors.injuries} />
          </div>

          <div>
            <Label htmlFor="disliked">{dict.onboarding.fields.disliked}</Label>
            <Textarea
              id="disliked"
              placeholder={dict.onboarding.fields.dislikedPlaceholder}
              className="mt-1.5"
              value={values.dislikedExercises}
              onChange={(e) => set("dislikedExercises", e.target.value)}
            />
            <FieldError message={errors.dislikedExercises} />
          </div>

          <div>
            <Label htmlFor="liked">{dict.onboarding.fields.liked}</Label>
            <Textarea
              id="liked"
              placeholder={dict.onboarding.fields.likedPlaceholder}
              className="mt-1.5"
              value={values.likedExercises}
              onChange={(e) => set("likedExercises", e.target.value)}
            />
            <FieldError message={errors.likedExercises} />
          </div>

          <div>
            <Label htmlFor="notes">{dict.onboarding.fields.notes}</Label>
            <Textarea
              id="notes"
              placeholder={dict.onboarding.fields.notesPlaceholder}
              className="mt-1.5"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <FieldError message={errors.notes} />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.language}
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {COACH_LANGUAGES.map((lang) => (
                <ChipToggle
                  key={lang}
                  checked={values.coachLanguage === lang}
                  onToggle={() => set("coachLanguage", lang)}
                  label={COACH_LANGUAGE_LABELS[lang]}
                />
              ))}
            </div>
            <FieldError message={errors.coachLanguage} />
          </fieldset>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
            <Label htmlFor="concise" className="flex flex-col items-start gap-1">
              <span className="text-sm font-medium text-foreground">
                {dict.onboarding.fields.concise}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {dict.onboarding.fields.conciseHint}
              </span>
            </Label>
            <Switch
              id="concise"
              checked={values.conciseReplies}
              onCheckedChange={(checked) => set("conciseReplies", checked)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        {index > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="icon-xl"
            onClick={goBack}
            disabled={pending}
            aria-label={dict.common.back}
          >
            <ArrowLeft className="rtl:-scale-x-100 size-5" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="xl"
          className="flex-1"
          onClick={goNext}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.common.saving}
            </>
          ) : isLast ? (
            dict.onboarding.finish
          ) : (
            dict.common.continue
          )}
        </Button>
      </div>
    </div>
  );
}
