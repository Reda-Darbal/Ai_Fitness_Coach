import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import { sortEquipment } from "@/lib/profile/constants";
import { getProfile, isProfileStorageReady } from "@/lib/profile/queries";
import { SettingsForm } from "./settings-form";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { dict } = await getI18n();
  const [{ profile, error }, facets] = await Promise.all([
    getProfile(),
    exerciseProvider.facets(),
  ]);

  return (
    <>
      <PageHeader
        title={dict.settings.title}
        description={dict.settings.subtitle}
      />

      <div className="flex max-w-xl flex-col gap-4">
        {profile ? (
          <SettingsForm
            profile={profile}
            equipmentOptions={sortEquipment(facets.equipment)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert
                  className="size-4 text-warning"
                  aria-hidden="true"
                />
                {dict.settings.noProfile}
              </CardTitle>
              <CardDescription>
                {!isProfileStorageReady()
                  ? "No database is connected yet, so there's nothing to edit. Add DATABASE_URL to .env.local and run `npm run db:migrate`."
                  : error
                    ? `Couldn't load your profile: ${error}`
                    : "Finish onboarding and your training profile becomes editable here."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="xl" variant="outline">
                <Link href="/onboarding">{dict.settings.goToOnboarding}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{dict.settings.account}</CardTitle>
            <CardDescription>{dict.settings.accountHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton>
              <Button variant="outline" size="xl">
                {dict.common.signOut}
              </Button>
            </SignOutButton>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
