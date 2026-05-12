/**
 * Briefing do dia — dados e copy para advogado (sem jargão técnico na UI).
 * Sem novos endpoints: só Postgres existente.
 */

import {
  CaseAlertKind,
  CaseAlertSeverity,
  CaseAlertStatus,
  CaseDraftStatus,
  CaseRiskSeverity,
  CaseStatus,
  DocumentStatus,
  DraftApprovalStatus,
  JobRunStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASE_STATUS_LABEL } from "@/lib/cases/labels";
import { findStalledDocuments } from "@/lib/documents/stalled";

export type MorningBriefingUrgent = {
  title: string;
  message: string;
  href: string;
  ctaLabel: string;
} | null;

/** Pulso — métricas agregadas + cartões detalhados (copy curada na UI). */
export type MorningBriefingPulse = {
  activeCases: number;
  casesNeedingNextStep: number;
  readyForReading: number;
  pendingReading: number;
  totalDocuments: number;
  draftsOpen: number;
  reviewsWaiting: number;
  storageHuman: string;
  storageBarPct: number;
  openHighRisks: number;
  failedProcessingCount: number;
  openDeadlines: number;
};

/** Cartão “Casos” — números reais + próxima ação sugerida */
export type PulseCasesDetail = {
  headline: string;
  breakdownLines: string[];
  nextActionTitle: string | null;
  nextHref: string | null;
  nextCtaLabel: string;
  barPct: number;
  barColor: string;
};

/** Cartão “Documentos” — evita contradição número grande vs subtítulo */
export type PulseDocumentsDetail = {
  headline: string;
  breakdownLines: string[];
  nextHref: string;
  nextCtaLabel: string;
  barPct: number;
  barColor: string;
};

/** Cartão “Peças / minutas” */
export type PulsePiecesDetail = {
  headline: string;
  breakdownLines: string[];
  emptyHint: string | null;
  nextHref: string;
  nextCtaLabel: string;
  barPct: number;
  barColor: string;
};

/** Cartão “Biblioteca” */
export type PulseLibraryDetail = {
  headline: string;
  breakdownLines: string[];
  nextHref: string;
  nextCtaLabel: string;
  barPct: number;
  barColor: string;
};

export type BriefingActionType = "caso" | "documento" | "peça" | "pesquisa" | "processo";

export type BriefingActionItem = {
  id: string;
  type: BriefingActionType;
  title: string;
  reason: string;
  cta: string;
  href: string;
  priority: "urgent" | "normal" | "low";
  /** Linha opcional de contexto (ex.: fase do caso) */
  statusHint?: string;
};

export type ResumeNamedCase = {
  kind: "named";
  id: string;
  title: string;
  statusLabel: string;
  progressPct: number;
  lastActivityLabel: string | null;
  badgeLabel: string;
  nextActionLabel: string;
  continueHref: string;
};

export type ResumeUnnamedSingle = {
  kind: "unnamed_single";
  id: string;
  createdLabel: string;
  nextActionLabel: string;
};

export type ResumeUnnamedGroup = {
  kind: "unnamed_group";
  count: number;
  oldestCaseId: string;
  createdLabel: string;
};

export type ResumeCaseRow = ResumeNamedCase | ResumeUnnamedSingle | ResumeUnnamedGroup;

export type BriefingActivityRow = {
  id: string;
  line: string;
  timeLabel: string;
};

export type BriefingDocPhase = {
  key: string;
  label: string;
  count: number;
  color: string;
  barPct: number;
};

export interface MorningBriefingPayload {
  displayName: string;
  /** Zero casos ativos — mostrar onboarding amigável */
  hasNoCases: boolean;
  /** Uma frase sobre o dia (dados reais) */
  daySummaryLine: string;
  /** Primeira prioridade para “Continuar prioridade” (sempre uma rota válida) */
  priorityContinueHref: string;
  pulse: MorningBriefingPulse;
  pulseCases: PulseCasesDetail;
  pulseDocuments: PulseDocumentsDetail;
  pulsePieces: PulsePiecesDetail;
  pulseLibrary: PulseLibraryDetail;
  urgent: MorningBriefingUrgent;
  /** Ações reais (máx. 5) */
  briefingActions: BriefingActionItem[];
  /** True só se não houver ações nem urgências operacionais relevantes */
  genuinelyAllClear: boolean;
  resumeCases: ResumeCaseRow[];
  activities: BriefingActivityRow[];
  docPhases: BriefingDocPhase[];
  piecesThisMonth: number;
  copilotMessage: string;
  copilotTitle: string;
  /** Primeiro caso sem nome (mais antigo) para CTA do hero */
  oldestUnnamedCaseId: string | null;
}

function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
}

function isCaseUnnamed(title: string): boolean {
  const t = title.trim();
  return t.length === 0 || t.startsWith("Novo caso");
}

function readStrategyPresent(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const m = metadataJson as { strategy?: unknown };
  const s = m.strategy;
  if (!s || typeof s !== "object") return false;
  const thesis = (s as { thesis?: unknown }).thesis;
  return typeof thesis === "string" && thesis.length > 0;
}

