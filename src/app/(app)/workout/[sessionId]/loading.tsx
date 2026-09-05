import { Skeleton } from "@/components/ui/skeleton";

export default function LiveWorkoutLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-2 w-full" />
      <div className="flex gap-3">
        <Skeleton className="size-24 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
