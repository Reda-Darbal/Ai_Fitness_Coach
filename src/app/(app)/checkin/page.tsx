import { PageHeader } from "@/components/layout/page-header";
import { optionalUserId } from "@/lib/db/session";
import { getCurrentCheckin } from "@/lib/checkins/queries";
import { getWeightStats } from "@/lib/weight/queries";
import { getTrainingStats } from "@/lib/workouts/history";
import { getProfile } from "@/lib/profile/queries";
import { getI18n } from "@/lib/i18n/server";
import { CheckinForm } from "./checkin-form";

export const metadata = { title: "Check-in" };

export default async function CheckinPage() {
  const { dict } = await getI18n();
  const userId = await optionalUserId();

  const [existing, weightStats, trainingStats, { profile }] = await Promise.all([
    getCurrentCheckin(userId),
    getWeightStats(userId),
    getTrainingStats(userId),
    getProfile(),
  ]);

  return (
    <>
      <PageHeader title={dict.checkin.title} description={dict.checkin.subtitle} />
      <CheckinForm
        workoutsDone={trainingStats.workoutsThisWeek}
        currentWeightKg={weightStats.currentKg ?? profile?.currentWeightKg ?? null}
        existing={existing}
      />
    </>
  );
}
