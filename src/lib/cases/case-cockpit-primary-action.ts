/**
 * Próxima ação principal do cockpit do caso (links ou POST draft/review).
 * Ordem alinhada ao fluxo operacional; sem persistência nova.
 */

import type { DocumentStatus } from "@prisma/client";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";
import { hasStrategy } from "@/lib/cases/case-progress-model";

export type CockpitPrimaryAction =
  | { kind: "link"; href: string; label: string; description: string }
  | { kind: "post-draft"; label: string; description: string }
  | { kind: "post-review"; label: string; description: string };

export type CaseCockpitActionContext = {
  caseId: string;
  checklistMissingCount: number;
  documents: Array<{ status: DocumentStatus; updatedAt: Date | string }>;
  facts: { id: string }[];
  parties: { id: string }[];
  requests: { id: string }[];
  legalSources: { id: string }[];
  drafts: { id: string }[];
  reviews: { id: string }[];
  metadataJson: unknown;
};

function seg(caseId: string, path: string) {
  return `/cases/${caseId}/${path}`;
}

export function resolveCaseCockpitPrimaryAction(
  ctx: CaseCockpitActionContext,
  opts: { draftBlocked: boolean },
): CockpitPrimaryAction {
  const { caseId, checklistMissingCount } = ctx;
  const docsIndexed = ctx.documents.filter((d) => d.status === "INDEXED").length;
  const docsStalled = ctx.documents.some((d) => deriveDocumentDisplayStatus(d).stalled);
  const hasFacts = ctx.facts.length > 0;
  const hasRequests = ctx.requests.length > 0;
  const hasResearch = ctx.legalSources.length > 0;
  const hasDraft = ctx.drafts.length > 0;
  const strategy = hasStrategy(ctx.metadataJson);

  if (checklistMissingCount > 0) {
    return {
      kind: "link",
      href: seg(caseId, "entrevista"),
      label: "Continuar entrevista",
      description:
        "Responda os itens pendentes da entrevista guiada para consolidar o relato antes de avançar com documentos e peças.",
    };
  }

  if (ctx.documents.length === 0) {
    return {
      kind: "link",
      href: seg(caseId, "documentos"),
      label: "Enviar documento",
      description: "Envie um documento ao caso para extrair fatos, identificar partes e sustentar a estratégia.",
    };
  }

  if (docsStalled) {
    return {
      kind: "link",
      href: seg(caseId, "documentos"),
      label: "Resolver documentos travados",
      description:
        "Há documento parado na fila de processamento. Reabra a aba Documentos para reprocessar ou substituir o arquivo.",
    };
  }

  if (docsIndexed > 0 && !hasFacts) {
    return {
      kind: "link",
      href: seg(caseId, "partes-fatos"),
      label: "Extrair fatos e partes",
      description: "Os documentos já estão prontos. Consolide fatos, partes e pedidos na aba Fatos e partes.",
    };
  }

  if (hasFacts && !hasRequests) {
    return {
      kind: "link",
      href: seg(caseId, "partes-fatos"),
      label: "Consolidar pedidos",
      description: "Registre pedidos e ajuste partes para habilitar pesquisa jurídica e a estratégia da peça.",
    };
  }

  if (hasFacts && !hasResearch) {
    return {
      kind: "link",
      href: seg(caseId, "pesquisa-juridica"),
      label: "Pesquisar fundamentos",
      description: "Pin fundamento e jurisprudência aplicável antes de fechar a estratégia e a minuta.",
    };
  }

  if (hasFacts && hasRequests && !strategy) {
    return {
      kind: "link",
      href: seg(caseId, "estrategia"),
      label: "Gerar estratégia",
      description: "Gere a estratégia e a primeira versão da peça com base em fatos, pedidos e fundamentos.",
    };
  }

  if (strategy && !hasDraft) {
    if (opts.draftBlocked) {
      return {
        kind: "link",
        href: seg(caseId, "partes-fatos"),
        label: "Completar pendências",
        description:
          "O caso ainda não atingiu o mínimo para gerar peça com segurança. Complete partes, fatos ou documentos indicados na revisão de prontidão.",
      };
    }
    return {
      kind: "post-draft",
      label: "Gerar peça",
      description: "Gere a minuta com a estratégia já definida. Revise lacunas antes de protocolar.",
    };
  }

  if (hasDraft) {
    return {
      kind: "post-review",
      label: "Revisar peça",
      description: "Execute a revisão assistida da última peça gerada antes de exportar ou protocolar.",
    };
  }

  return {
    kind: "link",
    href: `/cases/${caseId}`,
    label: "Abrir visão geral",
    description: "Veja narrativa, timeline e próximos passos sugeridos nesta aba.",
  };
}
