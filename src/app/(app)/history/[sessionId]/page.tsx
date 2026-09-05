import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, SkipForward, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatNumber } from "@/components/fitness/stat-number";
import { optionalUserId } from "@/lib/db/session";
import { getSession } from "@/lib/workouts/queries";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Session" };

export default async function SessionDetailPage({
  params,
}: PageProps<"/history/[sessionId]">) {
  const { sessionId } = await params;
  const { locale, dict } = await getI18n();
  const userId = await optionalUserId();
  const { session } = await getSession(userId, sessionId);

  if (!session) notFound();

  const workingSets = session.exercises.flatMap((e) =>
    e.sets.filter((s) => !s.isWarmup),
  );
  const volume = Math.round(
    workingSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
  );
  const duration = session.completedAt
    ? Math.round(
        (new Date(session.completedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          60000,
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
        <Link href="/history">
          <ArrowLeft className="rtl:-scale-x-100 size-4" aria-hidden="true" />
          {dict.history.title}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {session.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(session.completedAt ?? session.startedAt, locale)}
          {session.completedAt ? "" : ` · ${dict.history.notFinished}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
        <StatNumber value={workingSets.length} label={dict.common.sets} size="sm" />
        <StatNumber
          value={volume}
          unit={dict.common.kg}
          label={dict.history.volumeLabel}
          size="sm"
        />
        <StatNumber
          value={duration ?? "—"}
          unit={dict.common.min}
          label={dict.history.time}
          size="sm"
        />
      </div>

      <ol className="flex flex-col gap-3">
        {session.exercises.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/exercises/${item.exerciseId}`}
                className="min-w-0 text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                {item.exercise?.name ?? item.exerciseId}
              </Link>
              <div className="flex shrink-0 gap-1.5">
                {item.skipped ? (
                  <Badge variant="outline" className="gap-1">
                    <SkipForward className="rtl:-scale-x-100 size-3" aria-hidden="true" />
                    {dict.history.skipped}
                  </Badge>
                ) : null}
                {item.feedback ? (
                  <Badge
                    variant={item.feedback === "pain" ? "destructive" : "secondary"}
                    className="gap-1"
                  >
                    {item.feedback === "pain" ? (
                      <TriangleAlert className="size-3" aria-hidden="true" />
                    ) : null}
                    {dict.history.feedback[item.feedback]}
                  </Badge>
                ) : null}
              </div>
            </div>

            {item.sets.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {item.sets.map((set) => (
                  <li
                    key={set.id}
                    className="rounded-lg bg-muted px-2.5 py-1.5 text-sm text-foreground tabular-nums"
                  >
                    {set.weightKg ?? "—"}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      {dict.common.kg} ×{" "}
                    </span>
                    {set.reps ?? "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {dict.history.noSets}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
