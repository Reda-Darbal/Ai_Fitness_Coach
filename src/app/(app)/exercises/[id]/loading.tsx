import { Skeleton } from "@/components/ui/skeleton";

export default function ExerciseDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-6 w-full max-w-sm" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}
