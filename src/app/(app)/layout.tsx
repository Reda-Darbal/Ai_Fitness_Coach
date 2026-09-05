import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  getProfile,
  hasCompletedOnboarding,
  isProfileStorageReady,
} from "@/lib/profile/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Onboarding gate. Skipped while no database is configured so the app stays
  // browsable during first-time setup — this is routing, not authorization,
  // which lives in the repository layer (src/lib/db/session.ts).
  if (isProfileStorageReady()) {
    const { profile } = await getProfile();
    if (!hasCompletedOnboarding(profile)) redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
