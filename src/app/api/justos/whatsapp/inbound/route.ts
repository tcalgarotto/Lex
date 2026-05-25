import { NextResponse } from "next/server";
import { z } from "zod";
import { readJustosCommandSecret } from "@/lib/justos/env";
import { requireJustosPro } from "@/lib/justos/require-pro";
import { processInboundWhatsapp } from "@/lib/justos/whatsapp/inbound-service";

const InboundSchema = z.object({
  sessionKey: z.string().min(4),
  from: z.string().min(8),
  body: z.string().min(1).max(16_000),
  messageId: z.string().optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: Request) {
  const secret = readJustosCommandSecret();
  if (secret) {
    const got = req.headers.get("x-justos-command-secret");
    if (got !== secret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const workspaceId = req.headers.get("x-justos-workspace-id");
  const sessionKey = req.headers.get("x-justos-session-key");
  if (!workspaceId || !sessionKey) {
    return NextResponse.json({ error: "Headers workspace/session obrigatórios" }, { status: 400 });
  }

  let body: z.infer<typeof InboundSchema>;
  try {
    body = InboundSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  if (body.sessionKey !== sessionKey) {
    return NextResponse.json({ error: "sessionKey inconsistente" }, { status: 403 });
  }

  try {
    await requireJustosPro(workspaceId);
    const traceId = req.headers.get("x-justos-trace-id") ?? crypto.randomUUID();
    const result = await processInboundWhatsapp({
      workspaceId,
      sessionKey,
      from: body.from,
      body: body.body,
      messageId: body.messageId,
      timestamp: body.timestamp,
      traceId,
    });
    return NextResponse.json({ ok: true, traceId, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inbound";
    const status = msg.includes("Pro") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
