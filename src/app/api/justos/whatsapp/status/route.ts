import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { requireJustosPro } from "@/lib/justos/require-pro";
import {
  fetchCommandSessionStatus,
  pingJustosCommandHealth,
} from "@/lib/justos/command-client";
import { readJustosOpenClawMode } from "@/lib/justos/env";
import {
  buildSessionKey,
  ensureWhatsappSession,
  getWhatsappSession,
  updateWhatsappSession,
  type WhatsappSessionStatus,
} from "@/lib/justos/whatsapp/session-service";

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  await requireJustosPro(workspaceId);

  const local =
    (await getWhatsappSession(workspaceId)) ?? (await ensureWhatsappSession(workspaceId));
  const commandOk = await pingJustosCommandHealth();

  const remote = commandOk
    ? await fetchCommandSessionStatus(workspaceId, local.sessionKey)
    : null;

  if (remote && commandOk) {
    const nextStatus = remote.status as WhatsappSessionStatus;
    const statusChanged = nextStatus !== local.status;
    const phoneChanged = (remote.phoneE164 ?? null) !== (local.phoneE164 ?? null);
    if (statusChanged || phoneChanged) {
      await updateWhatsappSession(workspaceId, {
        status: nextStatus,
        phoneE164: remote.phoneE164 ?? local.phoneE164,
        openclawPort: remote.openclawPort ?? local.openclawPort ?? undefined,
        metaJson: {
          openclawMode: remote.openclawMode ?? readJustosOpenClawMode(),
          openclawPort: remote.openclawPort ?? null,
        },
      });
    }
  }

  const session = (await getWhatsappSession(workspaceId)) ?? local;
  const expectedKey = buildSessionKey(workspaceId);

  return NextResponse.json({
    workspaceId,
    session: {
      sessionKey: session.sessionKey,
      sessionKeyMasked: `${session.sessionKey.slice(0, 6)}…${session.sessionKey.slice(-4)}`,
      status: session.status,
      phoneE164: session.phoneE164,
      connectedAt: session.connectedAt,
      lastHealthAt: session.lastHealthAt,
    },
    sessionKeyValid: session.sessionKey === expectedKey,
    qrAvailable:
      remote?.qrAvailable ??
      (session.status === "pairing" || session.status === "starting"),
    commandReachable: commandOk,
    openclawMode: remote?.openclawMode ?? readJustosOpenClawMode(),
    openclawPort: remote?.openclawPort ?? session.openclawPort ?? null,
    error: remote?.error ?? null,
  });
}
