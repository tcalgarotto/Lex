/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { NextResponse } from "next/server";
import { rateLimit, rateLimitHeaders, getRequestIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function loadCaseScoped(workspaceId: string, caseId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: {
      id: true,
      title: true,
      processNumber: true,
      metadataJson: true,
    },
  });
}

export async function enforceDraftingRateLimit(args: {
  req: Request;
  userId: string;
  bucket: string;
}): Promise<NextResponse | null> {
  const ip = getRequestIp(args.req.headers);
  const key = `lex:drafting:${args.bucket}:${args.userId}:${ip}`;
  const rl = await rateLimit({ key, limit: 12, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um instante e tente novamente." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }
  return null;
}
