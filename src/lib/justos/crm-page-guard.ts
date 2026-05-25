import { getWorkspaceContext } from "@/lib/auth/session";
import { requireJustosPro, JustosProRequiredError } from "@/lib/justos/require-pro";

export async function assertCrmPageAccess(): Promise<{ workspaceId: string; pro: true }> {
  const { workspaceId } = await getWorkspaceContext();
  try {
    await requireJustosPro(workspaceId);
    return { workspaceId, pro: true };
  } catch (e) {
    if (e instanceof JustosProRequiredError) throw e;
    throw e;
  }
}

export async function isCrmPageAllowed(): Promise<boolean> {
  const { workspaceId } = await getWorkspaceContext();
  try {
    await requireJustosPro(workspaceId);
    return true;
  } catch {
    return false;
  }
}
