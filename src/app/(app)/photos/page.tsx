import { PageHeader } from "@/components/layout/page-header";
import { optionalUserId } from "@/lib/db/session";
import { getPhotos } from "@/lib/photos/queries";
import { getWeightStats } from "@/lib/weight/queries";
import { getI18n } from "@/lib/i18n/server";
import { PhotosView } from "./photos-view";

export const metadata = { title: "Photos" };

export default async function PhotosPage() {
  const { dict } = await getI18n();
  const userId = await optionalUserId();

  const [photos, weightStats] = await Promise.all([
    getPhotos(userId),
    getWeightStats(userId),
  ]);

  return (
    <>
      <PageHeader title={dict.photos.title} description={dict.photos.subtitle} />
      <PhotosView photos={photos} currentWeightKg={weightStats.currentKg} />
    </>
  );
}
