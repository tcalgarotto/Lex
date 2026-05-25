/**
 * PATCH /api/cases/[id]/justos-secretary
 * Persiste telefones da secretária (UI Lex ou n8n `secretary.configure`).
 * Auth: sessão workspace ou Bearer LEX_N8N_SERVICE_TOKEN.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCaseRouteContext, caseRouteAuthResponse } from "@/lib/auth/case-route-context";
import { saveCaseN8nSecretary } from "@/lib/justos/n8n-secretary-store";

const PatchBody = z.object({
  clientWhatsApp: z.string().max(32).nullable().optional(),
  lawyerWhatsApp: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  try {
    const { workspaceId } = await getCaseRouteContext(req, id);
    const secretary = await saveCaseN8nSecretary({
      workspaceId,
      caseId: id,
      patch: body,
    });
    return NextResponse.json({ ok: true, caseId: id, secretary });
  } catch (e) {
    const authRes = caseRouteAuthResponse(e);
    if (authRes) return authRes;
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
