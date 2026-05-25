import { prisma } from "@/lib/prisma";
import { isJustosOperational, readJustosWorkspaceConfig } from "@/lib/justos/workspace-config";
import type { JustosWorkspaceConfig } from "@/lib/justos/types";
import { getJustosProEntitlement } from "@/lib/justos/billing-entitlement";

export class JustosProRequiredError extends Error {
  readonly status = 403;
  constructor(message = "JustOS Pro é necessário para este recurso.") {
    super(message);
    this.name = "JustosProRequiredError";
  }
}

export async function getJustosConfig(workspaceId: string): Promise<JustosWorkspaceConfig> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  return readJustosWorkspaceConfig(ws?.onboardingJson);
}

export async function isJustosEnabled(workspaceId: string): Promise<boolean> {
  const config = await getJustosConfig(workspaceId);
  return isJustosOperational(config);
}

export async function isJustosProEnabled(workspaceId: string): Promise<boolean> {
  const config = await getJustosConfig(workspaceId);
  return getJustosProEntitlement(config).active;
}

export async function requireJustosPro(workspaceId: string): Promise<JustosWorkspaceConfig> {
  const config = await getJustosConfig(workspaceId);
  const entitlement = getJustosProEntitlement(config);
  if (!entitlement.active) {
    throw new JustosProRequiredError(entitlement.reason ?? "JustOS Pro inativo.");
  }
  return config;
}

/** Converte erro Pro em Response JSON 403. */
export function justosProErrorResponse(err: unknown): Response | null {
  if (err instanceof JustosProRequiredError) {
    return Response.json({ error: err.message, code: "justos_pro_required" }, { status: 403 });
  }
  return null;
}
