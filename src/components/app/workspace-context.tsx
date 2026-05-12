"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { WorkspaceOption } from "@/components/app/workspace-switcher";

export type SidebarViewer = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type WorkspaceContextValue = {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  viewer: SidebarViewer;
} | null;

const WorkspaceContext = createContext<WorkspaceContextValue>(null);

/** Chave estável para comparar listas de workspace entre navegações RSC. */
function workspaceSnapshotKey(v: NonNullable<WorkspaceContextValue>): string {
  const ord = [...v.workspaces]
    .map((w) => `${w.id}\t${w.name}\t${w.role}`)
    .sort()
    .join("\n");
  return [
    v.current.id,
    v.current.name,
    v.current.role,
    ord,
    v.viewer.email,
    v.viewer.displayName,
    v.viewer.avatarUrl ?? "",
  ].join("\n");
}

/**
 * Mantém a **mesma referência** de `value` no contexto quando os dados não mudaram,
 * para não re-renderizar sidebar/topbar em cada navegação (o layout RSC recria o objeto).
 */
export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  const cache = useRef<{ key: string; frozen: WorkspaceContextValue | null }>({
    key: "",
    frozen: null,
  });
  const stable = useMemo(() => {
    if (value == null) {
      cache.current = { key: "__null__", frozen: null };
      return null;
    }
    const key = workspaceSnapshotKey(value);
    if (cache.current.key === key && cache.current.frozen != null) {
      return cache.current.frozen;
    }
    cache.current = { key, frozen: value };
    return value;
  }, [value]);
  return (
    <WorkspaceContext.Provider value={stable}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}

export type { WorkspaceOption };
