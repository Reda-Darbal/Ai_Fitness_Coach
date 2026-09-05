"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, UtensilsCrossed } from "lucide-react";
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
import { analyzeMeal, createMealUpload, type MealEstimate } from "@/lib/nutrition/analyze";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

export function MealAnalyzer() {
  const { dict } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);

  async function analyze(file: File) {
    setBusy(true);
    setEstimate(null);
    try {
      const created = await createMealUpload({ contentType: file.type });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      const put = await fetch(created.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) {
        toast.error(`Upload failed (${put.status}).`);
        return;
      }
      const result = await analyzeMeal({ key: created.key, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEstimate(result.estimate);
      setNote("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const confidenceLabel = (c: MealEstimate["confidence"]) =>
    c === "low"
      ? dict.nutrition.confLow
      : c === "medium"
        ? dict.nutrition.confMedium
        : dict.nutrition.confHigh;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="size-4 text-primary" aria-hidden="true" />
          {dict.nutrition.analyzeTitle}
        </CardTitle>
        <CardDescription>{dict.nutrition.analyzeHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {estimate ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-display-sm font-semibold text-foreground tabular-nums">
                {fmt(dict.nutrition.kcalRange, {
                  min: Math.round(estimate.caloriesKcal.min),
                  max: Math.round(estimate.caloriesKcal.max),
                })}
              </span>
              <span className="text-base font-medium text-foreground tabular-nums">
                {fmt(dict.nutrition.proteinRange, {
                  min: Math.round(estimate.proteinG.min),
                  max: Math.round(estimate.proteinG.max),
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {confidenceLabel(estimate.confidence)}
              </span>
            </div>

            {estimate.items.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {dict.nutrition.items}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {estimate.items.map((item, i) => (
                    <li
                      key={i}
                      className="rounded-md bg-muted px-2 py-1 text-xs text-foreground"
                    >
                      {item.name}
                      <span className="text-muted-foreground"> · {item.portion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-sm text-foreground">{estimate.verdict}</p>
          </div>
        ) : null}

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={dict.nutrition.notePlaceholder}
          aria-label={dict.nutrition.notePlaceholder}
          className="h-11"
          disabled={busy}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void analyze(file);
          }}
        />
        <Button
          size="xl"
          className="w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.nutrition.analyzing}
            </>
          ) : (
            <>
              <Camera className="size-4" aria-hidden="true" />
              {estimate ? dict.nutrition.again : dict.nutrition.addMeal}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
