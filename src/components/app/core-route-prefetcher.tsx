"use client";

import { useCoreRoutePrefetch } from "@/hooks/use-core-route-prefetch";

/** Montado no chrome do `(app)` — prefetch em idle das rotas principais. */
export function CoreRoutePrefetcher() {
  useCoreRoutePrefetch();
  return null;
}
