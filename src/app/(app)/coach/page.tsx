import { PageHeader } from "@/components/layout/page-header";
import { optionalUserId } from "@/lib/db/session";
import { getCoachThread } from "@/lib/coach/queries";
import { getActiveProgram, todaysDay } from "@/lib/programs/queries";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { CoachChat } from "./coach-chat";

export const metadata = { title: "Coach" };

export default async function CoachPage() {
  const { dict } = await getI18n();
  const userId = await optionalUserId();

  const [{ messages }, { program }] = await Promise.all([
    getCoachThread(userId),
    getActiveProgram(userId),
  ]);
  const today = todaysDay(program);

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col lg:min-h-[calc(100dvh-9rem)]">
      <PageHeader title={dict.coach.title} description={dict.coach.subtitle} />

      {program ? (
        <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {today
            ? fmt(dict.coach.todayStrip, { name: today.name }) +
              " · " +
              today.exercises
                .slice(0, 3)
                .map((e) => e.exercise?.name ?? e.exerciseId)
                .join(" · ")
            : dict.coach.restToday}
        </p>
      ) : null}

      <CoachChat initialMessages={messages} />
    </div>
  );
}
