import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type WhatsappSessionStatus =
  | "disconnected"
  | "starting"
  | "pairing"
  | "connected"
  | "error";

export function buildSessionKey(workspaceId: string): string {
  const hash = createHash("sha256").update(workspaceId).digest("hex").slice(0, 12);
  return `ws_${hash}`;
}

export async function getWhatsappSession(workspaceId: string) {
  return prisma.justosWhatsappSession.findUnique({ where: { workspaceId } });
}

export async function ensureWhatsappSession(workspaceId: string) {
  const existing = await getWhatsappSession(workspaceId);
  if (existing) return existing;

  return prisma.justosWhatsappSession.create({
    data: {
      workspaceId,
      sessionKey: buildSessionKey(workspaceId),
      status: "disconnected",
    },
  });
}

export async function updateWhatsappSession(
  workspaceId: string,
  patch: {
    status?: WhatsappSessionStatus;
    phoneE164?: string | null;
    openclawPort?: number | null;
    connectedAt?: Date | null;
    metaJson?: object;
  },
) {
  await ensureWhatsappSession(workspaceId);
  return prisma.justosWhatsappSession.update({
    where: { workspaceId },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.phoneE164 !== undefined ? { phoneE164: patch.phoneE164 } : {}),
      ...(patch.openclawPort !== undefined ? { openclawPort: patch.openclawPort } : {}),
      ...(patch.connectedAt !== undefined ? { connectedAt: patch.connectedAt } : {}),
      ...(patch.metaJson ? { metaJson: patch.metaJson } : {}),
      lastHealthAt: new Date(),
    },
  });
}

export async function resolveWorkspaceBySessionKey(sessionKey: string): Promise<string | null> {
  const row = await prisma.justosWhatsappSession.findFirst({
    where: { sessionKey },
    select: { workspaceId: true },
  });
  return row?.workspaceId ?? null;
}

export async function assertSessionBelongsToWorkspace(
  workspaceId: string,
  sessionKey: string,
): Promise<void> {
  const row = await prisma.justosWhatsappSession.findFirst({
    where: { workspaceId, sessionKey },
  });
  if (!row) throw new Error("sessionKey não pertence ao workspace");
}
