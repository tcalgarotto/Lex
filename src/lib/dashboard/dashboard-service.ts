import { MembershipRole } from "@prisma/client";
import { hasAtLeast } from "@/lib/auth/permissions";
import {
  activeCaseWhereFor,
  fetchMorningBriefingAggRows,
  lawyerHonorificFromMetadata,
  loadMorningBriefingDeferredPayload,
  mapMorningBriefingAggToShellProps,
  type BriefingActionItem,
  type MorningBriefingRequestArgs,
} from "@/lib/dashboard/morning-briefing-data";
import { prisma } from "@/lib/prisma";
import {
  buildKanbanCardsFromResumeRows,
  groupKanbanByColumn,
  readKanbanColumnOverride,
  type DashboardKanbanCard,
  type DashboardKanbanColumnId,
} from "@/lib/dashboard/dashboard-kanban";

export type DashboardMetric = {
  id: string;
  label: string;
  value: number | string;
  hint?: string;
};

export type DashboardViewModel = {
  displayName: string;
  honorific: ReturnType<typeof lawyerHonorificFromMetadata>;
  hasNoCases: boolean;
  metrics: DashboardMetric[];
  nowActions: BriefingActionItem[];
  nowActionsOverflow: number;
  kanbanByColumn: Record<DashboardKanbanColumnId, DashboardKanbanCard[]>;
  activities: { id: string; line: string; timeLabel: string }[];
  copilotMessage: string;
  copilotTitle: string;
  urgent: {
    title: string;
    message: string;
    href: string;
    ctaLabel: string;
  } | null;
};

function displayNameHintFromUserMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  for (const key of ["full_name", "name", "given_name"] as const) {
    const v = m[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

export async function getDashboardViewModel(input: {
  workspaceId: string;
  userId: string;
  userEmail: string;
  userMetadata: unknown;
  role: MembershipRole | null;
}): Promise<DashboardViewModel> {
  const briefingArgs: MorningBriefingRequestArgs = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    userEmail: input.userEmail,
    isAdmin: input.role != null && hasAtLeast(input.role, MembershipRole.ADMIN),
    displayNameHint: displayNameHintFromUserMetadata(input.userMetadata),
    honorific: lawyerHonorificFromMetadata(input.userMetadata),
  };

  const agg = await fetchMorningBriefingAggRows(briefingArgs, activeCaseWhereFor(input.workspaceId));
  const [shell, payload] = await Promise.all([
    Promise.resolve(mapMorningBriefingAggToShellProps(briefingArgs, agg)),
    loadMorningBriefingDeferredPayload(briefingArgs, agg),
  ]);

  const pulse = payload.pulse;
  const metrics: DashboardMetric[] = [
    { id: "active", label: "Casos ativos", value: pulse.activeCases },
    { id: "deadlines", label: "Prazos em aberto", value: pulse.openDeadlines },
    {
      id: "waiting",
      label: "Aguardando passo",
      value: pulse.casesNeedingNextStep,
    },
    { id: "risks", label: "Riscos altos", value: pulse.openHighRisks },
    { id: "drafts", label: "Peças em elaboração", value: pulse.draftsOpen },
    { id: "reviews", label: "Revisões pendentes", value: pulse.reviewsWaiting },
  ];

  let kanbanCards = buildKanbanCardsFromResumeRows(payload.resumeCases);
  const caseIds = kanbanCards.map((c) => c.id);
  if (caseIds.length > 0) {
    const rows = await prisma.case.findMany({
      where: { workspaceId: input.workspaceId, id: { in: caseIds } },
      select: { id: true, metadataJson: true },
    });
    const overrideById = new Map(
      rows
        .map((r) => [r.id, readKanbanColumnOverride(r.metadataJson)] as const)
        .filter(([, col]) => col != null),
    );
    kanbanCards = kanbanCards.map((card) => {
      const col = overrideById.get(card.id);
      return col ? { ...card, columnId: col } : card;
    });
  }

  return {
    displayName: shell.displayName,
    honorific: shell.honorific,
    hasNoCases: shell.hasNoCases,
    metrics,
    nowActions: payload.briefingActions,
    nowActionsOverflow: payload.briefingActionsOverflow,
    kanbanByColumn: groupKanbanByColumn(kanbanCards),
    activities: payload.activities,
    copilotMessage: payload.copilotMessage,
    copilotTitle: payload.copilotTitle,
    urgent: payload.urgent,
  };
}
