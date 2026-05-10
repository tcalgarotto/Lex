"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Exportado para testes de regressão (ordem das abas do caso). */
export const CASE_SUBNAV_ITEMS = [
  { suffix: "", label: "Visão geral" },
  { suffix: "/entrevista", label: "Entrevista guiada" },
  { suffix: "/partes-fatos", label: "Partes e fatos" },
  { suffix: "/documentos", label: "Documentos" },
  { suffix: "/pesquisa-juridica", label: "Pesquisa jurídica" },
  { suffix: "/estrategia", label: "Estratégia e peças" },
] as const;

export function CaseSubnav({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const base = `/cases/${caseId}`;

  return (
    <nav
      aria-label="Seções do caso"
      className="min-w-0 rounded-lg border border-border bg-card/40 p-1 shadow-sm"
    >
      <ul className="flex min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain whitespace-nowrap px-0.5 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CASE_SUBNAV_ITEMS.map((item) => {
          const href = `${base}${item.suffix}`;
          const isOverview = item.suffix === "";
          const active = isOverview
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={item.suffix || "overview"} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium outline-none ring-offset-background transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
