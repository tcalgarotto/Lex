import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { requireJustosPro } from "@/lib/justos/require-pro";
import { fetchCommandQr } from "@/lib/justos/command-client";
import { getWhatsappSession } from "@/lib/justos/whatsapp/session-service";

export async function GET() {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "workspaceManage")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await requireJustosPro(workspaceId);

  const session = await getWhatsappSession(workspaceId);
  if (!session) {
    return NextResponse.json({ error: "Sessão não iniciada. Conecte primeiro." }, { status: 409 });
  }

  const qr = await fetchCommandQr(workspaceId, session.sessionKey);
  if (!qr) {
    return NextResponse.json({ error: "JustOS Command indisponível" }, { status: 502 });
  }

  return NextResponse.json({
    workspaceId,
    sessionKey: session.sessionKey,
    ...qr,
  });
}
