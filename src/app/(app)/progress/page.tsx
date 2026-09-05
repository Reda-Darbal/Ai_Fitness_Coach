import Link from "next/link";
import { History, Images, Scale, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/fitness/metric-card";
import { EmptyState } from "@/components/fitness/empty-state";
import { LogWeightDialog } from "@/components/fitness/log-weight-dialog";
import { WeightChart } from "@/components/charts/weight-chart";
import { VolumeChart } from "@/components/charts/volume-chart";
import { optionalUserId } from "@/lib/db/session";
import { getProfile } from "@/lib/profile/queries";
import { getWeightSeries, getWeightStats } from "@/lib/weight/queries";
import {
  getPersonalRecords,
  getTrainingStats,
  getWeeklyVolumeSeries,
} from "@/lib/workouts/history";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, relativeDay } from "@/lib/format";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { locale, dict } = await getI18n();
  const userId = await optionalUserId();

  const [{ profile }, weightStats, weightSeries, trainingStats, volumeSeries, records] =
    await Promise.all([
      getProfile(),
      getWeightStats(userId),
      getWeightSeries(userId),
      getTrainingStats(userId),
      getWeeklyVolumeSeries(userId),
      getPersonalRecords(userId),
    ]);

  // A profile weight counts as a starting point even before the first log.
  const currentKg = weightStats.currentKg ?? profile?.currentWeightKg ?? null;
  const startKg = weightStats.startKg ?? profile?.currentWeightKg ?? null;
  const changeKg =
    weightStats.changeKg ??
    (currentKg !== null && startKg !== null
      ? Math.round((currentKg - startKg) * 10) / 10
      : null);
  const targetKg = profile?.targetWeightKg ?? null;

  const trendChip =
    weightStats.trendKg !== null
      ? {
          value: fmt(dict.progress.trendPerWeek, {
            n: `${weightStats.trendKg > 0 ? "+" : ""}${weightStats.trendKg}`,
          }),
          direction:
            weightStats.trendKg > 0
              ? ("up" as const)
              : weightStats.trendKg < 0
                ? ("down" as const)
                : ("flat" as const),
        }
      : undefined;

  return (
    <>
      <PageHeader
        title={dict.progress.title}
        description={dict.progress.subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="xl" variant="outline">
              <Link href="/photos">
                <Images className="size-4" aria-hidden="true" />
                {dict.nav.photos}
              </Link>
            </Button>
            <LogWeightDialog initialWeightKg={currentKg} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          value={currentKg ?? "—"}
          unit={dict.common.kg}
          label={dict.progress.currentWeight}
        />
        <MetricCard
          value={targetKg ?? "—"}
          unit={dict.common.kg}
          label={dict.progress.targetWeight}
        />
        <MetricCard
          value={
            changeKg !== null ? `${changeKg > 0 ? "+" : ""}${changeKg}` : "—"
          }
          unit={dict.common.kg}
          label={dict.progress.change}
        />
        <MetricCard
          value={trainingStats.workoutsAllTime || "—"}
          label={dict.progress.workoutsCompleted}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.progress.weightChartTitle}</CardTitle>
            {weightStats.weekAvgKg !== null ? (
              <CardDescription className="tabular-nums">
                {dict.progress.weekAvg}: {weightStats.weekAvgKg}{" "}
                {dict.common.kg}
                {trendChip ? ` · ${trendChip.value}` : ""}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {weightSeries.length > 0 ? (
              <WeightChart points={weightSeries} />
            ) : (
              <EmptyState
                icon={Scale}
                title={dict.progress.noWeightYet}
                description={dict.progress.noWeightYetBody}
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dict.progress.volumeChartTitle}</CardTitle>
            <CardDescription>
              <Link
                href="/history"
                className="inline-flex items-center gap-1.5 underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                <History className="size-3.5" aria-hidden="true" />
                {dict.progress.viewHistory}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeChart points={volumeSeries} />
          </CardContent>
        </Card>
      </div>

      {records.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              {dict.progress.records}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {records.map((record) => (
                <li
                  key={record.exerciseId}
                  className="flex h-12 items-center justify-between gap-3 border-b border-border/60 last:border-b-0"
                >
                  <Link
                    href={`/exercises/${record.exerciseId}`}
                    className="min-w-0 truncate text-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    {record.name}
                  </Link>
                  <span
                    className="shrink-0 text-xs text-muted-foreground"
                    title={formatDate(record.achievedOn, locale)}
                  >
                    {relativeDay(record.achievedOn, locale, dict.common)}
                  </span>
                  <span className="shrink-0 text-base font-semibold text-foreground tabular-nums">
                    {record.weightKg} {dict.common.kg}
                    {record.reps ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        × {record.reps}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
