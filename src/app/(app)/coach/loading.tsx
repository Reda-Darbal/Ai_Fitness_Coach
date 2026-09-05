import { Skeleton } from "@/components/ui/skeleton";

export default function CoachLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 max-w-md" />
        <Skeleton className="h-11" />
      </div>
    </>
  );
}
