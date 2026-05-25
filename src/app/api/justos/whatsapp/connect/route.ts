import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { requireJustosPro } from "@/lib/justos/require-pro";
import { connectCommandSession } from "@/lib/justos/command-client";
import { readJustosOpenClawMode } from "@/lib/justos/env";
import {
  ensureWhatsappSession,
  updateWhatsappSession,
} from "@/lib/justos/whatsapp/session-service";

export async function POST() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "workspaceManage")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await requireJustosPro(workspaceId);

  const local = await ensureWhatsappSession(workspaceId);

  try {
    const remote = await connectCommandSession(workspaceId, local.sessionKey);
    const status = (remote?.status ?? "starting") as
      | "disconnected"
      | "starting"
      | "pairing"
      | "connected"
      | "error";

    const mode = remote?.openclawMode ?? readJustosOpenClawMode();
    await updateWhatsappSession(workspaceId, {
      status,
      openclawPort: remote?.openclawPort ?? undefined,
      metaJson: {
        openclawMode: mode,
        openclawPort: remote?.openclawPort ?? null,
        devWarning:
          mode === "dev-single"
            ? "Modo dev-single: compartilha WhatsApp do SOLD (:3310)."
            : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      workspaceId,
      sessionKey: local.sessionKey,
      status,
      qrAvailable: status === "pairing" || status === "starting",
      openclawMode: mode,
      openclawPort: remote?.openclawPort ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao conectar Command" },
      { status: 502 },
    );
  }
}
