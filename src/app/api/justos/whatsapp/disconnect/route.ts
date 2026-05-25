import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { requireJustosPro } from "@/lib/justos/require-pro";
import { disconnectCommandSession } from "@/lib/justos/command-client";
import {
  getWhatsappSession,
  updateWhatsappSession,
} from "@/lib/justos/whatsapp/session-service";

export async function POST() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "workspaceManage")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await requireJustosPro(workspaceId);

  const session = await getWhatsappSession(workspaceId);
  if (session) {
    try {
      await disconnectCommandSession(workspaceId, session.sessionKey);
    } catch {
      /* Command offline — still clear local */
    }
  }

  await updateWhatsappSession(workspaceId, {
    status: "disconnected",
    phoneE164: null,
    connectedAt: null,
  });

  return NextResponse.json({ ok: true, status: "disconnected" });
}
