import { CalendarPlus } from "lucide-react";
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
import { GenerateProgramButton } from "@/components/fitness/generate-program-button";
import { WorkoutCard } from "@/components/fitness/workout-card";
import { WEEKDAYS, type Weekday } from "@/lib/profile/constants";
import { fmt, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getProfile } from "@/lib/profile/queries";
import { getActiveProgram, todaysDay } from "@/lib/programs/queries";
import { getTrainingStats, listSessions } from "@/lib/workouts/history";
import { getWeightStats } from "@/lib/weight/queries";
import { isCheckinDue } from "@/lib/checkins/queries";
import { ClipboardCheck, UtensilsCrossed } from "lucide-react";
import { calculateTargets } from "@/lib/nutrition/targets";
import { Button } from "@/components/ui/button";
import { compactKg, relativeDay } from "@/lib/format";
import Link from "next/link";
import { optionalUserId } from "@/lib/db/session";

/** Next scheduled training day, computed locally — no AI needed for a date. */
function nextTrainingDay(days: Weekday[], dict: Dictionary): string | null {
  if (days.length === 0) return null;
  const todayIndex = (new Date().getDay() + 6) % 7; // 0 = Monday
  for (let offset = 0; offset < 7; offset += 1) {
    const day = WEEKDAYS[(todayIndex + offset) % 7];
    if (days.includes(day)) {
      if (offset === 0) return dict.common.today;
      if (offset === 1) return dict.common.tomorrow;
      return dict.weekdays[day].full;
    }
  }
  return null;
}

export default async function DashboardPage() {
  const [{ profile }, userId, { locale, dict }] = await Promise.all([
    getProfile(),
    optionalUserId(),
    getI18n(),
  ]);
  const [{ program }, stats, recent, weightStats, checkinDue] =
    await Promise.all([
      getActiveProgram(userId),
      getTrainingStats(userId),
      listSessions(userId, 3),
      getWeightStats(userId),
      isCheckinDue(userId),
    ]);
  const today = todaysDay(program);

  const currentWeight = weightStats.currentKg ?? profile?.currentWeightKg ?? null;
  const weightChange =
    currentWeight != null && profile?.targetWeightKg != null
      ? profile.targetWeightKg - currentWeight
      : null;

  return (
    <>
      <PageHeader
        title={
          profile?.displayName
            ? fmt(dict.dashboard.greeting, { name: profile.displayName })
            : dict.dashboard.today
        }
        description={
          profile
            ? fmt(dict.dashboard.goalDays, {
                goal: dict.goals[profile.goal].title,
                n: profile.trainingDays.length,
              })
            : dict.dashboard.subtitle
        }
        action={
          program ? (
            <GenerateProgramButton label={dict.dashboard.regenerate} variant="outline" />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          value={currentWeight ?? "—"}
          unit={dict.common.kg}
          label={dict.dashboard.bodyWeight}
        />
        <MetricCard
          value={profile?.targetWeightKg ?? "—"}
          unit={dict.common.kg}
          label={dict.dashboard.target}
          trend={
            weightChange != null && weightChange !== 0
              ? {
                  value: `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}`,
                  direction: weightChange > 0 ? "up" : "down",
                }
              : undefined
          }
        />
        <MetricCard
          value={stats.workoutsThisWeek}
          label={dict.dashboard.workoutsThisWeek}
        />
        <MetricCard
          value={stats.volumeThisWeekKg > 0 ? compactKg(stats.volumeThisWeekKg) : "—"}
          unit={dict.common.kg}
          label={dict.dashboard.volumeThisWeek}
          trend={
            stats.weekStreak > 1
              ? { value: `${stats.weekStreak}w`, direction: "up" }
              : undefined
          }
        />
      </div>

      {profile ? (
        (() => {
          const targets = calculateTargets({
            weightKg: currentWeight,
            heightCm: profile.heightCm,
            age: profile.age,
            sex: profile.sex,
            trainingDaysPerWeek: profile.trainingDays.length,
            goal: profile.goal,
          });
          return (
            <Link
              href="/nutrition"
              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span className="flex min-w-0 items-center gap-3">
                <UtensilsCrossed
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-foreground">
                  {dict.nutrition.title}
                </span>
              </span>
              {targets ? (
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {targets.calories} kcal · {targets.proteinG}g
                </span>
              ) : null}
            </Link>
          );
        })()
      ) : null}

      {checkinDue ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <ClipboardCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {dict.checkin.dueTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dict.checkin.dueBody}
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/checkin">{dict.checkin.dueCta}</Link>
          </Button>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">{dict.dashboard.recent}</h2>
            <Link
              href="/history"
              className="text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {dict.dashboard.allHistory}
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/history/${session.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeDay(session.completedAt, locale, dict.common)} ·{" "}
                      {session.setCount} {dict.common.sets}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {compactKg(session.volumeKg)} {dict.common.kg}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {program ? (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {program.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {today ? dict.dashboard.sessionToday : dict.dashboard.restDayLabel}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {program.days.map((day) => (
              <WorkoutCard
                key={day.id}
                day={day}
                isToday={day.id === today?.id}
                href="/workout"
              />
            ))}
          </div>
        </section>
      ) : (
        <>
          {profile && profile.trainingDays.length > 0 ? (
            <Card className="mt-3">
              <CardHeader>
                <CardTitle>{dict.dashboard.yourWeek}</CardTitle>
                <CardDescription>
                  {nextTrainingDay(profile.trainingDays, dict)
                    ? fmt(dict.dashboard.nextSession, {
                        day: nextTrainingDay(profile.trainingDays, dict) ?? "",
                      })
                    : dict.dashboard.noTrainingDays}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const active = profile.trainingDays.includes(day);
                    return (
                      <div
                        key={day}
                        className={
                          active
                            ? "flex h-11 items-center justify-center rounded-lg border border-primary bg-primary/10 text-xs font-medium text-foreground"
                            : "flex h-11 items-center justify-center rounded-lg border border-border bg-card text-xs text-muted-foreground"
                        }
                      >
                        <span className="sr-only">
                          {dict.weekdays[day].full}
                          {active
                            ? ` — ${dict.dashboard.trainingDay}`
                            : ` — ${dict.dashboard.restDay}`}
                        </span>
                        <span aria-hidden="true">
                          {dict.weekdays[day].short}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-6">
            <EmptyState
              icon={CalendarPlus}
              title={dict.dashboard.noProgram}
              description={dict.dashboard.noProgramBody}
              action={<GenerateProgramButton />}
            />
          </div>
        </>
      )}
    </>
  );
}
