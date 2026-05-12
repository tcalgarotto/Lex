import { cache } from "react";
import { getActiveWorkspaceMembership } from "@/lib/auth/workspace-membership";

/** Resolve o workspace ativo; memoizado por request (partilha cache com `getActiveWorkspaceMembership`). */
export const resolveWorkspaceId = cache(async (userId: string): Promise<string> => {
  const m = await getActiveWorkspaceMembership(userId);
  return m.workspaceId;
});
