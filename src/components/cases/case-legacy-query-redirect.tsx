"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 *
 * Compat: links antigos `?tab=` redirecionam para as novas rotas por seção.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const TAB_TO_PATH: Record<string, string> = {
 overview: "",
 documents: "/documentos",
 facts: "/partes-fatos",
 research: "/pesquisa-juridica",
 strategy: "/estrategia",
 pieces: "/pecas",
 drafts: "/pecas",
 checklist: "/entrevista",
 activity: "",
};

export function CaseLegacyQueryRedirect({ caseId }: { caseId: string }) {
 const router = useRouter();
 const sp = useSearchParams();

 useEffect(() => {
 const tab = sp.get("tab");
 if (!tab) return;
 const suffix = TAB_TO_PATH[tab];
 if (suffix === undefined) return;
 const next = `/cases/${caseId}${suffix}`;
 router.replace(next, { scroll: false });
 }, [caseId, router, sp]);

 return null;
}
