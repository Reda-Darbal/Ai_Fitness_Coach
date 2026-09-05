"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChipToggle } from "@/components/fitness/chip-toggle";
import { EmptyState } from "@/components/fitness/empty-state";
import { confirmPhotoUpload, createPhotoUpload, deletePhoto } from "@/lib/photos/actions";
import { reviewPhotos } from "@/lib/photos/review";
import type { PhotoPose, ProgressPhoto } from "@/lib/photos/queries";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

const POSES: PhotoPose[] = ["front", "side", "back"];

function poseLabel(dict: ReturnType<typeof useI18n>["dict"], pose: PhotoPose) {
  return pose === "front"
    ? dict.photos.front
    : pose === "side"
      ? dict.photos.side
      : dict.photos.back;
}

/* eslint-disable @next/next/no-img-element -- presigned URLs rotate every
   request; the optimizer cache would never hit and private photos should not
   pass through it anyway. */

function UploadDialog({ currentWeightKg }: { currentWeightKg: number | null }) {
  const { dict } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const created = await createPhotoUpload({ contentType: file.type });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      const put = await fetch(created.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) {
        toast.error(`Upload failed (${put.status}).`);
        return;
      }
      const confirmed = await confirmPhotoUpload({
        key: created.key,
        pose,
        weightKg: currentWeightKg,
      });
      if (!confirmed.ok) {
        toast.error(confirmed.error);
        return;
      }
      toast.success(dict.photos.uploaded);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xl">
          <Camera className="size-4" aria-hidden="true" />
          {dict.photos.addPhoto}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dict.photos.uploadTitle}</DialogTitle>
          <DialogDescription>{dict.photos.subtitle}</DialogDescription>
        </DialogHeader>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {dict.photos.pose}
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {POSES.map((p) => (
              <ChipToggle
                key={p}
                checked={pose === p}
                onToggle={() => setPose(p)}
                label={poseLabel(dict, p)}
              />
            ))}
          </div>
        </fieldset>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          size="xl"
          className="w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {dict.photos.uploading}
            </>
          ) : (
            <>
              <Camera className="size-4" aria-hidden="true" />
              {dict.photos.addPhoto}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PhotoCard({ photo }: { photo: ProgressPhoto }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <img
        src={photo.url}
        alt={`${poseLabel(dict, photo.pose)} — ${formatDate(photo.takenOn, locale)}`}
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
        <span className="text-muted-foreground">{poseLabel(dict, photo.pose)}</span>
        {photo.weightKg ? (
          <span className="text-foreground tabular-nums">
            {photo.weightKg} {dict.common.kg}
          </span>
        ) : null}
      </figcaption>
      <Button
        variant="destructive"
        size="icon-sm"
        aria-label={dict.photos.deleteConfirm}
        disabled={pending}
        className="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          if (!window.confirm(dict.photos.deleteConfirm)) return;
          startTransition(async () => {
            const result = await deletePhoto(photo.id);
            if (!result.ok) toast.error(result.error);
            else {
              toast.success(dict.photos.deleted);
              router.refresh();
            }
          });
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </figure>
  );
}

function ReviewDialog({ photos }: { photos: ProgressPhoto[] }) {
  const { dict } = useI18n();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    startTransition(async () => {
      setReply(null);
      const result = await reviewPhotos({
        photoIds: photos.slice(0, 4).map((p) => p.id),
        question,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReply(result.reply);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="xl" variant="outline" disabled={photos.length === 0}>
          <Sparkles className="size-4" aria-hidden="true" />
          {dict.photos.askCoach}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.photos.coachReview}</DialogTitle>
          <DialogDescription>{dict.photos.reviewHint}</DialogDescription>
        </DialogHeader>

        {reply ? (
          <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm whitespace-pre-wrap text-foreground">
            {reply}
          </p>
        ) : null}

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={dict.photos.reviewPlaceholder}
          rows={2}
        />
        <Button size="xl" className="w-full" onClick={ask} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {dict.photos.reviewSend}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function PhotosView({
  photos,
  currentWeightKg,
}: {
  photos: ProgressPhoto[];
  currentWeightKg: number | null;
}) {
  const { dict, locale } = useI18n();

  const dates = useMemo(
    () => [...new Set(photos.map((p) => p.takenOn))].sort(),
    [photos],
  );
  const [beforeDate, setBeforeDate] = useState<string | null>(null);
  const [afterDate, setAfterDate] = useState<string | null>(null);

  const a = beforeDate ?? dates[0] ?? null;
  const b = afterDate ?? dates[dates.length - 1] ?? null;
  const beforePhotos = photos.filter((p) => p.takenOn === a);
  const afterPhotos = photos.filter((p) => p.takenOn === b);
  const selectedForReview = [...beforePhotos, ...afterPhotos];

  const byDate = useMemo(() => {
    const groups = new Map<string, ProgressPhoto[]>();
    for (const photo of photos) {
      const list = groups.get(photo.takenOn) ?? [];
      list.push(photo);
      groups.set(photo.takenOn, list);
    }
    return [...groups.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1));
  }, [photos]);

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title={dict.photos.noPhotos}
        description={dict.photos.noPhotosBody}
        action={<UploadDialog currentWeightKg={currentWeightKg} />}
      />
    );
  }

  return (
    <Tabs defaultValue="gallery">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="gallery">{dict.photos.gallery}</TabsTrigger>
          <TabsTrigger value="compare">{dict.photos.compare}</TabsTrigger>
        </TabsList>
        <UploadDialog currentWeightKg={currentWeightKg} />
      </div>

      <TabsContent value="gallery">
        <div className="flex flex-col gap-6">
          {byDate.map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                {formatDate(date, locale)}
                {list[0]?.weightKg ? (
                  <span className="ms-2 text-xs font-normal text-muted-foreground tabular-nums">
                    {list[0].weightKg} {dict.common.kg}
                  </span>
                ) : null}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {list.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="compare">
        {dates.length < 2 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {dict.photos.needTwoDates}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  [dict.photos.before, a, setBeforeDate],
                  [dict.photos.after, b, setAfterDate],
                ] as const
              ).map(([label, value, set]) => (
                <div key={label}>
                  <p className="mb-1.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {label}
                  </p>
                  <Select value={value ?? undefined} onValueChange={set}>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dates.map((d) => (
                        <SelectItem key={d} value={d}>
                          {formatDate(d, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {POSES.map((pose) => {
              const left = beforePhotos.find((p) => p.pose === pose);
              const right = afterPhotos.find((p) => p.pose === pose);
              if (!left && !right) return null;
              return (
                <section key={pose}>
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    {poseLabel(dict, pose)}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[left, right].map((photo, i) => (
                      <div key={i}>
                        {photo ? (
                          <PhotoCard photo={photo} />
                        ) : (
                          <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                            {dict.common.none}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            <ReviewDialog photos={selectedForReview} />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
