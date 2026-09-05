import { Skeleton } from "@/components/ui/skeleton";

export default function WorkoutLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-72" />
    </>
  );
}
