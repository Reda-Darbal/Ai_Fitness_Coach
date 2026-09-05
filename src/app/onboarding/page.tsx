import { redirect } from "next/navigation";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import { sortEquipment } from "@/lib/profile/constants";
import {
  getProfile,
  hasCompletedOnboarding,
  isProfileStorageReady,
} from "@/lib/profile/queries";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata = { title: "Set up your coach" };

export default async function OnboardingPage() {
  const [{ profile }, facets] = await Promise.all([
    getProfile(),
    exerciseProvider.facets(),
  ]);

  // Already onboarded users land on the dashboard instead of redoing setup.
  if (hasCompletedOnboarding(profile)) redirect("/dashboard");

  return (
    <OnboardingFlow
      equipmentOptions={sortEquipment(facets.equipment)}
      databaseReady={isProfileStorageReady()}
    />
  );
}