type CaseBriefRow = {
  id: string;
  title: string;
  status: CaseStatus;
  processNumber: string | null;
  processId: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count: { facts: number; documents: number; drafts: number };
};

function extractPriorityCaseTitle(title: string): string {
  const parts = title.split(" — ");
  return parts.length >= 2 ? parts.slice(1).join(" — ").trim() : title.trim();
}

/** Próximo passo sugerido para linha “Casos para retomar” (rotas existentes). */
function nextStepForCase(c: CaseBriefRow): { label: string; href: string } {
  if (isCaseUnnamed(c.title)) {
    return { label: "Responder entrevista guiada e definir nome", href: `/cases/${c.id}/entrevista` };
  }
  if (c._count.documents === 0) {
    return { label: "Enviar documentos ao caso", href: `/cases/${c.id}/documentos` };
  }
  if (c._count.facts > 0 && !readStrategyPresent(c.metadataJson)) {
    return { label: "Consolidar estratégia no caso", href: `/cases/${c.id}/estrategia` };
  }
  const missingProcess =
    !String(c.processNumber ?? "").trim() && !c.processId && c.status !== CaseStatus.INTAKE;
  if (missingProcess) {
    return { label: "Associar número do processo", href: `/cases/${c.id}` };
  }
  return { label: "Continuar caso", href: `/cases/${c.id}` };
}

function caseInPiecePhase(c: CaseBriefRow): boolean {
  if (isCaseUnnamed(c.title)) return false;
  if (!readStrategyPresent(c.metadataJson)) return false;
  if (c._count.documents === 0 || c._count.facts === 0) return false;
  return (
    c.status === CaseStatus.DRAFTING ||
    c.status === CaseStatus.REVIEW ||
    c.status === CaseStatus.READY ||
    c.status === CaseStatus.FILED
  );
}

function buildDaySummaryLine(args: { coletaCount: number; docsAwaiting: number; activeCases: number }): string {
  const parts: string[] = [];
  if (args.coletaCount > 0) {
    parts.push(`${args.coletaCount} caso${args.coletaCount > 1 ? "s" : ""} em coleta inicial`);
  }
  if (args.docsAwaiting > 0) {
    parts.push(`${args.docsAwaiting} documento${args.docsAwaiting > 1 ? "s" : ""} aguardando leitura`);
  }
  if (parts.length === 0) {
    if (args.activeCases === 0) return "Comece criando um caso ou enviando um documento.";
    return "Nada urgente na fila — pode revisar casos ou avançar uma peça.";
  }
  return `Hoje há ${parts.join(" e ")}.`;
}

function buildCopilotNarrative(args: {
  reviewsWaiting: number;
  stalledCount: number;
  unnamedCount: number;
  noDocNamedCount: number;
  coletaCount: number;
  strategyGapCount: number;
  topPriorityTitle: string | null;
}): string {
  const parts: string[] = [];
  if (args.coletaCount > 0) {
    parts.push(`Tem ${args.coletaCount} caso${args.coletaCount > 1 ? "s" : ""} em coleta inicial.`);
  }

  let bottleneck: string | null = null;
  if (args.reviewsWaiting > 0) bottleneck = "revisão de minuta pendente";
  else if (args.stalledCount > 0) bottleneck = "documentos que demoram mais que o habitual na leitura";
  else if (args.unnamedCount > 0 || args.noDocNamedCount > 0) bottleneck = "entrevista incompleta ou documentos em falta";
  else if (args.strategyGapCount > 0) bottleneck = "estratégia a consolidar nos casos que já têm fatos";

  if (bottleneck) {
    parts.push(`O maior foco agora é ${bottleneck}.`);
  }

  if (args.topPriorityTitle) {
    parts.push(`Priorize avançar em “${args.topPriorityTitle}” para destravar pesquisa e peças.`);
  } else if (parts.length === 0) {
    return "Os seus casos estão encaminhados. Pode iniciar uma pesquisa jurídica ou abrir um novo caso.";
  }

  return parts.join(" ");
}

function caseProgressPct(input: {
  status: CaseStatus;
  factCount: number;
  docCount: number;
  draftCount: number;
}): number {
  const base: Record<CaseStatus, number> = {
    [CaseStatus.INTAKE]: 12,
    [CaseStatus.RESEARCH]: 28,
    [CaseStatus.DRAFTING]: 52,
    [CaseStatus.REVIEW]: 72,
    [CaseStatus.READY]: 88,
    [CaseStatus.FILED]: 100,
    [CaseStatus.CLOSED]: 100,
    [CaseStatus.ARCHIVED]: 100,
  };
  let p = base[input.status];
  p += Math.min(10, input.factCount * 1.2);
  p += Math.min(12, input.docCount * 3);
  if (input.draftCount > 0) p += 6;
  return Math.min(100, Math.round(p));
}

function statusLabelUser(status: CaseStatus): string {
  return CASE_STATUS_LABEL[status] ?? "Em andamento";
}

