import { Skeleton } from "@/components/ui/skeleton";

function ShelfSkeleton() {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        </div>
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>
      <div className="flex gap-3 overflow-hidden pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
            <Skeleton className="mt-1 h-3 w-[80%] rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BibliotecaLoading() {
  return (
    <div className="flex flex-col gap-10">
      <ShelfSkeleton />
      <ShelfSkeleton />
      <ShelfSkeleton />
    </div>
  );
}
