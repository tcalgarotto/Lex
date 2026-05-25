import { prisma } from "@/lib/prisma";

export class CrmNotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Recurso CRM não encontrado.") {
    super(message);
    this.name = "CrmNotFoundError";
  }
}

export async function assertCrmWorkspaceAccess(
  workspaceId: string,
  resource: { workspaceId: string },
): Promise<void> {
  if (resource.workspaceId !== workspaceId) {
    throw new CrmNotFoundError();
  }
}

export async function assertClientInWorkspace(
  workspaceId: string,
  clientId: string,
): Promise<void> {
  const row = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true },
  });
  if (!row) throw new CrmNotFoundError("Cliente não encontrado neste escritório.");
}

export async function assertCaseInWorkspace(workspaceId: string, caseId: string): Promise<void> {
  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new CrmNotFoundError("Caso não encontrado neste escritório.");
}

export function crmNotFoundResponse(err: unknown): Response | null {
  if (err instanceof CrmNotFoundError) {
    return Response.json({ error: err.message }, { status: 404 });
  }
  return null;
}