function badgeForCase(status: CaseStatus, hasStrategy: boolean): string {
  if (status === CaseStatus.INTAKE) return "Coleta inicial";
  if (status === CaseStatus.RESEARCH && !hasStrategy) return "Pesquisa";
  if (status === CaseStatus.DRAFTING || status === CaseStatus.REVIEW) return "Elaboração";
  if (status === CaseStatus.READY) return "Revisão final";
  return statusLabelUser(status);
}

const SEVERITY_ORDER: Record<CaseAlertSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const ACTIVITY_PUBLIC: Record<string, string> = {
  "onboarding.completed": "Entrevista inicial concluída",
  "case.created": "Caso criado",
  "case.updated": "Caso atualizado",
  "document.uploaded": "Documento enviado",
  "case.document.upload": "Documento enviado ao caso",
  "document.indexed": "Documento pronto para leitura",
  "document.failed": "Documento com problema",
  "document.reprocess": "Documento reenviado para leitura",
  "document.deleted": "Documento removido",
  "document.linked_to_case": "Documento associado a um caso",
  "document.unlinked_from_case": "Documento desassociado do caso",
  "case.document.retry": "Documento reprocessado",
  "case.document.suggest": "Sugestão de vínculo de documento",
  "facts.extracted": "Fatos e partes identificados",
  "strategy.generated": "Estratégia gerada",
  "case.fact.create": "Fato registado",
  "case.fact.update": "Fato atualizado",
  "case.fact.delete": "Fato removido",
  "case.party.create": "Parte adicionada",
  "case.party.update": "Parte atualizada",
  "case.party.delete": "Parte removida",
  "case.claim.create": "Pedido registado",
  "case.claim.update": "Pedido atualizado",
  "case.claim.delete": "Pedido removido",
  "case.request.create": "Pedido registado",
  "case.request.update": "Pedido atualizado",
  "case.request.delete": "Pedido removido",
  "case.risk.create": "Risco assinalado",
  "case.risk.update": "Risco atualizado",
  "case.risk.delete": "Risco removido",
  "case.deleted": "Caso removido",
  "case.pinned_foundation": "Fundamento fixado",
  "process.created": "Processo vinculado",
  "team.member.added": "Novo membro no escritório",
  "team.role.changed": "Permissão de membro atualizada",
  "team.member.removed": "Membro removido do escritório",
  "team.invite.sent": "Convite enviado",
  "team.invite.revoked": "Convite revogado",
  "piece.generated": "Minuta criada",
  "draft.created": "Minuta criada",
  "draft.reviewed": "Minuta revisada",
  "chat.message": "Mensagem no chat",
  "feedback.submitted": "Feedback enviado",
};

function briefingCountMap(rows: { caseId: string | null; _count: { _all: number } }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.caseId != null) m.set(r.caseId, r._count._all);
  }
  return m;
}

