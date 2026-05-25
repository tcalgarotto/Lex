import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand/justos";

/**
 * Wordmark compacto para topbar do app (Restrained — sem gradiente neon).
 */
export function JustOSWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "truncate text-base font-semibold tracking-tight text-[color:var(--text-primary)] md:text-lg",
        className,
      )}
    >
      {PRODUCT_NAME}
    </span>
  );
}
