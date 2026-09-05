import Link from "next/link";
import { Flame, Beef } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatNumber } from "@/components/fitness/stat-number";
import { optionalUserId } from "@/lib/db/session";
import { getProfile } from "@/lib/profile/queries";
import { getWeightStats } from "@/lib/weight/queries";
import { calculateTargets } from "@/lib/nutrition/targets";
import { getI18n } from "@/lib/i18n/server";
import { MealAnalyzer } from "./meal-analyzer";

export const metadata = { title: "Nutrition" };

export default async function NutritionPage() {
  const { dict } = await getI18n();
  const userId = await optionalUserId();

  const [{ profile }, weightStats] = await Promise.all([
    getProfile(),
    getWeightStats(userId),
  ]);

  const targets = profile
    ? calculateTargets({
        weightKg: weightStats.currentKg ?? profile.currentWeightKg,
        heightCm: profile.heightCm,
        age: profile.age,
        sex: profile.sex,
        trainingDaysPerWeek: profile.trainingDays.length,
        goal: profile.goal,
      })
    : null;

  return (
    <>
      <PageHeader
        title={dict.nutrition.title}
        description={dict.nutrition.subtitle}
      />

      <div className="flex max-w-2xl flex-col gap-4">
        {targets ? (
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-8">
                <div className="flex items-center gap-3">
                  <Flame className="size-5 text-primary" aria-hidden="true" />
                  <StatNumber
                    value={targets.calories}
                    unit="kcal"
                    label={`${dict.nutrition.calories} · ${dict.nutrition.perDay}`}
                    size="md"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Beef className="size-5 text-chart-2" aria-hidden="true" />
                  <StatNumber
                    value={targets.proteinG}
                    unit="g"
                    label={`${dict.nutrition.protein} · ${dict.nutrition.perDay}`}
                    size="md"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {dict.nutrition.method}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {dict.nutrition.disclaimer}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                {dict.nutrition.missingProfile}
              </p>
              <Button asChild size="xl" variant="outline">
                <Link href="/settings">{dict.nav.settings}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <MealAnalyzer />
      </div>
    </>
  );
}
