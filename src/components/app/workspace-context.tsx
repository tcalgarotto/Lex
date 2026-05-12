"use client";

import { createContext, useContext } from "react";
import type { WorkspaceOption } from "@/components/app/workspace-switcher";

type WorkspaceContextValue = {
 current: WorkspaceOption;
 workspaces: WorkspaceOption[];
} | null;

const WorkspaceContext = createContext<WorkspaceContextValue>(null);

export function WorkspaceProvider({
 value,
 children,
}: {
 value: WorkspaceContextValue;
 children: React.ReactNode;
}) {
 return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
 return useContext(WorkspaceContext);
}
