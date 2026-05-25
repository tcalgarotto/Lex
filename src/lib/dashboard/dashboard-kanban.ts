import type { ResumeCaseRow } from "@/lib/dashboard/morning-briefing-data";

/** Colunas do quadro operacional (fluxo jurídico). */
export const DASHBOARD_KANBAN_COLUMN_IDS = [
  "briefing",
  "coleta",
  "documentos",
  "pesquisa",
  "estrategia",
  "peca",
  "revisao",
  "protocolo",
  "concluido",
] as const;

export type DashboardKanbanColumnId = (typeof DASHBOARD_KANBAN_COLUMN_IDS)[number];

export const DASHBOARD_KANBAN_COLUMNS: ReadonlyArray<{
  id: DashboardKanbanColumnId;
  label: string;
}> = [
  { id: "briefing", label: "Entrada / briefing" },
  { id: "coleta", label: "Coleta inicial" },
  { id: "documentos", label: "Aguardando documentos" },
  { id: "pesquisa", label: "Em pesquisa" },
  { id: "estrategia", label: "Estratégia" },
  { id: "peca", label: "Peça / minuta" },
  { id: "revisao", label: "Revisão" },
  { id: "protocolo", label: "Protocolo" },
  { id: "concluido", label: "Concluído" },
];

export type DashboardKanbanCard = {
  id: string;
  title: string;
  columnId: DashboardKanbanColumnId;
  progressPct: number;
  nextActionLabel: string;
  continueHref: string;
  badgeLabel: string;
  blocked?: boolean;
};

const BADGE_TO_COLUMN: Record<string, DashboardKanbanColumnId> = {
  "Coleta inicial": "coleta",
  "Aguardando documentos": "documentos",
  "Pesquisa JustOS AI": "pesquisa",
  Estratégia: "estrategia",
  Minuta: "peca",
  Revisão: "revisao",
  "Pronto para exportar": "protocolo",
};

export function badgeLabelToKanbanColumn(badge: string): DashboardKanbanColumnId {
  return BADGE_TO_COLUMN[badge] ?? "coleta";
}

export function readKanbanColumnOverride(metadataJson: unknown): DashboardKanbanColumnId | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const raw = (metadataJson as Record<string, unknown>)["dashboardKanbanColumn"];
  if (typeof raw !== "string") return null;
  return DASHBOARD_KANBAN_COLUMN_IDS.includes(raw as DashboardKanbanColumnId)
    ? (raw as DashboardKanbanColumnId)
    : null;
}

export function buildKanbanCardsFromResumeRows(rows: ResumeCaseRow[]): DashboardKanbanCard[] {
  const cards: DashboardKanbanCard[] = [];
  for (const row of rows) {
    if (row.kind === "unnamed_group") {
      cards.push({
        id: row.oldestCaseId,
        title: `${row.count} casos sem nome`,
        columnId: "briefing",
        progressPct: 8,
        nextActionLabel: "Definir nome e entrevista",
        continueHref: `/cases/${row.oldestCaseId}/entrevista`,
        badgeLabel: "Coleta inicial",
      });
      continue;
    }
    if (row.kind === "unnamed_single") {
      cards.push({
        id: row.id,
        title: "Caso sem nome",
        columnId: "briefing",
        progressPct: 10,
        nextActionLabel: row.nextActionLabel,
        continueHref: `/cases/${row.id}/entrevista`,
        badgeLabel: "Coleta inicial",
      });
      continue;
    }
    cards.push({
      id: row.id,
      title: row.title,
      columnId: badgeLabelToKanbanColumn(row.badgeLabel),
      progressPct: row.progressPct,
      nextActionLabel: row.nextActionLabel,
      continueHref: row.continueHref,
      badgeLabel: row.badgeLabel,
    });
  }
  return cards;
}

export function groupKanbanByColumn(
  cards: DashboardKanbanCard[],
): Record<DashboardKanbanColumnId, DashboardKanbanCard[]> {
  const out = Object.fromEntries(
    DASHBOARD_KANBAN_COLUMN_IDS.map((id) => [id, [] as DashboardKanbanCard[]]),
  ) as Record<DashboardKanbanColumnId, DashboardKanbanCard[]>;
  for (const card of cards) {
    const col = out[card.columnId] ?? out.coleta;
    col.push(card);
  }
  return out;
}
