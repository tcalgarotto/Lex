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
 className="min-w-0 border-b border-[color:var(--border-subtle)]"
 >
 <ul className="flex min-w-0 gap-0 overflow-x-auto overscroll-x-contain whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
 className={cn("relative inline-flex items-center px-3 py-2.5 text-[13px] font-medium outline-none lex-transition",
 "focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
 active
 ? "text-[color:var(--text-primary)]"
 : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
 )}
 aria-current={active ? "page" : undefined}
 >
 {item.label}
 {active ? (
 <span
 className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
 style={{ background: "var(--brand-primary)" }}
 aria-hidden
 />
 ) : null}
 </Link>
 </li>
 );
 })}
 </ul>
 </nav>
 );
}
