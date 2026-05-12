"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({
 className,
 value,
 ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { value: number }) {
 return (
 <ProgressPrimitive.Root
 className={cn("relative h-2 w-full overflow-hidden rounded-full bg-white/10",
 className,
 )}
 {...props}
 value={value}
 >
 <ProgressPrimitive.Indicator
 className="h-full w-full flex-1 bg-violet-500/70 transition-transform"
 style={{ transform: `translateX(-${100 - value}%)` }}
 />
 </ProgressPrimitive.Root>
 );
}

