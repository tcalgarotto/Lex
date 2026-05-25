import { getWorkspaceContext } from "@/lib/auth/session";
import { requireJustosPro } from "@/lib/justos/require-pro";

export async function getCrmApiContext(): Promise<{ workspaceId: string; userId: string }> {
  const { workspaceId, user } = await getWorkspaceContext();
  await requireJustosPro(workspaceId);
  return { workspaceId, userId: user.id };
}
