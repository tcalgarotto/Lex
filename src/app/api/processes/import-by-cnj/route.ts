import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { importProcessByCnj } from "@/lib/legal-processes/import-process-by-cnj";

const Body = z.object({
  cnj: z.string().min(20).max(40),
  caseId: z.string().cuid().optional(),
  tribunalAcronym: z.string().min(2).max(20).optional(),
});

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", detail: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await importProcessByCnj({
      workspaceId,
      userId: user.id,
      cnj: parsed.data.cnj,
      caseId: parsed.data.caseId,
      tribunalAcronym: parsed.data.tribunalAcronym,
    });
    return NextResponse.json({
      processId: result.processId,
      legalProcessId: result.legalProcessId,
      cnj: result.cnj.formatted,
      tribunal: result.tribunalAcronym,
      importedMovements: result.importedMovements,
      totalMovements: result.totalMovements,
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao importar processo" },
      { status: 400 },
    );
  }
}
