"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_KANBAN_COLUMNS,
  type DashboardKanbanCard,
  type DashboardKanbanColumnId,
} from "@/lib/dashboard/dashboard-kanban";

type BoardState = Record<DashboardKanbanColumnId, DashboardKanbanCard[]>;

function KanbanCaseCard({
  card,
  dragHandle,
}: {
  card: DashboardKanbanCard;
  dragHandle?: React.ReactNode;
}) {
  return (
    <article className="justos-dashboard__case-card" data-testid={`kanban-card-${card.id}`}>
      <div className="flex items-start gap-2">
        {dragHandle}
        <div className="min-w-0 flex-1">
          <p className="justos-dashboard__case-title">{card.title}</p>
          <p className="justos-dashboard__case-meta">{card.badgeLabel}</p>
          <p className="justos-dashboard__case-meta">{card.progressPct}% · {card.nextActionLabel}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="mt-3 h-8 w-full text-control" asChild>
        <Link href={card.continueHref}>{card.nextActionLabel}</Link>
      </Button>
    </article>
  );
}

function SortableCaseCard({ card }: { card: DashboardKanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { columnId: card.columnId, card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} data-dragging={isDragging ? "true" : undefined}>
      <KanbanCaseCard
        card={card}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-border)]"
            aria-label={`Mover caso ${card.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </div>
  );
}

function MoveToMenu({
  cardId,
  currentColumn,
  onMove,
}: {
  cardId: string;
  currentColumn: DashboardKanbanColumnId;
  onMove: (caseId: string, columnId: DashboardKanbanColumnId) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="mt-2 block text-xs text-[color:var(--text-secondary)]">
      <span className="sr-only">Mover caso sem arrastar</span>
      <select
        className="mt-1 w-full rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-base)] px-2 py-1.5 text-sm text-[color:var(--text-primary)]"
        disabled={busy}
        defaultValue={currentColumn}
        onChange={async (e) => {
          const col = e.target.value as DashboardKanbanColumnId;
          if (col === currentColumn) return;
          setBusy(true);
          try {
            await onMove(cardId, col);
          } finally {
            setBusy(false);
          }
        }}
      >
        {DASHBOARD_KANBAN_COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            Mover para {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardKanbanBoard({
  initialByColumn,
}: {
  initialByColumn: BoardState;
}) {
  const [byColumn, setByColumn] = useState<BoardState>(initialByColumn);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const cardIndex = useMemo(() => {
    const map = new Map<string, DashboardKanbanCard>();
    for (const col of DASHBOARD_KANBAN_COLUMNS) {
      for (const card of byColumn[col.id] ?? []) {
        map.set(card.id, card);
      }
    }
    return map;
  }, [byColumn]);

  const persistMove = useCallback(async (caseId: string, columnId: DashboardKanbanColumnId) => {
    const res = await fetch(`/api/dashboard/cases/${caseId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId }),
    });
    if (!res.ok) throw new Error("Falha ao atualizar estágio");
  }, []);

  const moveCard = useCallback(
    async (caseId: string, toColumn: DashboardKanbanColumnId) => {
      const card = cardIndex.get(caseId);
      if (!card || card.columnId === toColumn) return;

      const prev = byColumn;
      const fromColumn = card.columnId;
      const next: BoardState = { ...byColumn };
      next[fromColumn] = (next[fromColumn] ?? []).filter((c) => c.id !== caseId);
      next[toColumn] = [...(next[toColumn] ?? []), { ...card, columnId: toColumn }];
      setByColumn(next);

      try {
        await persistMove(caseId, toColumn);
      } catch {
        setByColumn(prev);
      }
    },
    [byColumn, cardIndex, persistMove],
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const caseId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId) return;

    let toColumn: DashboardKanbanColumnId | null = null;
    if (DASHBOARD_KANBAN_COLUMNS.some((c) => c.id === overId)) {
      toColumn = overId as DashboardKanbanColumnId;
    } else {
      const overCard = cardIndex.get(String(overId));
      if (overCard) toColumn = overCard.columnId;
    }
    if (toColumn) void moveCard(caseId, toColumn);
  };

  const activeCard = activeId ? cardIndex.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="justos-dashboard__board-scroll" data-testid="dashboard-kanban-board">
        <div className="justos-dashboard__board-columns" role="list">
          {DASHBOARD_KANBAN_COLUMNS.map((column) => {
            const cards = byColumn[column.id] ?? [];
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards}
                onMove={moveCard}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-[var(--dashboard-board-column-width)] opacity-95">
            <KanbanCaseCard card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  cards,
  onMove,
}: {
  column: (typeof DASHBOARD_KANBAN_COLUMNS)[number];
  cards: DashboardKanbanCard[];
  onMove: (caseId: string, columnId: DashboardKanbanColumnId) => Promise<void>;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
              <section
                ref={setNodeRef}
                className="justos-dashboard__board-column"
                role="listitem"
                aria-label={column.label}
                data-testid={`kanban-column-${column.id}`}
              >
                <div className="justos-dashboard__board-column-head">
                  <h3 className="justos-dashboard__board-column-title">{column.label}</h3>
                  <span className="justos-dashboard__board-count">{cards.length}</span>
                </div>
                <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div
                    className="flex min-h-[4rem] flex-col gap-2"
                    id={column.id}
                    data-column-droppable={column.id}
                  >
                    {cards.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-[color:var(--text-muted)]">
                        Nenhum caso nesta etapa
                      </p>
                    ) : (
                      cards.map((card) => (
                        <div key={card.id}>
                          <SortableCaseCard card={card} />
                          <MoveToMenu
                            cardId={card.id}
                            currentColumn={card.columnId}
                            onMove={onMove}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </SortableContext>
              </section>
  );
}
