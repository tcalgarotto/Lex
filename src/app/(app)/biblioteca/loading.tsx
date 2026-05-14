import { Skeleton } from "@/components/ui/skeleton";

/** Alinhado a `BibliotecaShelfSection` + `BibliotecaShelfCarousel` (8 capas como na home). */
function ShelfSkeleton() {
  return (
    <section className="lex-glass-card rounded-2xl p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-52 rounded-md md:h-8 md:w-64" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
          <Skeleton className="hidden h-4 w-full max-w-xl rounded-md sm:block" />
        </div>
        <Skeleton className="h-11 w-[7.5rem] shrink-0 rounded-2xl" />
      </div>
      <div className="relative -mx-1 min-w-0">
        <div className="grid auto-cols-[minmax(148px,172px)] grid-flow-col gap-4 overflow-x-hidden px-1 pb-2 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="min-w-0 snap-start">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <div className="mt-3 min-w-0 space-y-1">
                <Skeleton className="h-3 w-14 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-[92%] rounded-md" />
                <Skeleton className="h-3 w-3/4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
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
