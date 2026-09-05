"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChipToggle } from "@/components/fitness/chip-toggle";
import { OptionCard } from "@/components/fitness/option-card";
import { updateProfile } from "@/lib/profile/actions";
import {
  COACH_LANGUAGES,
  COACH_LANGUAGE_LABELS,
  GOALS,
  PREFERRED_TIMES,
  SESSION_MINUTES,
  WEEKDAYS,
  type Weekday,
} from "@/lib/profile/constants";
import { equipmentLabelFrom } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import {
  formStateToPayload,
  humanizeIssue,
  type OnboardingFormState,
} from "@/lib/profile/schema";
import type { Profile } from "@/lib/profile/queries";

function toFormState(profile: Profile): OnboardingFormState {
  return {
    age: profile.age?.toString() ?? "",
    sex: profile.sex ?? undefined,
    heightCm: profile.heightCm?.toString() ?? "",
    currentWeightKg: profile.currentWeightKg?.toString() ?? "",
    targetWeightKg: profile.targetWeightKg?.toString() ?? "",
    goal: profile.goal,
    experienceLevel: profile.experienceLevel,
    trainingDays: profile.trainingDays,
    preferredTime: profile.preferredTime ?? undefined,
    sessionMinutes:
      (SESSION_MINUTES.find((m) => m === profile.sessionMinutes) ??
        60) as OnboardingFormState["sessionMinutes"],
    equipment: profile.equipment,
    injuries: profile.injuries ?? "",
    likedExercises: profile.likedExercises ?? "",
    dislikedExercises: profile.dislikedExercises ?? "",
    notes: profile.notes ?? "",
    coachLanguage: profile.coachLanguage,
    conciseReplies: profile.conciseReplies,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-destructive">
      {message}
    </p>
  );
}

export function SettingsForm({
  profile,
  equipmentOptions,
}: {
  profile: Profile;
  equipmentOptions: string[];
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState<OnboardingFormState>(
    toFormState(profile),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof OnboardingFormState>(
    key: K,
    value: OnboardingFormState[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function toggleDay(day: Weekday, checked: boolean) {
    set(
      "trainingDays",
      checked
        ? [...values.trainingDays, day].sort(
            (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
          )
        : values.trainingDays.filter((d) => d !== day),
    );
  }

  function toggleEquipment(item: string, checked: boolean) {
    set(
      "equipment",
      checked
        ? [...values.equipment, item]
        : values.equipment.filter((e) => e !== item),
    );
  }

  function save() {
    startTransition(async () => {
      const result = await updateProfile(formStateToPayload(values));

      if (result.ok) {
        setErrors({});
        setDirty(false);
        toast.success(dict.settings.settingsSaved);
        router.refresh();
        return;
      }

      if (result.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) mapped[field] = humanizeIssue(messages[0]);
        }
        setErrors(mapped);
      }
      toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.appLanguage}</CardTitle>
          <CardDescription>
            {dict.settings.appLanguageHint} {dict.settings.coachHint}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset>
            <legend className="sr-only">{dict.settings.appLanguage}</legend>
            <div className="grid grid-cols-3 gap-2">
              {COACH_LANGUAGES.map((lang) => (
                <ChipToggle
                  key={lang}
                  checked={values.coachLanguage === lang}
                  onToggle={() => set("coachLanguage", lang)}
                  label={COACH_LANGUAGE_LABELS[lang]}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="concise-setting"
              className="flex flex-col items-start gap-1"
            >
              <span className="text-sm font-medium text-foreground">
                {dict.onboarding.fields.concise}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {dict.onboarding.fields.conciseHint}
              </span>
            </Label>
            <Switch
              id="concise-setting"
              checked={values.conciseReplies}
              onCheckedChange={(checked) => set("conciseReplies", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.goal}</CardTitle>
          <CardDescription>{dict.settings.goalHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset>
            <legend className="sr-only">{dict.settings.goal}</legend>
            <div className="flex flex-col gap-2">
              {GOALS.map((goal) => (
                <OptionCard
                  key={goal}
                  name="settings-goal"
                  value={goal}
                  checked={values.goal === goal}
                  onSelect={() => set("goal", goal)}
                  title={dict.goals[goal].title}
                  description={dict.goals[goal].description}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="setting-weight">{dict.onboarding.fields.weight}</Label>
              <Input
                id="setting-weight"
                inputMode="decimal"
                className="mt-1.5 h-11 text-base tabular-nums"
                value={values.currentWeightKg}
                onChange={(e) => set("currentWeightKg", e.target.value)}
                aria-invalid={Boolean(errors.currentWeightKg)}
              />
              <FieldError message={errors.currentWeightKg} />
            </div>
            <div>
              <Label htmlFor="setting-target">
                {dict.onboarding.fields.targetWeight}
              </Label>
              <Input
                id="setting-target"
                inputMode="decimal"
                placeholder={dict.common.optional}
                className="mt-1.5 h-11 text-base tabular-nums"
                value={values.targetWeightKg}
                onChange={(e) => set("targetWeightKg", e.target.value)}
                aria-invalid={Boolean(errors.targetWeightKg)}
              />
              <FieldError message={errors.targetWeightKg} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.schedule}</CardTitle>
          <CardDescription>{dict.settings.scheduleHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              {dict.onboarding.fields.trainingDays}
            </legend>
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
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PREFERRED_TIMES.map((time) => (
                <ChipToggle
                  key={time}
                  checked={values.preferredTime === time}
                  onToggle={() => set("preferredTime", time)}
                  label={dict.times[time]}
                />
              ))}
            </div>
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
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.equipment}</CardTitle>
          <CardDescription>{dict.settings.equipmentHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">{dict.settings.equipment}</legend>
            <div className="grid grid-cols-2 gap-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.settings.preferences}</CardTitle>
          <CardDescription>{dict.settings.preferencesHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="setting-injuries">
              {dict.onboarding.fields.injuries}
            </Label>
            <Textarea
              id="setting-injuries"
              className="mt-1.5"
              value={values.injuries}
              onChange={(e) => set("injuries", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="setting-disliked">
              {dict.onboarding.fields.disliked}
            </Label>
            <Textarea
              id="setting-disliked"
              className="mt-1.5"
              value={values.dislikedExercises}
              onChange={(e) => set("dislikedExercises", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="setting-liked">{dict.onboarding.fields.liked}</Label>
            <Textarea
              id="setting-liked"
              className="mt-1.5"
              value={values.likedExercises}
              onChange={(e) => set("likedExercises", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="setting-notes">{dict.onboarding.fields.notes}</Label>
            <Textarea
              id="setting-notes"
              className="mt-1.5"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <Button
          size="xl"
          className="w-full"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.common.saving}
            </>
          ) : dirty ? (
            dict.common.save
          ) : (
            dict.common.saved
          )}
        </Button>
      </div>
    </div>
  );
}
