"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CORE_IDLE_PREFETCH_ROUTES,
  cancelIdleCallbackCompat,
  prefetchOnce,
  requestIdleCallbackCompat,
} from "@/lib/navigation/prefetch-routes";

const STAGGER_MS = 220;
const POST_MOUNT_DELAY_MS = 500;

/**
 * Prefetch em idle das rotas principais, com fila e sem repetir na sessão.
 * Não bloqueia render; falhas são ignoradas.
 */
export function useCoreRoutePrefetch(): void {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    let idleId = 0;
    let chainTimer: ReturnType<typeof setTimeout> | null = null;

    const chain = (index: number) => {
      if (cancelled || index >= CORE_IDLE_PREFETCH_ROUTES.length) return;
      const href = CORE_IDLE_PREFETCH_ROUTES[index];
      if (!href) return;
      const p = pathnameRef.current;
      if (p !== href) {
        prefetchOnce(router, href);
      }
      chainTimer = setTimeout(() => chain(index + 1), STAGGER_MS);
    };

    const startTimer = setTimeout(() => {
      idleId = requestIdleCallbackCompat(() => {
        if (!cancelled) chain(0);
      }, 2000);
    }, POST_MOUNT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (chainTimer) clearTimeout(chainTimer);
      cancelIdleCallbackCompat(idleId);
    };
  }, [router]);
}
