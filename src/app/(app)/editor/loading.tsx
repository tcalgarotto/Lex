import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonSurfaceClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function EditorLoading() {
  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-7 w-32 rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        <Skeleton className="h-4 w-[88%] max-w-lg rounded-md" />
      </header>

      <ul className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <div className={cn(lexRouteSkeletonSurfaceClassName, "rounded-lg p-3")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-[min(100%,20rem)] rounded-md" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-5 w-36 rounded-md" />
                    <Skeleton className="h-4 w-40 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
