"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, type ComponentProps } from "react";
import { prefetchOnce } from "@/lib/navigation/prefetch-routes";
import { cn } from "@/lib/utils";

type LinkProps = ComponentProps<typeof Link>;

/**
 * `prefetch={false}` no Link + `router.prefetch` em hover/focus para não disparar centenas de RSC na viewport.
 */
export const HoverPrefetchLink = forwardRef<HTMLAnchorElement, LinkProps>(function HoverPrefetchLink(
  { href, className, onMouseEnter, onFocus, children, ...rest },
  ref,
) {
  const router = useRouter();
  const hrefStr = typeof href === "string" ? href : "";
  const warm = useCallback(() => prefetchOnce(router, hrefStr), [router, hrefStr]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={false}
      className={cn(className)}
      {...rest}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
    >
      {children}
    </Link>
  );
});

HoverPrefetchLink.displayName = "HoverPrefetchLink";
