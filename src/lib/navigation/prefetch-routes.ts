/**
 * Prefetch controlado de rotas do app (cliente).
 * Evita repetir o mesmo `router.prefetch` na sessão e não substitui `router.refresh()` após mutações.
 */

const prefetched = new Set<string>();

/**
 * Ordem após idle: prioridade pedida pelo produto; `/dashboard` por último (muitas vezes já é a rota inicial).
 */
export const CORE_IDLE_PREFETCH_ROUTES = [
  "/cases",
  "/documentos",
  "/biblioteca",
  "/pesquisa-juridica",
  "/processos",
  "/editor",
  "/agenda",
  "/dashboard",
] as const;

/** Marca como feito mesmo se falhar, para não martelar o router em loop. */
export function prefetchOnce(
  router: { prefetch: (href: string) => void | Promise<void> },
  href: string,
): void {
  if (!href.startsWith("/")) return;
  if (prefetched.has(href)) return;
  prefetched.add(href);
  try {
    void router.prefetch(href);
  } catch {
    // noop — prefetch é best-effort
  }
}

export function requestIdleCallbackCompat(cb: () => void, timeoutMs = 1800): number {
  if (typeof window === "undefined") return 0;
  const ric = window.requestIdleCallback;
  if (typeof ric === "function") {
    return ric(() => cb(), { timeout: timeoutMs });
  }
  return window.setTimeout(() => cb(), 1) as unknown as number;
}

export function cancelIdleCallbackCompat(id: number): void {
  if (typeof window === "undefined") return;
  const cic = window.cancelIdleCallback;
  if (typeof cic === "function") {
    cic(id);
  } else {
    window.clearTimeout(id);
  }
}
