import { notFound, redirect } from "next/navigation";
import { optionalUserId } from "@/lib/db/session";
import { getSession } from "@/lib/workouts/queries";
import { LiveWorkout } from "./live-workout";

export const metadata = { title: "Live workout" };

export default async function LiveWorkoutPage({
  params,
}: PageProps<"/workout/[sessionId]">) {
  const { sessionId } = await params;
  const userId = await optionalUserId();
  const { session } = await getSession(userId, sessionId);

  if (!session) notFound();
  // A finished session is history, not something to keep logging into.
  if (session.completedAt) redirect("/dashboard");

  return <LiveWorkout session={session} />;
}