/** Casos ativos do briefing com contagens em lote (evita `_count` correlacionado por linha). */
async function loadBriefingCaseList(activeCaseWhere: Prisma.CaseWhereInput) {
  const rows = await prisma.case.findMany({
    where: activeCaseWhere,
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      status: true,
      processNumber: true,
      processId: true,
      metadataJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [factGs, docGs, draftGs] = await Promise.all([
    prisma.caseFact.groupBy({
      by: ["caseId"],
      where: { caseId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ["caseId"],
      where: { caseId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.caseDraft.groupBy({
      by: ["caseId"],
      where: { caseId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const mf = briefingCountMap(factGs);
  const md = briefingCountMap(docGs);
  const mr = briefingCountMap(draftGs);
  return rows.map((r) => ({
    ...r,
    _count: {
      facts: mf.get(r.id) ?? 0,
      documents: md.get(r.id) ?? 0,
      drafts: mr.get(r.id) ?? 0,
    },
  }));
}

function activityPublicLine(kind: string, title: string): string | null {
  const mapped = ACTIVITY_PUBLIC[kind];
  if (mapped) return mapped;
  if (!kind.includes(".")) return title.length > 0 ? title : null;
  return null;
}

export type MorningBriefingRequestArgs = {
  workspaceId: string;
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  displayNameHint?: string | null;
};

export function activeCaseWhereFor(workspaceId: string): Prisma.CaseWhereInput {
  return {
    workspaceId,
    deletedAt: null,
    archivedAt: null,
    status: { notIn: [CaseStatus.CLOSED, CaseStatus.ARCHIVED] as CaseStatus[] },
  };
}

/** Agregados leves (sem lista de casos nem alertas/atividades/travados). */
export async function fetchMorningBriefingAggRows(
  args: MorningBriefingRequestArgs,
  activeCaseWhere: Prisma.CaseWhereInput,
) {
  const { workspaceId, userId, displayNameHint } = args;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const unnamedTitleOr: Prisma.CaseWhereInput[] = [
    { title: "" },
    { title: { startsWith: "Novo caso", mode: "insensitive" } },
  ];

  const [
    dbUser,
    activeCases,
    docByStatus,
    storageAgg,
    draftsOpen,
    piecesMonth,
    pendingApprovals,
    approvalCaseLink,
    openHighRisks,
    failedJobs7d,
    openDeadlines,
    draftsApprovedCount,
    libraryStats,
    coletaApproxCount,
    oldestUnnamedBare,
  ] = await Promise.all([
    displayNameHint?.trim()
      ? Promise.resolve(null)
      : prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.case.count({ where: activeCaseWhere }),
    prisma.document.groupBy({
      by: ["status"],
      where: { workspaceId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.document.aggregate({
      where: { workspaceId, deletedAt: null },
      _sum: { sizeBytes: true },
    }),
    prisma.caseDraft.count({
      where: {
        status: { in: [CaseDraftStatus.PENDING, CaseDraftStatus.GENERATED, CaseDraftStatus.EDITED] },
        case: { workspaceId, deletedAt: null },
      },
    }),
    prisma.legalPiece.count({
      where: { workspaceId, deletedAt: null, archivedAt: null, createdAt: { gte: monthStart } },
    }),
    prisma.draftApproval.count({
      where: {
        status: DraftApprovalStatus.REQUESTED,
        case: { workspaceId, deletedAt: null },
      },
    }),
    prisma.draftApproval.findFirst({
      where: {
        status: DraftApprovalStatus.REQUESTED,
        case: { workspaceId, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      select: { caseId: true },
    }),
    prisma.caseRisk.count({
      where: {
        resolvedAt: null,
        severity: { in: [CaseRiskSeverity.HIGH, CaseRiskSeverity.CRITICAL] },
        case: { workspaceId, deletedAt: null, archivedAt: null },
      },
    }),
    prisma.jobRun.count({
      where: {
        workspaceId,
        status: JobRunStatus.FAILED,
        updatedAt: { gte: since7d },
      },
    }),
    prisma.caseAlert.count({
      where: {
        workspaceId,
        status: CaseAlertStatus.OPEN,
        kind: CaseAlertKind.DEADLINE,
      },
    }),
    prisma.caseDraft.count({
      where: {
        status: CaseDraftStatus.APPROVED,
        case: { workspaceId, deletedAt: null },
      },
    }),
    prisma.libraryFoundation
      .groupBy({
        by: ["useAsModel"],
        where: { workspaceId, deletedAt: null, archivedAt: null },
        _count: { _all: true },
      })
      .then((libGroup) => {
        let libraryFoundationTotal = 0;
        let libraryModelsCount = 0;
        for (const g of libGroup) {
          libraryFoundationTotal += g._count._all;
          if (g.useAsModel === true) libraryModelsCount += g._count._all;
        }
        return { libraryFoundationTotal, libraryModelsCount };
      }),
    prisma.case.count({
      where: {
        ...activeCaseWhere,
        OR: [{ status: CaseStatus.INTAKE }, ...unnamedTitleOr],
      },
    }),
    prisma.case.findFirst({
      where: { ...activeCaseWhere, OR: unnamedTitleOr },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  return {
    dbUser,
    activeCases,
    docByStatus,
    storageAgg,
    draftsOpen,
    piecesMonth,
    pendingApprovals,
    approvalCaseLink,
    openHighRisks,
    failedJobs7d,
    openDeadlines,
    draftsApprovedCount,
    libraryStats,
    coletaApproxCount,
    oldestUnnamedBare,
  };
}

export async function fetchMorningBriefingHeavyRows(activeCaseWhere: Prisma.CaseWhereInput, workspaceId: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [caseList, alerts, activities, stalledDocs] = await Promise.all([
    loadBriefingCaseList(activeCaseWhere),
    prisma.caseAlert.findMany({
      where: {
        workspaceId,
        status: CaseAlertStatus.OPEN,
        OR: [
          { kind: CaseAlertKind.DEADLINE },
          { severity: { in: [CaseAlertSeverity.HIGH, CaseAlertSeverity.CRITICAL] } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        severity: true,
        caseId: true,
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.activity.findMany({
      where: { workspaceId, createdAt: { gte: since24h } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, kind: true, createdAt: true },
    }),
    findStalledDocuments(workspaceId, { take: 5 }),
  ]);
  return { caseList, alerts, activities, stalledDocs };
}

export type MorningBriefingShellProps = {
  displayName: string;
  hasNoCases: boolean;
  daySummaryLine: string;
  priorityContinueHref: string;
  oldestUnnamedCaseId: string | null;
};

/** Props do hero/CTA a partir só dos agregados (rápido). */
export function mapMorningBriefingAggToShellProps(
  args: MorningBriefingRequestArgs,
  agg: Awaited<ReturnType<typeof fetchMorningBriefingAggRows>>,
): MorningBriefingShellProps {
  const { userEmail, displayNameHint } = args;
  const { dbUser, activeCases, docByStatus, coletaApproxCount, oldestUnnamedBare } = agg;
  const statusMap = new Map(docByStatus.map((g) => [g.status, g._count._all]));
  const n = (s: DocumentStatus) => statusMap.get(s) ?? 0;
  const received = n(DocumentStatus.UPLOADED);
  const inAnalysis = n(DocumentStatus.PARSING) + n(DocumentStatus.CHUNKING) + n(DocumentStatus.EMBEDDING);
  const pendingReadingCount = received + inAnalysis;

  const displayName =
    displayNameHint?.trim()?.split(/\s+/)[0] ??
    dbUser?.name?.trim()?.split(/\s+/)[0] ??
    dbUser?.email?.split("@")[0] ??
    userEmail.split("@")[0] ??
    "Dr.";

  const daySummaryLine = buildDaySummaryLine({
    coletaCount: coletaApproxCount,
    docsAwaiting: pendingReadingCount,
    activeCases,
  });

  const oldestUnnamedCaseId = oldestUnnamedBare?.id ?? null;
  const priorityContinueHref =
    oldestUnnamedCaseId != null
      ? `/cases/${oldestUnnamedCaseId}/entrevista`
      : activeCases > 0
        ? "/cases"
        : "/cases/new";

  return {
    displayName,
    hasNoCases: activeCases === 0,
    daySummaryLine,
    priorityContinueHref,
    oldestUnnamedCaseId,
  };
}

function buildMorningBriefingPayloadFromParts(
  args: MorningBriefingRequestArgs,
  agg: Awaited<ReturnType<typeof fetchMorningBriefingAggRows>>,
  heavy: Awaited<ReturnType<typeof fetchMorningBriefingHeavyRows>>,
): MorningBriefingPayload {
  const { workspaceId, userEmail, isAdmin, displayNameHint } = args;
  const {
    dbUser,
    activeCases,
    docByStatus,
    storageAgg,
    draftsOpen,
    piecesMonth,
    pendingApprovals,
    approvalCaseLink,
    openHighRisks,
    failedJobs7d,
    openDeadlines,
    draftsApprovedCount,
    libraryStats,
  } = agg;
  const { caseList, alerts, activities, stalledDocs } = heavy;

  const { libraryFoundationTotal, libraryModelsCount } = libraryStats;

  const statusMap = new Map(docByStatus.map((g) => [g.status, g._count._all]));
  const n = (s: DocumentStatus) => statusMap.get(s) ?? 0;
  const received = n(DocumentStatus.UPLOADED);
  const inAnalysis = n(DocumentStatus.PARSING) + n(DocumentStatus.CHUNKING) + n(DocumentStatus.EMBEDDING);
  const ready = n(DocumentStatus.INDEXED);
  const failed = n(DocumentStatus.FAILED);
  const totalDocuments = received + inAnalysis + ready + failed;

  const storageBytes = storageAgg._sum.sizeBytes ?? 0;
  const storageHuman = bytesToHuman(storageBytes);
  const storageBarPct = Math.min(100, Math.round((storageBytes / (1024 * 1024 * 500)) * 100));

  const unnamedCases = caseList.filter((c) => isCaseUnnamed(c.title));
  const namedCases = caseList.filter((c) => !isCaseUnnamed(c.title));
  const noDocCases = caseList.filter((c) => c._count.documents === 0);
  const casesNeedingStrategy = caseList.filter(
    (c) =>
      c._count.facts > 0 &&
      c._count.drafts === 0 &&
      !readStrategyPresent(c.metadataJson) &&
      !isCaseUnnamed(c.title),
  );
  const casesMissingCnj = caseList.filter(
    (c) =>
      !c.processNumber?.trim() &&
      !c.processId &&
      c.status !== CaseStatus.INTAKE &&
      !isCaseUnnamed(c.title),
  );

  const countSet = new Set<string>();
  for (const c of caseList) {
    if (isCaseUnnamed(c.title)) countSet.add(c.id);
    else if (c._count.documents === 0) countSet.add(c.id);
    else if (c._count.facts > 0 && c._count.drafts === 0 && !readStrategyPresent(c.metadataJson)) countSet.add(c.id);
    else if (!c.processNumber?.trim() && !c.processId && c.status !== CaseStatus.INTAKE) countSet.add(c.id);
  }
  const casesNeedingNextStep = countSet.size;

  const phaseTotal = Math.max(1, received + inAnalysis + ready + failed);
  const docPhases: BriefingDocPhase[] = [
    { key: "rec", label: "Recebidos", count: received, color: "var(--brand-primary)", barPct: Math.round((received / phaseTotal) * 100) },
    { key: "ana", label: "Em análise", count: inAnalysis, color: "var(--info-text)", barPct: Math.round((inAnalysis / phaseTotal) * 100) },
    { key: "ok", label: "Prontos", count: ready, color: "var(--success-text)", barPct: Math.round((ready / phaseTotal) * 100) },
    { key: "bad", label: "Com problema", count: failed, color: "var(--warning-text)", barPct: Math.round((failed / phaseTotal) * 100) },
  ];

  const pulse: MorningBriefingPulse = {
    activeCases,
    casesNeedingNextStep,
    readyForReading: ready,
    pendingReading: received + inAnalysis,
    totalDocuments,
    draftsOpen,
    reviewsWaiting: pendingApprovals,
    storageHuman,
    storageBarPct: storageBarPct,
    openHighRisks,
    failedProcessingCount: failed,
    openDeadlines,
  };

  const sortedAlerts = [...alerts].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  let urgent: MorningBriefingUrgent = null;
  const top = sortedAlerts[0];
  if (top) {
    const href = top.caseId ? `/cases/${top.caseId}` : "/cases";
    urgent = {
      title: top.title,
      message: top.message.replace(/\s+/g, " ").trim().slice(0, 220),
      href,
      ctaLabel: top.case ? "Abrir caso" : "Ver casos",
    };
  } else if (isAdmin && failedJobs7d > 0) {
    urgent = {
      title: "Tarefas automáticas com falha",
      message: `Nos últimos dias houve ${failedJobs7d} falha(s) em tarefas em segundo plano. A equipa técnica deve rever.`,
      href: "/settings/jobs",
      ctaLabel: "Abrir fila",
    };
  } else if (pendingApprovals > 0) {
    const apprHref = approvalCaseLink?.caseId
      ? `/cases/${approvalCaseLink.caseId}/estrategia`
      : "/cases";
    urgent = {
      title: "Revisão de minuta pendente",
      message: `Existem ${pendingApprovals} pedido(s) de revisão de minuta aguardando a sua decisão.`,
      href: apprHref,
      ctaLabel: "Revisar minuta",
    };
  }

  const briefingActions: BriefingActionItem[] = [];
  const push = (a: BriefingActionItem) => {
    if (briefingActions.length >= 5) return;
    briefingActions.push(a);
  };

  if (pendingApprovals > 0) {
    const c =
      (approvalCaseLink?.caseId ? caseList.find((x) => x.id === approvalCaseLink.caseId) : null) ??
      caseList.find((x) => x._count.drafts > 0) ??
      caseList[0];
    push({
      id: `approval-${workspaceId}`,
      type: "peça",
      title: c ? `Revisar minuta — ${isCaseUnnamed(c.title) ? "caso em coleta" : c.title}` : "Revisar minuta",
      reason: "Há um pedido de conferência antes de seguir com a peça.",
      cta: "Revisar minuta",
      href: c ? `/cases/${c.id}/estrategia` : "/cases",
      priority: "urgent",
      statusHint: c ? `Peça · ${statusLabelUser(c.status)}` : undefined,
    });
  }

  for (const d of stalledDocs) {
    push({
      id: `stalled-${d.id}`,
      type: "documento",
      title: `Documento em espera — ${d.originalName}`,
      reason: "A leitura automática está a demorar mais do que o habitual.",
      cta: "Ver documento",
      href: "/documentos",
      priority: "urgent",
    });
  }

  if (unnamedCases.length > 0) {
    const oldest = [...unnamedCases].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]!;
    push({
      id: `unnamed-group`,
      type: "caso",
      title:
        unnamedCases.length > 1
          ? `${unnamedCases.length} casos aguardam nome e entrevista`
          : "Caso aguarda nome e entrevista",
      reason: "Sem nome confirmado fica difícil priorizar e partilhar o caso com a equipa.",
      cta: "Continuar entrevista",
      href: `/cases/${oldest.id}/entrevista`,
      priority: unnamedCases.length === 1 ? "urgent" : "normal",
      statusHint: "Coleta inicial",
    });
  }

  for (const c of noDocCases) {
    if (isCaseUnnamed(c.title)) continue;
    push({
      id: `nodoc-${c.id}`,
      type: "caso",
      title: `Enviar documentos — ${c.title}`,
      reason: "Sem documentos não é possível extrair fatos nem preparar peças com segurança.",
      cta: "Enviar documento",
      href: `/cases/${c.id}/documentos`,
      priority: "normal",
      statusHint: `${statusLabelUser(c.status)} · sem documentos vinculados`,
    });
  }

  for (const c of casesNeedingStrategy) {
    push({
      id: `strat-${c.id}`,
      type: "caso",
      title: `Gerar estratégia — ${c.title}`,
      reason: "Já há fatos e partes identificados. O passo seguinte é consolidar a estratégia processual.",
      cta: "Gerar estratégia",
      href: `/cases/${c.id}/estrategia`,
      priority: "normal",
    });
  }

  for (const c of casesMissingCnj) {
    push({
      id: `cnj-${c.id}`,
      type: "processo",
      title: `Associar processo — ${c.title}`,
      reason: "Quando existir número CNJ, fica mais fácil acompanhar prazos e movimentações.",
      cta: "Abrir caso",
      href: `/cases/${c.id}`,
      priority: "low",
    });
  }

  const genuinelyAllClear =
    briefingActions.length === 0 &&
    !urgent &&
    stalledDocs.length === 0 &&
    unnamedCases.length === 0 &&
    noDocCases.filter((c) => !isCaseUnnamed(c.title)).length === 0 &&
    casesNeedingStrategy.length === 0 &&
    casesMissingCnj.length === 0 &&
    pendingApprovals === 0 &&
    openDeadlines === 0;

  const pendingReadingCount = received + inAnalysis;
  const docReadyPct = totalDocuments > 0 ? Math.round((ready / totalDocuments) * 100) : 0;
  const casesBarPctDetail =
    activeCases > 0 ? Math.min(100, Math.round((casesNeedingNextStep / activeCases) * 100)) : 0;

  const coletaCount = new Set(
    caseList.filter((c) => c.status === CaseStatus.INTAKE || isCaseUnnamed(c.title)).map((c) => c.id),
  ).size;
  const namedNoDocsCount = namedCases.filter((c) => c._count.documents === 0).length;
  const needInterviewCount = unnamedCases.length;
  const readyPieceTrackCount = caseList.filter(caseInPiecePhase).length;

  const oldestUnnamedFirst =
    unnamedCases.length > 0
      ? [...unnamedCases].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]!
      : null;

  const topPriorityTitle = briefingActions[0] ? extractPriorityCaseTitle(briefingActions[0].title) : null;

  const pulseCases: PulseCasesDetail = {
    headline: `${activeCases} casos em andamento`,
    breakdownLines: [
      `${needInterviewCount} precisam de entrevista ou nome`,
      `${namedNoDocsCount} sem documento`,
      `${readyPieceTrackCount} em fase de elaboração de peça`,
    ],
    nextActionTitle:
      briefingActions[0]?.title ??
      (oldestUnnamedFirst
        ? `Continuar entrevista — criado em ${oldestUnnamedFirst.createdAt.toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "short",
          })}`
        : null),
    nextHref:
      briefingActions[0]?.href ??
      (oldestUnnamedFirst ? `/cases/${oldestUnnamedFirst.id}/entrevista` : activeCases > 0 ? "/cases" : "/cases/new"),
    nextCtaLabel:
      briefingActions[0]?.cta ??
      (oldestUnnamedFirst ? "Continuar entrevista" : activeCases > 0 ? "Ver casos" : "Novo caso"),
    barPct: casesBarPctDetail,
    barColor: casesNeedingNextStep > 0 ? "var(--brand-primary)" : "var(--success-text)",
  };

  const pulseDocuments: PulseDocumentsDetail = {
    headline:
      totalDocuments === 0
        ? "Nenhum documento no escritório"
        : `${totalDocuments} documento${totalDocuments === 1 ? "" : "s"} no escritório`,
    breakdownLines: [
      `${ready} prontos para leitura`,
      `${pendingReadingCount} aguardam leitura`,
      `${failed} com problema`,
    ],
    nextHref: "/documentos",
    nextCtaLabel:
      failed > 0 ? "Ver documentos com problema" : pendingReadingCount > 0 ? "Analisar documentos" : "Ver documentos",
    barPct: docReadyPct,
    barColor: pendingReadingCount > 0 ? "var(--warning-text)" : "var(--success-text)",
  };

  const pulsePieces: PulsePiecesDetail = {
    headline:
      draftsOpen === 0 && pendingApprovals === 0
        ? "Nenhuma minuta em elaboração"
        : `${draftsOpen} minuta${draftsOpen === 1 ? "" : "s"} em elaboração`,
    breakdownLines: [
      `${pendingApprovals} aguardam revisão`,
      `${draftsApprovedCount} prontas para rever ou exportar`,
    ],
    emptyHint:
      draftsOpen === 0 && pendingApprovals === 0 && draftsApprovedCount === 0
        ? "Para gerar uma minuta, entre num caso, fixe fundamentos na pesquisa jurídica e use Gerar peça na estratégia."
        : null,
    nextHref:
      pendingApprovals > 0 && approvalCaseLink?.caseId
        ? `/cases/${approvalCaseLink.caseId}/estrategia`
        : "/editor",
    nextCtaLabel: pendingApprovals > 0 ? "Revisar minuta" : "Criar peça",
    barPct: Math.min(100, draftsOpen * 14 + pendingApprovals * 20 + 8),
    barColor: pendingApprovals > 0 ? "var(--warning-text)" : "var(--text-muted)",
  };

  const pulseLibrary: PulseLibraryDetail = {
    headline: "Biblioteca do escritório",
    breakdownLines: [
      `${storageHuman} armazenados`,
      `${totalDocuments} documento${totalDocuments === 1 ? "" : "s"} carregados`,
      `${libraryModelsCount} modelo${libraryModelsCount === 1 ? "" : "s"} próprio${libraryModelsCount === 1 ? "" : "s"}`,
      `${libraryFoundationTotal} fundamento${libraryFoundationTotal === 1 ? "" : "s"} na biblioteca`,
    ],
    nextHref: "/biblioteca",
    nextCtaLabel: "Abrir biblioteca",
    barPct: storageBarPct,
    barColor: "var(--text-muted)",
  };

  const daySummaryLine = buildDaySummaryLine({
    coletaCount,
    docsAwaiting: pendingReadingCount,
    activeCases,
  });

  const priorityContinueHref =
    briefingActions[0]?.href ??
    (oldestUnnamedFirst ? `/cases/${oldestUnnamedFirst.id}/entrevista` : activeCases > 0 ? "/cases" : "/cases/new");

  const resumeCases: ResumeCaseRow[] = [];
  const unnamedSorted = [...unnamedCases].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const maxUnnamedRows = 3;
  for (let i = 0; i < Math.min(maxUnnamedRows, unnamedSorted.length); i++) {
    const u = unnamedSorted[i]!;
    resumeCases.push({
      kind: "unnamed_single",
      id: u.id,
      createdLabel: u.createdAt.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      nextActionLabel: "Responder entrevista guiada e definir nome",
    });
  }
  if (unnamedSorted.length > maxUnnamedRows) {
    const rest = unnamedSorted.slice(maxUnnamedRows);
    resumeCases.push({
      kind: "unnamed_group",
      count: rest.length,
      oldestCaseId: rest[0]!.id,
      createdLabel: "",
    });
  }

  const namedSlots = Math.max(0, 8 - resumeCases.length);
  for (const c of namedCases.slice(0, namedSlots)) {
    const hasStrategy = readStrategyPresent(c.metadataJson);
    const ns = nextStepForCase(c);
    resumeCases.push({
      kind: "named",
      id: c.id,
      title: c.title,
      statusLabel: statusLabelUser(c.status),
      progressPct: caseProgressPct({
        status: c.status,
        factCount: c._count.facts,
        docCount: c._count.documents,
        draftCount: c._count.drafts,
      }),
      lastActivityLabel:
        Date.now() - c.updatedAt.getTime() < 48 * 3600 * 1000
          ? "Atualizado recentemente"
          : `Atualizado há ${Math.max(1, Math.round((Date.now() - c.updatedAt.getTime()) / 86400000))} dia(s)`,
      badgeLabel: badgeForCase(c.status, hasStrategy),
      nextActionLabel: ns.label,
      continueHref: ns.href,
    });
  }

  const activityRows: BriefingActivityRow[] = [];
  for (const a of activities) {
    const line = activityPublicLine(a.kind, a.title);
    if (!line) continue;
    activityRows.push({
      id: a.id,
      line,
      timeLabel: formatActivityTime(a.createdAt),
    });
    if (activityRows.length >= 5) break;
  }

  const copilotMessage = buildCopilotNarrative({
    reviewsWaiting: pendingApprovals,
    stalledCount: stalledDocs.length,
    unnamedCount: unnamedCases.length,
    noDocNamedCount: noDocCases.filter((c) => !isCaseUnnamed(c.title)).length,
    coletaCount,
    strategyGapCount: casesNeedingStrategy.length,
    topPriorityTitle,
  });

  const displayName =
    displayNameHint?.trim()?.split(/\s+/)[0] ??
    dbUser?.name?.trim()?.split(/\s+/)[0] ??
    dbUser?.email?.split("@")[0] ??
    userEmail.split("@")[0] ??
    "Dr.";

  const oldestUnnamedCaseId = oldestUnnamedFirst?.id ?? null;

  return {
    displayName,
    hasNoCases: activeCases === 0,
    daySummaryLine,
    priorityContinueHref,
    pulse,
    pulseCases,
    pulseDocuments,
    pulsePieces,
    pulseLibrary,
    urgent,
    briefingActions,
    genuinelyAllClear,
    resumeCases,
    activities: activityRows,
    docPhases,
    piecesThisMonth: piecesMonth,
    copilotMessage,
    copilotTitle: "Resumo do dia",
    oldestUnnamedCaseId,
  };
}

export async function getMorningBriefingData(args: MorningBriefingRequestArgs): Promise<MorningBriefingPayload> {
  const activeCaseWhere = activeCaseWhereFor(args.workspaceId);
  const [agg, heavy] = await Promise.all([
    fetchMorningBriefingAggRows(args, activeCaseWhere),
    fetchMorningBriefingHeavyRows(activeCaseWhere, args.workspaceId),
  ]);
  return buildMorningBriefingPayloadFromParts(args, agg, heavy);
}

/** Só a parte pesada (lista de casos, alertas, atividades, travados) — usar com `agg` já carregado no shell. */
export async function loadMorningBriefingDeferredPayload(
  args: MorningBriefingRequestArgs,
  agg: Awaited<ReturnType<typeof fetchMorningBriefingAggRows>>,
): Promise<MorningBriefingPayload> {
  const activeCaseWhere = activeCaseWhereFor(args.workspaceId);
  const heavy = await fetchMorningBriefingHeavyRows(activeCaseWhere, args.workspaceId);
  return buildMorningBriefingPayloadFromParts(args, agg, heavy);
}

function formatActivityTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "há poucos minutos";
  if (h < 24) return `há ${h} hora(s)`;
  const days = Math.floor(h / 24);
  return `há ${days} dia(s)`;
}
