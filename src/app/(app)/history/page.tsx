import Link from "next/link";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/fitness/empty-state";
import { optionalUserId } from "@/lib/db/session";
import { listSessions } from "@/lib/workouts/history";
import { compactKg, relativeDay } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const { locale, dict } = await getI18n();
  const userId = await optionalUserId();
  const sessions = await listSessions(userId, 40);

  return (
    <>
      <PageHeader
        title={dict.history.title}
        description={dict.history.subtitle}
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title={dict.history.empty}
          description={dict.history.emptyBody}
          action={
            <Button asChild size="xl">
              <Link href="/workout">{dict.history.goToWorkout}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
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
                    {fmt(dict.history.summary, {
                      exercises: session.exerciseCount,
                      sets: session.setCount,
                    })}
                    {session.durationMinutes
                      ? ` · ${session.durationMinutes} ${dict.common.min}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {compactKg(session.volumeKg)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dict.history.volume}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
