"use client";

import dynamic from "next/dynamic";
import type { DashboardKanbanColumnId, DashboardKanbanCard } from "@/lib/dashboard/dashboard-kanban";

const DashboardKanbanBoard = dynamic(
  () =>
    import("@/components/dashboard/dashboard-kanban-board").then((m) => m.DashboardKanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="justos-dashboard__empty" data-testid="dashboard-kanban-loading">
        Carregando quadro…
      </div>
    ),
  },
);

export function DashboardKanbanBoardLazy({
  initialByColumn,
}: {
  initialByColumn: Record<DashboardKanbanColumnId, DashboardKanbanCard[]>;
}) {
  return <DashboardKanbanBoard initialByColumn={initialByColumn} />;
}
