import { Skeleton } from "@/components/ui/skeleton";

export default function ExercisesLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="mb-6 h-11" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3]" />
        ))}
      </div>
    </>
  );
}
