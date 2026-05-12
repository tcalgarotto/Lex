import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
 return (
 <div className="space-y-4 p-6">
 <Skeleton className="h-8 w-1/3 rounded-md" />
 <Skeleton className="h-32 w-full rounded-lg" />
 <Skeleton className="h-64 w-full rounded-lg" />
 </div>
 );
}
