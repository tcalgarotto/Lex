import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { sendJustosSelfTest } from "@/lib/justos/command-client";
import { requireJustosPro } from "@/lib/justos/require-pro";
import { getWhatsappSession } from "@/lib/justos/whatsapp/session-service";

export async function POST() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "workspaceManage")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await requireJustosPro(workspaceId);

  const session = await getWhatsappSession(workspaceId);
  if (!session) {
    return NextResponse.json({ error: "WhatsApp não configurado" }, { status: 409 });
  }

  const traceId = crypto.randomUUID();
  const result = await sendJustosSelfTest(workspaceId, session.sessionKey, traceId);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Falha no teste", result, traceId },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, result, traceId, to: result.to });
}
