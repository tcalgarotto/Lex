import { CaseStatus, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findStalledDocuments } from "@/lib/documents/stalled";

/**
 * Tipos das "Próximas ações" do Dashboard.
 *
 * Cada ação retorna o suficiente para renderizar uma linha (label + tone +
 * href). Não inclui dados sensíveis. Categorias mapeiam diretamente os
 * critérios pedidos no briefing P1.2.
 */

export type NextActionTone = "warning" | "info" | "ok" | "muted";

export interface NextActionItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  tone: NextActionTone;
}

export interface NextActionGroup {
  key: string;
  title: string;
  items: NextActionItem[];
  /** Quando vazio, exibe `emptyText`. Se omitido, esconde o grupo. */
  emptyText?: string;
}

export interface NextActionsBundle {
  groups: NextActionGroup[];
  totals: {
    stalled: number;
    unlinked: number;
    readyForFacts: number;
    casesNeedingStrategy: number;
    draftsInProgress: number;
  };
  baseAvailability: {
    cf: boolean;
    adct: boolean;
  };
}

/**
 * Coleta as próximas ações para um workspace. Cada query é leve e
 * paralela (`Promise.all`). Limita cada lista a 5 itens para a UI.
 *
 * Não toca em RAG nem corpus — só Postgres do app.
 */
export async function buildNextActions(workspaceId: string): Promise<NextActionsBundle> {
  const TAKE = 5;

  const [
    stalled,
    unlinked,
    recentCases,
    docsReadyForFacts,
    casesNeedingStrategy,
    draftsInProgress,
    cfNorm,
    adctNorm,
    casesNeedingStrategyCount,
    draftsInProgressCount,
  ] = await Promise.all([
    findStalledDocuments(workspaceId, { take: TAKE }),
    prisma.document.findMany({
      where: { workspaceId, caseId: null, status: DocumentStatus.INDEXED },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: { id: true, originalName: true, updatedAt: true },
    }),
    prisma.case.findMany({
      where: { workspaceId, status: { notIn: [CaseStatus.CLOSED, CaseStatus.ARCHIVED] } },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        _count: { select: { facts: true, drafts: true, documents: true } },
      },
    }),
    prisma.document.findMany({
      where: {
        workspaceId,
        status: DocumentStatus.INDEXED,
        caseId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        originalName: true,
        caseId: true,
        case: { select: { id: true, title: true, _count: { select: { facts: true } } } },
      },
    }),
    prisma.case.findMany({
      where: {
        workspaceId,
        status: { notIn: [CaseStatus.CLOSED, CaseStatus.ARCHIVED] },
        facts: { some: {} },
        drafts: { none: {} },
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: { id: true, title: true, _count: { select: { facts: true, requests: true } } },
    }),
    prisma.legalPiece.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: { id: true, title: true, kind: true, updatedAt: true },
    }),
    prisma.legalNorm
      .findFirst({
        where: { kind: "CONSTITUTION" },
        select: { id: true },
      })
      .catch(() => null),
    // ADCT vive como seção dentro da CF — simplificamos detectando se há
    // pelo menos um chunk cujo `fullPath` ou `articleRef` mencione "ADCT".
    prisma.legalChunk
      .findFirst({
        where: {
          OR: [
            { fullPath: { contains: "ADCT", mode: "insensitive" } },
            { articleRef: { contains: "ADCT", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
      .catch(() => null),
    prisma.case.count({
      where: {
        workspaceId,
        status: { notIn: [CaseStatus.CLOSED, CaseStatus.ARCHIVED] },
        facts: { some: {} },
        drafts: { none: {} },
      },
    }),
    prisma.legalPiece.count({ where: { workspaceId } }),
  ]);

  // Filtra "docsReadyForFacts" para apenas casos sem fatos ainda.
  const readyForFacts = docsReadyForFacts.filter(
    (d) => d.case && (d.case._count?.facts ?? 0) === 0,
  );

  const groups: NextActionGroup[] = [
    {
      key: "stalled",
      title: "Documentos travados",
      emptyText: "Nenhum documento travado.",
      items: stalled.map((d) => ({
        id: d.id,
        label: d.originalName,
        hint: `Em ${d.status.toLowerCase()} há mais tempo que o esperado`,
        href: `/documentos?status=${d.status}`,
        tone: "warning",
      })),
    },
    {
      key: "unlinked",
      title: "Documentos sem caso",
      emptyText: "Todos os documentos prontos estão vinculados.",
      items: unlinked.map((d) => ({
        id: d.id,
        label: d.originalName,
        hint: "Pronto para análise — vincular a um caso",
        href: `/documentos?unlinked=1`,
        tone: "info",
      })),
    },
    {
      key: "ready_facts",
      title: "Documentos prontos para análise",
      emptyText: "Sem documentos novos prontos para extração de fatos.",
      items: readyForFacts.map((d) => ({
        id: d.id,
        label: d.originalName,
        hint: d.case?.title
          ? `Caso "${d.case.title}" sem fatos extraídos`
          : "Caso sem fatos extraídos",
        href: d.caseId ? `/cases/${d.caseId}` : "/documentos",
        tone: "info",
      })),
    },
    {
      key: "cases_needing_strategy",
      title: "Casos com fatos mas sem estratégia",
      emptyText: "Todos os casos com fatos já têm estratégia gerada.",
      items: casesNeedingStrategy.map((c) => ({
        id: c.id,
        label: c.title,
        hint: `${c._count.facts} fato(s) · ${c._count.requests} pedido(s)`,
        href: `/cases/${c.id}/estrategia`,
        tone: "info",
      })),
    },
    {
      key: "drafts",
      title: "Peças em rascunho",
      emptyText: "Nenhuma peça em rascunho.",
      items: draftsInProgress.map((p) => ({
        id: p.id,
        label: p.title,
        hint: p.kind,
        href: `/editor/${p.id}`,
        tone: "muted",
      })),
    },
    {
      key: "recent_cases",
      title: "Casos recentes",
      emptyText: "Crie seu primeiro caso para começar.",
      items: recentCases.map((c) => ({
        id: c.id,
        label: c.title,
        hint: `${c.status} · ${c._count.documents} doc(s) · ${c._count.facts} fato(s)`,
        href: `/cases/${c.id}`,
        tone: "ok",
      })),
    },
  ];

  return {
    groups,
    totals: {
      stalled: stalled.length,
      unlinked: unlinked.length,
      readyForFacts: readyForFacts.length,
      casesNeedingStrategy: casesNeedingStrategyCount,
      draftsInProgress: draftsInProgressCount,
    },
    baseAvailability: {
      cf: Boolean(cfNorm),
      adct: Boolean(adctNorm),
    },
  };
}
